'use strict';

const sageMakerUtils = require('../utils/SageMakerUtils');
const kinesisVideoUtils = require('../utils/KinesisVideoUtils');
const dynamoUtils = require('../utils/DynamoUtils');
const bedrockUtils = require('../utils/BedrockUtils');

const { EbmlStreamDecoder, EbmlTagId } = require('ebml-stream');
const fs = require('fs');
const uuid = require('uuid');

const tagLengthMillis = 64;
const amplitudeThreshold = 0.1;

/**
 * Process an audio stream from KVS reading chunks of audio and buffering them
 * calling the audio callback when required. The system handles presence of one or 
 * both audio streams.
 * 
 * Future controlAttributes could have the following features with [defaults]
 *  - endpointId: Sagemaker model id [process.env.ENDPOINT_ID]
 *  - maxLeadSilence: The maximum lead customer silence before we timeout in seconds [3.0]
 *  - maxTailSilence: The maximum tail customer silence before we complete in seconds [1.5]
 *  - wordSilence: The amount of silence that indicates a word boundary [0.5]
 *  - minimumAudioLength: The minimum audio length to transcribe
 *  - maxRecordingLength: The maximum recording length [60.0]
 *  - streamBufferSize: The stream buffer size in bytes [32756]
 *  - agentAudioFile: Optional output audio file in S3 with raw buffered agent audio [undefined]
 *  - customerAudioFile: Optional output audio file in S3 with raw buffered customer audio [undefined]
 * 
 * The function writes real-time transcripts into Dynamo
 */
module.exports.transcribeStream = async (streamArn, startFragment, contactId, whisperEndPoint) =>
{
  try
  {
    // Create a decoder
    const decoder = new EbmlStreamDecoder();

    // Open the stream
    const kvsStream = await kinesisVideoUtils.openStream(streamArn, startFragment);

    /**
     * Transcription context will grow to track silence and state
     * to be able to determine stopping criteria
     */
    const transcriptionContext = {
      stopping: false, // Are we stopping?

      whisperEndPoint: whisperEndPoint,

      // A map of current tags that contains orginal key value pairs, 
      // buffered values and detected values
      currentTags: {
        OriginalContactId: contactId,
      },

      // The names of the tracks as we find them
      trackNames: ['UNKNOWN', 'UNKNOWN'],

      // Tags that we have read but not yet processed
      bufferedTags: [],

      // Raw audio data
      audioData: [[], []],

      // Raw utterance data ready for processing
      utteranceData: [[], []],

      utteranceStartTime: [0, 0],

      producerPacketCount: [0, 0],

      // Current count of voice frames for this track
      voiceFrames: [0, 0],

      // Current count of silence frames per track
      silenceFrames: [0, 0],

      // Track length in millis
      trackLength: [0, 0],
      transcripts: [],
      metrics: {},
      messages: await dynamoUtils.getAllMessages(contactId)
      // TODO more state data here
    };

    /**
     * When a tag arrives add it to the buffered tags in the
     * transcription context
     */
    decoder.on('data', async (tag) => 
    {
      // console.info(JSON.stringify(tag));
      transcriptionContext.bufferedTags.push(tag);
    });

    /**
     * Read a block of data from the stream
     */
    for await (const streamBlock of kvsStream) 
    {
      // console.info(`Processing data block: ${streamBlock.length}`);
      
      // Parse out available tags by feeding the decoder
      decoder.write(streamBlock);

      // Process the buffered tags we read from the block
      await this.processTags(transcriptionContext);

      // Check for stopping critera
      if (transcriptionContext.stopping)
      {
        break;
      }
    }
  }
  catch (error)
  {
    console.error(`Failed to transcribe audio from stream`, error);
    throw error;
  }
};

/**
 * Checks for stopping conditions
 */
module.exports.shouldStop = (transcriptionContext) =>
{
  // if (transcriptionContext.trackLength[0] > 20000)
  // {
  //   console.info('Max recording time reached');
  //   return true;
  // }

  if (transcriptionContext.stopping || (transcriptionContext.currentTags.ContactId !== undefined && 
     (transcriptionContext.currentTags.OriginalContactId !== transcriptionContext.currentTags.ContactId)))
  {
    console.info('Stop requested');
    return true;
  }

  return false;
}

/**
 * Processes buffered tags, updating the transcription context
 */
module.exports.processTags = async (transcriptionContext) =>
{
  for (var i = 0; i < transcriptionContext.bufferedTags.length; i++)
  {
    const tag = transcriptionContext.bufferedTags[i];

    // Track number comes before track name in the EMBL tag list, buffer it
    if (tag.id === EbmlTagId.TrackNumber)
    {
      transcriptionContext.currentTags.bufferedTrackNumber = tag.data;
    }

    // Handle the need to get the track number before the track name
    if (tag.id === EbmlTagId.Name)
    {
      if (tag.data === 'AUDIO_TO_CUSTOMER' && transcriptionContext.currentTags.bufferedTrackNumber !== undefined)
      {
        transcriptionContext.currentTags['AUDIO_TO_CUSTOMER'] = transcriptionContext.currentTags.bufferedTrackNumber;
        transcriptionContext.trackNames[transcriptionContext.currentTags.bufferedTrackNumber - 1] = 'AGENT';
        transcriptionContext.currentTags.bufferedTrackNumber = undefined;
      }
      else if (tag.data === 'AUDIO_FROM_CUSTOMER' && transcriptionContext.currentTags.bufferedTrackNumber !== undefined)
      {
        transcriptionContext.currentTags['AUDIO_FROM_CUSTOMER'] = transcriptionContext.currentTags.bufferedTrackNumber;
        transcriptionContext.trackNames[transcriptionContext.currentTags.bufferedTrackNumber - 1] = 'CUSTOMER';
        transcriptionContext.currentTags.bufferedTrackNumber = undefined;
      }
    }

    // Note that the track controller tags are emitted in a strange way and should be ignored
    const ignoredTagNames = 
    [
      'AUDIO_TO_CUSTOMER', 'AUDIO_FROM_CUSTOMER', 'Events'
    ];

    if (tag.id === EbmlTagId.TagName)
    {
      if (!ignoredTagNames.includes(tag.data))
      {
        transcriptionContext.currentTags.bufferedTagName = tag.data;
      }
    }

    if (tag.id === EbmlTagId.TagString)
    {
      if (transcriptionContext.currentTags.bufferedTagName !== undefined)
      {
        if (transcriptionContext.currentTags.bufferedTagName === 'AWS_KINESISVIDEO_PRODUCER_TIMESTAMP')
        {
          if (transcriptionContext.currentTags.AWS_KINESISVIDEO_PRODUCER_TIMESTAMP === undefined)
          {
            transcriptionContext.currentTags.InitialProducerTimestamp = tag.data;
          }

          // Reset the packet counts since the last producer timestamp
          transcriptionContext.producerPacketCount[0] = 0;
          transcriptionContext.producerPacketCount[1] = 0;
        }

        transcriptionContext.currentTags[transcriptionContext.currentTags.bufferedTagName] = tag.data;
      }

      transcriptionContext.currentTags.bufferedTagName = undefined;
    }

    if (tag.id === EbmlTagId.SimpleBlock)
    {
      const converted = this.to16BitArray(tag.payload);
      const trackIndex = tag.track - 1;

      transcriptionContext.producerPacketCount[trackIndex]++;

      // const crossings = this.getZeroCrossings(converted);
      const sumOfSQuares = this.getSumSquares(converted);

      // If we have voice like data in this packet
      if (sumOfSQuares > amplitudeThreshold)
      {
        // Reset silence frames since we got voice for this track
        transcriptionContext.silenceFrames[trackIndex] = 0;

        // Increment voice packets for this track
        transcriptionContext.voiceFrames[trackIndex]++;

        // Add the utterance audio data to the tarck's utterance buffer
        transcriptionContext.utteranceData[trackIndex].push(tag.payload);

        // If this is the first voice packet in this track, compute the start time
        if (transcriptionContext.voiceFrames[trackIndex] === 1)
        {
          transcriptionContext.utteranceStartTime[trackIndex] = this.calculateTimeMillis(trackIndex, transcriptionContext);
        }
      }
      else
      {
        transcriptionContext.silenceFrames[trackIndex]++;
        transcriptionContext.utteranceData[trackIndex].push(tag.payload);

        if (transcriptionContext.voiceFrames[trackIndex] >= 6 && transcriptionContext.silenceFrames[trackIndex] === 16)
        {

          await dynamoUtils.setNextMessage(transcriptionContext.currentTags.OriginalContactId, 'Processing', 'I am currently processing customer input', 'Thanks I am processing');

          const transcript = await this.transcribeAudio(transcriptionContext.whisperEndPoint, Buffer.concat(transcriptionContext.utteranceData[trackIndex]));
          const transcriptItem = {
            contactId: transcriptionContext.currentTags.OriginalContactId,
            transcriptId: uuid.v4(),
            channel: 'VOICE',
            content: transcript,
            participant: transcriptionContext.trackNames[trackIndex],
            startOffset: transcriptionContext.utteranceStartTime[trackIndex],
            endOffset: this.calculateTimeMillis(trackIndex, transcriptionContext)
          };

          console.info(`Made transcript: ${JSON.stringify(transcriptItem, null, 2)}`);

          await dynamoUtils.createTranscriptItem(transcriptItem);

          transcriptionContext.messages.push({
            role: 'user',
            content: transcript
          });

          const { parsedResponse, rawResponse } = await bedrockUtils.invokeModel(transcriptionContext.messages);
          const saveMessage = await handleModelResponse(transcriptionContext.currentTags.OriginalContactId, parsedResponse);

          if (saveMessage)
          {
            await dynamoUtils.createMessage(transcriptionContext.currentTags.OriginalContactId, 'user', transcript);
            await dynamoUtils.createMessage(transcriptionContext.currentTags.OriginalContactId, 'assistant', rawResponse);
          }

          transcriptionContext.transcripts.push(transcriptItem);
          transcriptionContext.utteranceData[trackIndex].length = 0;
          transcriptionContext.silenceFrames[trackIndex] = 0;
          transcriptionContext.voiceFrames[trackIndex] = 0;

          transcriptionContext.stopping = true;
        }
      }

      transcriptionContext.audioData[trackIndex].push(tag.payload);
      transcriptionContext.trackLength[trackIndex] += tagLengthMillis;
    }
    else
    {
      //console.info(`Got non block tag: ${JSON.stringify(tag)}`);
    }

    if (this.shouldStop(transcriptionContext))
    {
      transcriptionContext.stopping = true;
      console.info('Stopping condition reached');
      break;
    }
  }

  // Zero the buffered tags as these have now have been processed
  transcriptionContext.bufferedTags.length = 0;
}

/**
 * Handle the response 
 */
async function handleModelResponse(contactId, parsedResponse)
{
  try
  {
    const tool = parsedResponse.Response?.Action.Tool;
    const thought = parsedResponse.Response?.Thought;
    const message = parsedResponse.Response?.Action.Argument;
    var saveMessage = true;

    switch (tool)
    {
      case 'ThinkingMode':
      case 'Angry':
      case 'Fallback':
      {
        saveMessage = false;
        break;
      }
    }

    await dynamoUtils.setNextMessage(contactId, tool, thought, message);

    return saveMessage;
  }
  catch (error)
  {
    console.error('Failed to handle model response', error);
    throw error;
  }
}

/**
 * For a given track compute the time now
 */
module.exports.calculateTimeMillis = (trackIndex, context) =>
{
  if (context.currentTags.InitialProducerTimestamp === undefined)
  {
    return 0;
  }

  if (context.currentTags.AWS_KINESISVIDEO_PRODUCER_TIMESTAMP === undefined)
  {
    return 0;
  }

  const timeNow = Math.floor((+context.currentTags.AWS_KINESISVIDEO_PRODUCER_TIMESTAMP + 
    context.producerPacketCount[trackIndex] * 64 * 0.001 - 
    +context.currentTags.InitialProducerTimestamp) * 1000);

  // console.info(`Computed current time millis: ${timeNow}`);

  return timeNow;
}

/**
 * Dump audio as RAW
 */
module.exports.dumpAudioAsRaw = (outputFile, data) =>
{
  // console.info(`Dumping to raw: ${outputFile}`);
  fs.writeFileSync(outputFile, data);
}

/**
 * Fetches the time in seconds since the start of the timestamp
 */
module.exports.getTimeSinceStartSeconds = (context) =>
{
  if (context.currentTags.InitialProducerTimestamp === undefined || context.currentTags.AWS_KINESISVIDEO_PRODUCER_TIMESTAMP === undefined)
  {
    return 0;
  }

  return +(+context.currentTags.AWS_KINESISVIDEO_PRODUCER_TIMESTAMP - +context.currentTags.InitialProducerTimestamp).toFixed(3);


}

/**
 * Transcribe a fragment of audio using a sagemaker end point
 */
module.exports.transcribeAudio = async (endpointName, audioBytes) =>
{
  try
  {
    console.info('About to transcribe');
    const transcription = await sageMakerUtils.invokeTranscriptionEndpoint(endpointName, audioBytes);
    console.info('Transcribing complete');
    return transcription;
  }
  catch (error)
  {
    console.error(`Failed to transcribe audio`, error);
    throw error;
  }
}

/**
 * Convert 8 bit 2 byte little endian signed to 16 bit signed
 */
module.exports.to16BitArray = (intArray) =>
{
  const results = [];

  for (var i = 0; i < intArray.length; i+=2)
  {
    var value = intArray[i] + intArray[i + 1] * 256;
    value = value >= 32768 ? value - 65536 : value;
    results.push(value);
  }

  return results;
}

/**
 * Does the amplitude in the sound data exceed the threshold (+/-)
 * at least threshold count times.
 * The default threshold aplitude and threshold count seem to work ok
 * with IVR speech and noisy customer audio (removes noise packets)
 * This is a simple approach that could be extended to support time windows
 * as speech does not align with sound data packets which are 125ms in lenghth
 */
module.exports.isHighAmplitide = (soundData, thresholdAmplitude = 2000, thresholdCount = 256) =>
{
  var count = 0;

  for (var i = 0; i < soundData.length; i++)
  {
    if (soundData[i] > thresholdAmplitude)
    {
      count++;
    }
    else if (soundData[i] < -thresholdAmplitude)
    {
      count++;
    }
  }

  return count >= thresholdCount;
}

/**
 * Noise has sum of amplitudes less than threshold
 */
module.exports.getSumSquares = (soundData) =>
{
  var sum = 0;

  for (var i = 0; i < soundData.length; i++)
  {
    const scaled = soundData[i] / 32768.0;
    sum += scaled * scaled;
  }

  return sum;
}

/**
 * Count the number of times the signal crosses zero
 * Human speech has a lower frequency than noise (cpro@)
 */
module.exports.getZeroCrossings = (soundData) =>
{
  var count = 0;

  for (var i = 0; i < soundData.length - 1; i++) 
  {
    // Check for a zero-crossing (change of sign)
    if ((soundData[i] >= 0 && soundData[i + 1] <  0) || 
        (soundData[i] <  0 && soundData[i + 1] >= 0)) 
    {
      count++;
    }
  }

  return count;
}
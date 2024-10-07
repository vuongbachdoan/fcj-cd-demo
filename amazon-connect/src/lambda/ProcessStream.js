'use strict';

const transcriptionUtils = require('../utils/TranscriptionUtils');

/**
 * Reads a message off SQS and transcribes the voice from voice channels, 
 * putting transcripts into DynamoDB
 */
module.exports.handler = async (event) => 
{
  try
  {
    console.info(JSON.stringify(event, null, 2));

    const requestEvent = JSON.parse(event.Records[0].body);

    await transcriptionUtils.transcribeStream(requestEvent.kvsStreamArn, 
        requestEvent.kvsStartFragment, 
        requestEvent.contactId,
        process.env.WHISPER_ENDPOINT);
  }
  catch (error)
  {
    console.error('Failed to process stream', error)
    throw error;
  }
};
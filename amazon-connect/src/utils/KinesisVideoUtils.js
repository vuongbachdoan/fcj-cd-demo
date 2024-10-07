'use strict';

const { KinesisVideoClient, GetDataEndpointCommand } = require('@aws-sdk/client-kinesis-video');
const { KinesisVideoMediaClient, GetMediaCommand } = require('@aws-sdk/client-kinesis-video-media');
const kinesisVideoClient = new KinesisVideoClient();

/**
 * Opens a GetmMedia stream to start reading from
 */
module.exports.openStream = async (streamArn, startFragment) =>
{
  try
  {
    const getDataEndpointCommand = new GetDataEndpointCommand(
    {
      StreamARN: streamArn,
      APIName: 'GET_MEDIA',
    });

    const dataEndpointResponse = await kinesisVideoClient.send(getDataEndpointCommand);

    console.info(`Found data end point: ${JSON.stringify(dataEndpointResponse.DataEndpoint)}`);

    const kvsMediaClient = new KinesisVideoMediaClient({
      endpoint: dataEndpointResponse.DataEndpoint
    });

    const getMediaCommand = new GetMediaCommand(
    {
      StreamARN: streamArn,
      StartSelector: 
      {
          StartSelectorType: 'FRAGMENT_NUMBER',
          AfterFragmentNumber: startFragment
      }
    });

    const getMediaResponse = await kvsMediaClient.send(getMediaCommand);

    return getMediaResponse.Payload;
  }
  catch (error)
  {
    console.error('Failed to get media stream', error);
    throw error;
  }
};

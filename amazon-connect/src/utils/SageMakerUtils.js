
const { SageMakerRuntimeClient, InvokeEndpointCommand } = require('@aws-sdk/client-sagemaker-runtime');
const client = new SageMakerRuntimeClient();

/**
 * Invoke a model with a fragment of raw audio returiung a JSON response
 */
module.exports.invokeTranscriptionEndpoint = async(endPointName, rawAudioBytes) =>
{
  try
  {
    // Wrap request as JSON base64 bytes
    const base64Audio = Buffer.from(rawAudioBytes).toString('base64');

    const request = {
      EndpointName: endPointName,
      ContentType: 'text/plain',
      Body: base64Audio
    };

    const invokeEndPointCommand = new InvokeEndpointCommand(request);
    const response = await client.send(invokeEndPointCommand);
    const asciiDecoder = new TextDecoder('ascii');
    return asciiDecoder.decode(response.Body);
  }
  catch (error)
  {
    console.error('Failed to invoke transcription end point', error);
    throw error;
  }
}
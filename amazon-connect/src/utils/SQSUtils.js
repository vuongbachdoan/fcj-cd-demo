'use strict';

const sqs = require('@aws-sdk/client-sqs');

const client = new sqs.SQSClient();

module.exports.sendMessage = async(queueUrl, message) =>
{
  try
  {
    const sendMessageCommand = new sqs.SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: message
    });
    await client.send(sendMessageCommand);
  }
  catch (error)
  {
    console.error('Failed to send message to SQS', error);
    throw error;
  }
};

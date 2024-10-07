'use strict';

const sqsUtils = require('../utils/SQSUtils');

/**
 * Send an SQS message
 */
module.exports.handler = async (event) =>
{
  try
  {
    const message = {
      kvsStreamArn: event.Details.Parameters.kvsStreamArn,
      kvsStartFragment: event.Details.Parameters.kvsStartFragment,
      contactId: event.Details.ContactData.ContactId
    };
    
    await sqsUtils.sendMessage(process.env.SQS_QUEUE_URL, JSON.stringify(message));
      
    return {
      success: true
    };

  }
  catch (error)
  {
    console.error('Failed to start streaming', error);
    throw error;
  }
};
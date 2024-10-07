
const dynamoUtils = require('../utils/DynamoUtils');

/**
 * A virtual agent that collects messages from DynamoDB
 * waiting for a response polling dynamo
 */
module.exports.handler = async (event) =>
{
  try
  {
    const startTime = new Date().getTime();
    const endTime = startTime + 3000;

    const contactId = event.Details.ContactData.ContactId;

    while (true)
    {
      const nextMessage = await dynamoUtils.getNextMessage(contactId);

      if (nextMessage !== undefined)
      {
        await dynamoUtils.deleteNextMessage(contactId);
        console.info(`Returning next message: ${JSON.stringify(nextMessage, null, 2)}`);
        return nextMessage;
      }

      const now = new Date().getTime();

      if (now < endTime)
      {
        await sleep(50);
      }
      else
      {
        console.info(`Did not get a response within time, returning a sleep response`)
        return {
          contactId: contactId,
          action: 'Sleep'
        };
      }
    }
  }
  catch (error)
  {
    console.error('Failed to fetch next message!', error);
    return {
      contactId: contactId,
      action: 'Error',
      cause: error.message
    };
  }
};

function sleep(millis)
{
  return new Promise((resolve) => setTimeout(resolve, millis));
}

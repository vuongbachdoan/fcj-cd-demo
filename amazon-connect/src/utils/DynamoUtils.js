'use strict';

const dynamodb = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const region = process.env.REGION;
const client = new dynamodb.DynamoDBClient({ region });

/**
 * Creates a new transcript item in DynamoDB
 */
module.exports.createTranscriptItem = async (request) =>
{
  try
  {
    const putItemCommand = new dynamodb.PutItemCommand({
      TableName: process.env.TRANSCRIPTS_TABLE,
      Item: {
        contactId: {
          S: request.contactId
        },
        transcriptId: {
          S: request.transcriptId
        },
        channel: {
          S: request.channel
        },
        content: {
          S: request.content
        },
        participant: {
          S: request.participant
        },
        startOffset: {
          N: '' + request.startOffset
        },
        endOffset: {
          N: '' + request.endOffset
        }
      }
    });

    // console.info(`Creating transcript with: ${JSON.stringify(putItemCommand, null, 2)}`);

    await client.send(putItemCommand);
  }
  catch (error)
  {
    console.error(`Failed to create transcript`, error);
    throw error;
  }
};

/**
 * Creates a message in dynamodb
 */
module.exports.createMessage = async (contactId, role, content) =>
{
  try
  {
    const putItemCommand = new dynamodb.PutItemCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: {
        contactId: {
          S: contactId
        },
        messageId:
        {
          S: uuidv4(),
        },  
        role: {
          S: role
        },
        content: {
          S: content
        },
        when: {
          N: '' + new Date().getTime()
        }
      }
    });

    await client.send(putItemCommand);
  }
  catch (error)
  {
    console.error(`Failed to create next message`, error);
    throw error;
  }
};


/**
 * Fetches all messages from DynamoDB
 */
module.exports.getAllMessages = async (contactId) =>
{
  try
  {
    const fetchCommand = new dynamodb.ExecuteStatementCommand({
      Statement: `SELECT * from "${process.env.MESSAGES_TABLE}" WHERE "contactId" = ?`,
      ConsistentRead: true,
      Parameters:
      [
        {
          S: contactId
        }
      ]
    });

    const response = await client.send(fetchCommand);

    const messages = [];

    if (response.Items)
    {
      for (var i = 0; i < response.Items.length; i++)
      {
        messages.push(makeMessage(response.Items[i]));
      }
    }

    messages.sort(function (m1, m2)
    {
      return m1.when - m2.when
    });

    const thinnedMessages = thinMessages(messages);

    console.info(JSON.stringify(thinnedMessages));

    return thinnedMessages;
  }
  catch (error)
  {
    console.error(`Failed to delete next message`, error);
    throw error;
  }
};

/**
 * Creates a next message in dynamodb
 */
module.exports.setNextMessage = async (contactId, action, thought, message) =>
{
  try
  {
    const putItemCommand = new dynamodb.PutItemCommand({
      TableName: process.env.NEXT_MESSAGE_TABLE,
      Item: {
        contactId: {
          S: contactId
        },
        action: {
          S: action
        },
        thought: {
          S: thought
        },
        message: {
          S: message
        }
      }
    });

    await client.send(putItemCommand);
  }
  catch (error)
  {
    console.error(`Failed to create next message`, error);
    throw error;
  }
};

/**
 * Deletes the next message from DynamoDB
 */
module.exports.deleteNextMessage = async (contactId) =>
{
  try
  {
    const deleteCommand = new dynamodb.ExecuteStatementCommand({
      Statement: `DELETE from "${process.env.NEXT_MESSAGE_TABLE}" WHERE "contactId" = ?`,
      Parameters:
      [
        {
          S: contactId
        }
      ]
    });

    await client.send(deleteCommand);
  }
  catch (error)
  {
    console.error(`Failed to delete next message`, error);
    throw error;
  }
};

/**
 * Fetches the next message from DynamoDB
 */
module.exports.getNextMessage = async (contactId) =>
{
  try
  {
    const fetchCommand = new dynamodb.ExecuteStatementCommand({
      Statement: `SELECT * from "${process.env.NEXT_MESSAGE_TABLE}" WHERE "contactId" = ?`,
      ConsistentRead: true,
      Parameters:
      [
        {
          S: contactId
        }
      ]
    });

    const response = await client.send(fetchCommand);

    if (response.Items && response.Items.length === 1)
    {
      return makeNextMessage(response.Items[0]);
    }

    return undefined;
  }
  catch (error)
  {
    console.error(`Failed to delete next message`, error);
    throw error;
  }
};

function makeNextMessage(item)
{
  return {
    contactId: item.contactId.S,
    action: item.action.S,
    thought: item.thought.S,
    message: item.message.S,
  }
}

function makeMessage(item)
{
  return {
    contactId: item.contactId.S,
    role: item.role.S,
    content: item.content.S,
    when: +item.when.N
  }
}

function thinMessages(messages)
{
  const thinned = [];

  messages.forEach(message => {
    thinned.push({
      role: message.role,
      content: message.content
    });
  });

  return thinned;
}
const readline = require('readline');
const bedrockUtils = require('./BedrockUtils');

const messages = [];

/**
 * Read user input from the CLI
 */
async function getUserInput(question) 
{
  const inputLine = readline.createInterface({
      input: process.stdin,
      output: process.stdout
  });

  return new Promise((resolve) => {
    inputLine.question(question, (answer) => {
      resolve(answer);
      inputLine.close();
    });
  });
}

async function main()
{
  console.info(`Hello and welcome to AnyCompany, how can I help you today?`);

  while (true)
  {
    const userInput = await getUserInput('> ');
    console.info(userInput);

    if (userInput.length === 0)
    {
      continue;
    }

    messages.push({
      role: 'user',
      content: `<Customer>${userInput}</Customer>`
    });
    
    const 
    {
      parsedResponse, rawResponse
    } = await bedrockUtils.invokeModel(messages);

    if (handleResponse(parsedResponse, messages))
    {
      messages.push({
        role: 'assistant',
        content: rawResponse
      });
    }
    else
    {
      // Purge fallback from the messages
      messages.pop();
    }
  }
}

/**
 * Handles a reponse, dropping fallback responses from memory
 */
function handleResponse(modelResponse, messages)
{
  const tool = modelResponse.Response?.Action?.Tool;

  if (!tool)
  {
    throw new Error('Missing tool in response');
  }

  switch (tool)
  {
    case 'Fallback':
    {
      const thought = modelResponse.Response?.Thought;
      
      if (thought)
      {
        console.info(`Thought: ${thought}`);
      }

      const arg = modelResponse.Response?.Action?.Argument;

      if (arg)
      {
        console.info(arg);
      }

      return false;
    }
    case 'Agent':
    {
      const thought = modelResponse.Response?.Thought;
      
      if (thought)
      {
        console.info(`Thought: ${thought}`);
      }

      const arg = modelResponse.Response?.Action?.Argument;

      if (arg)
      {
        console.info(arg);
      }

      console.info('Let me get a human to help you with that');
      process.exit(0);
    }
    case 'Done':
    {
      const arg = modelResponse.Response?.Action?.Argument;

      if (arg)
      {
        console.info(arg);
      }
      process.exit(0);
    }
    default:
    {
      const thought = modelResponse.Response?.Thought;
      
      if (thought)
      {
        console.info(`Thought: ${thought}`);
      }

      const arg = modelResponse.Response?.Action?.Argument;

      if (arg)
      {
        console.info(arg);
      }

      return true;
    }
  }
}

main();
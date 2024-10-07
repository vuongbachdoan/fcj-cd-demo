# Building a Call Center with Amazon Bedrock Assistant and Whisper for Voice-to-Text

This guide provides step-by-step instructions to create a call center solution that integrates Amazon Bedrock as an AI assistant and uses OpenAI's Whisper model for real-time voice-to-text transcription. The implementation will utilize Amazon SageMaker to deploy Whisper and Amazon Bedrock to enhance the interaction with AI-driven responses.

## Prerequisites

Before getting started, ensure you have the following:

- An AWS account with access to Amazon SageMaker, Amazon S3, and Amazon Bedrock.
- Basic knowledge of Python and familiarity with AWS services.
- [AWS CLI](https://aws.amazon.com/cli/) and [SageMaker Studio](https://aws.amazon.com/sagemaker/studio/) set up on your machine.

## Architecture Overview

![Architecture](https://github.com/vuongbachdoan/PRSV24-HACKATHON-GENAI/blob/main/call_center/call_system_architecture.png?raw=true)

## Setup Instructions

### Step 0: Setup Local Environment

Configure your AWS CLI profile:

```bash
aws configure
```

Create the following script:

```bash
./scripts/create_deployment_bucket.sh dev
```

### Step 1: Create Whisper Endpoint

To run the example in this repository, navigate to the [notebook](./whisper-inference-deploy.ipynb). This notebook can be run end-to-end in [SageMaker Studio](https://aws.amazon.com/sagemaker/studio/). We recommend using Python 3 (Data Science 3.0) with Python 3.10, and a `ml.m5.large` instance inside of SageMaker Studio to run the notebook. Running through the notebook, you will be able to:

1. Save a serialized Whisper model to Amazon S3.
2. Create a SageMaker model object from this serialized model.
3. Deploy a SageMaker real-time endpoint with a custom script for audio-to-text transcription.
4. Send in audio signals in real-time for transcription.
5. Delete the SageMaker endpoint.

### Step 2: Deploy Lambda Functions

Follow these steps to deploy Lambda functions using the script located in `/scripts/serverless_deploy.sh`:

1. **Open your terminal.**
2. **Add Whisper endpoint to your function:**

   ```bash
   nano ./env/dev.sh

   export whisperEndPoint="your_whisper_endpoint_here"
   ```

3. **Run the deployment script:**

   ```bash
   ./scripts/serverless_deploy.sh
   ```

4. **Verify the deployment in the AWS Console** to confirm that the Lambda functions are properly deployed. You will see the following information in the terminal:

   ```bash
   functions:
   startstreaming: dev-connectvoice-start-streaming (11 MB)
   processstream: dev-connectvoice-process-stream (11 MB)
   virtualagent: dev-connectvoice-virtual-agent (11 MB)
   ```

### Step 3: Create Amazon Connect Instance

Here are the concise steps to create an Amazon Connect instance:

1. **Go to Amazon Connect Console:**  
   Open the [Amazon Connect Console](https://console.aws.amazon.com/connect/home) and click **"Create an instance."**

2. **Identity Management:**  
   Choose how to manage users (Amazon Connect or SAML 2.0), then click **"Next."**

3. **Instance Alias:**  
   Enter a unique alias for your instance and click **"Next."**

4. **Admin Account:**  
   Create an administrator account and click **"Next."**

5. **Telephony Options:**  
   Enable inbound/outbound calls and chat if needed, then click **"Next."**

6. **Data Storage:**  
   Select the S3 bucket for storing data and click **"Next."**

7. **Review and Create:**  
   Review your settings and click **"Create instance."**

8. **Access Instance:**  
   Once ready, click the instance URL and sign in with the admin credentials.

### Step 4: Create Call Center Flow

Copy the `0001 - Live agent.json` from the `contact_flow` directory to use the pre-defined flow.

### Step 5: Modify the Call Center Flow



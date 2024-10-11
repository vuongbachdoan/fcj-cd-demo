
# First Cloud Journey Cloud Day - Generative AI Call Center
  
This guide provides step-by-step instructions to create a call center solution that integrates Amazon Bedrock as an AI assistant and uses OpenAI's Whisper model for real-time voice-to-text transcription. The implementation will utilize Amazon SageMaker to deploy Whisper and Amazon Bedrock to enhance the interaction with AI-driven responses.

  
## Prerequisites
  
Before getting started, ensure you have the following:

  

- An AWS account with access to:
	- Amazon Connect 
	- Kinesis Video Stream
	- Bedrock
	- SQS
	- Lambda
	- SageMaker
	- DynamoDB

- Basic knowledge of Python, Jupiter Notebook and familiarity with AWS services.

- [AWS CLI](https://aws.amazon.com/cli/) and [SageMaker Studio](https://aws.amazon.com/sagemaker/studio/) set up on your machine.

## Architecture Overview

![Architecture](https://github.com/vuongbachdoan/PRSV24-HACKATHON-GENAI/blob/main/call_center/call_system_architecture.png?raw=true)
  

## Setup Instructions

#### Step 1: Create Whisper Endpoint

> **About Whisper** - The Whisper endpoint is a powerful tool for speech recognition, offering extensive capabilities for transcription and understanding spoken language across various applications. It leverages advanced machine learning techniques to deliver accurate and efficient transcriptions.

##### How it Works

The Jupyter notebook deploys a SageMaker endpoint with a custom inference script similar to this [example in the SageMaker SDK documentation](https://sagemaker-examples.readthedocs.io/en/latest/introduction_to_amazon_algorithms/xgboost_abalone/xgboost_inferenece_script_mode.html). The components required to deploy a pre-trained model to an endpoint in SageMaker are 1) a serialized model artifact (tar file) in Amazon S3 and 2) the code and requirements which runs inference. These components are then packaged into a SageMaker endpoint which serves the serialized model with custom code behind as an API. See the architecture below for a visual description.

![arch](https://github.com/vuongbachdoan/fcj-cd-demo/blob/main/whisper/imgs/endpoint-arch.png?raw=true)


##### Setup SageMaker notebook

- Navigate to  [SageMaker dashboard](https://us-west-2.console.aws.amazon.com/sagemaker)
- Jump to **Application and IDEs** > **Notebooks** at left sidebar.
- Click Create notebook instance and complete with following configurations:
    - For Notebook instance name enter any unique name.
    - For Notebook instance type choose **ml.m5.2xlarge**.
    - Expand the Additional configuration > Set the Volume size in GB to **10GB**.
    - Leave other fields to default.
- When Status of Notebook instance change to **Inservice** then you can using the instance.
- Next, **Open JupiterLab** to run our notebook.

##### Run Notebook

- Navigate to `/whisper` folder in our current repository.
- Copy all files and folder, upload to current notebook, and run notebook.
- I recommend you run every cell one-by-one.
- Folder structure will look like this

![Folder notebook](https://github.com/vuongbachdoan/fcj-cd-demo/blob/main/whisper/imgs/notebook.png?raw=true)

> You will got endpoint named **whisper-endpoint** under **Inference** > **Endpoints**

#### Step 2: Deploy Lambda function

##### Navigate to `/amazon-connect` under current repository

##### Run following command in your local computer:

```bash
aws configure
```
Then enter your AWS Access Key ID, AWS Secret Access Key, Default region name (**us-west-2**)

```bash
git clone https://github.com/vuongbachdoan/fcj-cd-demo.git

cd amazon-connect

cat << EOF > .env
WHISPER_ENDPOINT="whisper-endpoint"
EOF
```

Execute this script once:

    ./scripts/create_deployment_bucket.sh dev

To deploy execute this script as often as required:

    ./scripts/serverless_deploy.sh dev

Set up a contact flow that starts media streaming and passes the following parameters to the ProcessStream Lambda:

    kvsStreamArn: the stream arn from the contact attribute in Connect
    kvsStartFragment: the kvs start fragment number from the contact attribute in Connect

You need to add any lambda functions used to the Amazon Connect instance

ContactId is fetched from the standard request attribute (you may prefer initial contact id):

    event.Details.ContactData.ContactId

This should start populating an IVR real time transcript into DynamoDB.

**Enable KVS media streaming in your Amazon Connect** instance and set a sane retention period for (KVS 24 hours minimum during testing)

![KVS Enable](https://github.com/vuongbachdoan/fcj-cd-demo/blob/main/amazon-connect/doc/enable_kvs.png?raw=true)

#### Step 3: Set-up Amazon Connect Flow

- Access Amazon Connect instance with account and password.
- Create a Flows with template under `amazon-connect/contact_flow/prsv-aws-connect-flow.json`
- Claim a phone number (`Phone numbers > Voice > Toll free > Choose the flow you imported previously`)
- Done, call to your contact center now.

## 🎉 Congratulations! 🎉

In this workshop, you have learned how to implement a call center using Amazon Connect and Generative AI. You’ve gained valuable insights into setting up efficient customer support systems that leverage cutting-edge technology to enhance user experience.

Feel free to ask me any question about this solution, [Linked Profile](https://www.linkedin.com/in/vuongbd2007/)


# Amazon Connect Real Time Transcription using Whisper in the IVR

## Installation

Customise env/dev.sh with your target region, account number and whisper end point. Pay attention to the AWS Profile name, if deploying and testing from the command line.

Change the stage and rename to env/<stage>.sh to deploy to a new stage environment.

Execute this script once:

    ./scripts/create_deployment_bucket.sh <stage>

To deploy execute this script as often as required:

    ./scripts/serverless_deploy.sh <stage>

Set up a contact flow that starts media streaming and passes the following parameters to the ProcessStream Lambda:

    kvsStreamArn: the stream arn from the contact attribute in Connect
    kvsStartFragment: the kvs start fragment number from the contact attribute in Connect

You need to add any lambda functions used to the Amazon Connect instance

ContactId is fetched from the standard request attribute (you may prefer initial contact id):

    event.Details.ContactData.ContactId

This should start populating an IVR real time transcript into DynamoDB.

Enable KVS media streaming in your Connect instance and set a sane retention period for (KVS 24 hours minimum during testing)

## Authors

Authors are cpro@amazon.com and jospas@amazon.com

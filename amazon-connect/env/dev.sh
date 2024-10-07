#!/bin/bash

# Change to test, uat, prod etc
export stage=dev

# Should not need to change
export service=connectvoice

# Target AWS deployment region
export region=us-west-2

# Bedrock region
export bedrockRegion=us-west-2

export AWS_REGION=$region

export DISABLE_AWS_PROFILE=true

# Use named AWS profile unless it is specifically disabled
if [ -z "$DISABLE_AWS_PROFILE" ]; then
  export profile=duthiee1
  export AWS_PROFILE=$profile

  echo "Enabled AWS_PROFILE = $AWS_PROFILE"
fi

# AWS account number
export accountNumber=$(aws sts get-caller-identity --query Account --output text)

# Whisper V3
export whisperEndPoint=whisper-endpoint

# S3 bucket to upload deployment assets to
export deploymentBucket="${stage}-${service}-deployment-${accountNumber}"

echo "Exported $stage"

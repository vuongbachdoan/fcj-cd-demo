#!/bin/bash

set -e

date

source ./env/$1.sh

echo "Deploying ConnectVoice to $stage"

./scripts/check_aws_account.sh

# Install required packages
npm install

echo 'Commencing full deploy...'

npx serverless deploy

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BidFlowStack } from '../lib/bidflow-stack';

const app = new cdk.App();
new BidFlowStack(app, 'BidFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'BidFlow - Agentic AI SaaS RFP Proposal Generator',
});

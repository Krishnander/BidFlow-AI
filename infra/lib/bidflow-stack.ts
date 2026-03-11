import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class BidFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for company documents
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: 'bidflow-documents',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: false,
    });

    // DynamoDB Table for run history and artifacts
    const stateTable = new dynamodb.Table(this, 'StateTable', {
      tableName: 'BidProjectState',
      partitionKey: { name: 'project_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: false,
    });

    // Lambda Function for agent orchestration
    const orchestratorFn = new lambda.Function(this, 'OrchestratorFunction', {
      functionName: 'AgentOrchestrator',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/src'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        REGION: 'us-east-1',
        TABLE_NAME: stateTable.tableName,
        BUCKET_NAME: documentsBucket.bucketName,
        KNOWLEDGE_BASE_ID: 'PLACEHOLDER',
        CLAUDE_MODEL_ID: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        NOVA_LITE_MODEL_ID: 'amazon.nova-lite-v1:0',
      },
    });

    // Grant DynamoDB permissions
    stateTable.grantReadWriteData(orchestratorFn);

    // Grant S3 permissions
    documentsBucket.grantReadWrite(orchestratorFn);

    // Grant Bedrock model invocation permissions
    orchestratorFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
        `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0`,
      ],
    }));

    // Grant Bedrock Knowledge Base retrieve permissions
    orchestratorFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agent-runtime:Retrieve'],
      resources: ['*'],
    }));

    // API Gateway HTTP API
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'BidFlowApi',
      description: 'BidFlow RFP Generator API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration
    const integration = new apigatewayv2_integrations.HttpLambdaIntegration(
      'OrchestratorIntegration',
      orchestratorFn
    );

    // POST /run route
    httpApi.addRoutes({
      path: '/run',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // GET /runs route
    httpApi.addRoutes({
      path: '/runs',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.url!,
      description: 'API Gateway URL for BidFlow',
      exportName: 'BidFlowApiUrl',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: documentsBucket.bucketName,
      description: 'S3 bucket for company documents',
      exportName: 'BidFlowBucketName',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: stateTable.tableName,
      description: 'DynamoDB table for run history',
      exportName: 'BidFlowTableName',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: orchestratorFn.functionName,
      description: 'Lambda function name',
      exportName: 'BidFlowLambdaName',
    });
  }
}

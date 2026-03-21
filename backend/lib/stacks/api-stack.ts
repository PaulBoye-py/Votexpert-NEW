import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as path from 'path'
import { Construct } from 'constructs'
import { DatabaseStack } from './database-stack'
import { AuthStack } from './auth-stack'

interface ApiStackProps extends cdk.StackProps {
  db: DatabaseStack
  auth: AuthStack
  wsCallbackUrl: string
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const { db, auth } = props

    // ─── Media S3 bucket (candidate photos) ──────────────────────────────────
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `votexpert-media-${this.account}`,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
      removalPolicy: this.node.tryGetContext('env') === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: this.node.tryGetContext('env') !== 'prod',
    })

    // ─── Single monolithic Lambda ─────────────────────────────────────────────
    // All API routes handled by one Express app inside one Lambda.
    // 512MB gives plenty of headroom; timeout is 30s (API Gateway max is 29s).
    const apiFn = new lambdaNode.NodejsFunction(this, 'ApiFn', {
      functionName: 'votexpert-api',
      entry: path.join(__dirname, '../../src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      environment: {
        NODE_ENV: this.node.tryGetContext('env') ?? 'dev',
        ORGS_TABLE: db.orgsTable.tableName,
        ELECTIONS_TABLE: db.electionsTable.tableName,
        POSITIONS_TABLE: db.positionsTable.tableName,
        CANDIDATES_TABLE: db.candidatesTable.tableName,
        VOTE_SESSIONS_TABLE: db.voteSessionsTable.tableName,
        VOTERS_TABLE: db.votersTable.tableName,
        VOTES_TABLE: db.votesTable.tableName,
        VOTE_COUNTS_TABLE: db.voteCountsTable.tableName,
        WS_CONNECTIONS_TABLE: db.wsConnectionsTable.tableName,
        LOBBY_PARTICIPANTS_TABLE: db.lobbyParticipantsTable.tableName,
        USER_POOL_ID: auth.userPoolId,
        WS_API_ENDPOINT: props.wsCallbackUrl,
        APP_URL: process.env.APP_URL ?? 'http://localhost:5173',
        SMTP_HOST: process.env.SMTP_HOST ?? '',
        SMTP_PORT: process.env.SMTP_PORT ?? '2525',
        SMTP_USER: process.env.SMTP_USER ?? '',
        SMTP_PASS: process.env.SMTP_PASS ?? '',
        EMAIL_FROM: process.env.EMAIL_FROM ?? 'noreply@votexpert.com',
        UPLOADS_BUCKET: mediaBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        // AWS SDK v3 is available in the Lambda runtime — no need to bundle it
        externalModules: ['@aws-sdk/*'],
      },
    })

    // ─── Grant DynamoDB access ────────────────────────────────────────────────
    db.orgsTable.grantReadWriteData(apiFn)
    db.electionsTable.grantReadWriteData(apiFn)
    db.positionsTable.grantReadWriteData(apiFn)
    db.candidatesTable.grantReadWriteData(apiFn)
    db.voteSessionsTable.grantReadWriteData(apiFn)
    db.votersTable.grantReadWriteData(apiFn)
    db.votesTable.grantReadWriteData(apiFn)
    db.voteCountsTable.grantReadWriteData(apiFn)
    db.wsConnectionsTable.grantReadWriteData(apiFn)
    db.lobbyParticipantsTable.grantReadWriteData(apiFn)

    // ─── Grant S3 access (presigned URLs + public read) ───────────────────────
    mediaBucket.grantPut(apiFn)

    // ─── Grant WebSocket broadcast permission ─────────────────────────────────
    apiFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*`],
    }))

    // ─── API Gateway (proxy everything to the single Lambda) ──────────────────
    // LambdaRestApi with proxy:true creates a {proxy+} resource that forwards
    // all methods and paths to the Lambda. Express handles routing internally.
    const api = new apigateway.LambdaRestApi(this, 'VotexpertApi', {
      restApiName: 'votexpert-api',
      description: 'VoteXpert REST API',
      handler: apiFn,
      proxy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
      },
      deployOptions: {
        stageName: this.node.tryGetContext('env') ?? 'dev',
        tracingEnabled: true,
      },
    })

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: 'VotexpertApiUrl',
    })
  }
}

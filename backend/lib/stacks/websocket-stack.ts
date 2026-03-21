import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayv2integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'
import { Construct } from 'constructs'
import { DatabaseStack } from './database-stack'

interface WebSocketStackProps extends cdk.StackProps {
  db: DatabaseStack
}

export class WebSocketStack extends cdk.Stack {
  // Expose the endpoint so ApiStack can pass it to Lambda environment vars
  public readonly apiEndpoint: string
  public readonly wsApi: apigatewayv2.WebSocketApi

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props)

    const { db } = props

    const sharedEnv = {
      WS_CONNECTIONS_TABLE: db.wsConnectionsTable.tableName,
      ELECTIONS_TABLE: db.electionsTable.tableName,
      VOTE_COUNTS_TABLE: db.voteCountsTable.tableName,
      POSITIONS_TABLE: db.positionsTable.tableName,
      CANDIDATES_TABLE: db.candidatesTable.tableName,
    }

    const bundling = { minify: true, sourceMap: true, externalModules: ['@aws-sdk/*'] }

    // ─── Lambda Handlers ──────────────────────────────────────────────────────

    // $connect — called when a client opens a WebSocket connection.
    // Stores the connection_id + election_id in DynamoDB.
    // election_id is passed as a query param: wss://...?electionId=xxx
    const connectFn = new lambdaNode.NodejsFunction(this, 'WsConnectFn', {
      functionName: 'votexpert-ws-connect',
      entry: path.join(__dirname, '../../src/functions/websocket/connect.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      environment: sharedEnv,
      bundling,
    })

    // $disconnect — called when a client closes the connection.
    // Removes the connection record from DynamoDB.
    const disconnectFn = new lambdaNode.NodejsFunction(this, 'WsDisconnectFn', {
      functionName: 'votexpert-ws-disconnect',
      entry: path.join(__dirname, '../../src/functions/websocket/disconnect.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      environment: sharedEnv,
      bundling,
    })

    // $default — fallback for any unrecognised route
    const defaultFn = new lambdaNode.NodejsFunction(this, 'WsDefaultFn', {
      functionName: 'votexpert-ws-default',
      entry: path.join(__dirname, '../../src/functions/websocket/default.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(5),
      environment: sharedEnv,
      bundling,
    })

    // ─── WebSocket API ────────────────────────────────────────────────────────
    this.wsApi = new apigatewayv2.WebSocketApi(this, 'VotexpertWsApi', {
      apiName: 'votexpert-ws',
      description: 'VoteXpert real-time voting WebSocket API',
      connectRouteOptions: {
        integration: new apigatewayv2integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          connectFn
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          disconnectFn
        ),
      },
      defaultRouteOptions: {
        integration: new apigatewayv2integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          defaultFn
        ),
      },
    })

    // ─── Stage ────────────────────────────────────────────────────────────────
    const wsStage = new apigatewayv2.WebSocketStage(this, 'WsStage', {
      webSocketApi: this.wsApi,
      stageName: this.node.tryGetContext('env') ?? 'dev',
      autoDeploy: true,
    })

    // The endpoint used by Lambda to push messages back to connected clients
    // Format: https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
    this.apiEndpoint = wsStage.callbackUrl

    // ─── Permissions ─────────────────────────────────────────────────────────
    db.wsConnectionsTable.grantReadWriteData(connectFn)
    db.wsConnectionsTable.grantReadWriteData(disconnectFn)

    // Allow all Lambdas that broadcast (cast-vote, start-election, end-election)
    // to post messages to connected WebSocket clients.
    // We export this policy so ApiStack Lambdas can use it.
    const broadcastPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/*`,
      ],
    })

    // Grant connect/disconnect functions access to broadcast (not needed but clean)
    connectFn.addToRolePolicy(broadcastPolicy)
    disconnectFn.addToRolePolicy(broadcastPolicy)

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'WsApiEndpoint', {
      value: wsStage.url,
      description: 'WebSocket connection URL (clients connect to this)',
      exportName: 'VotexpertWsApiEndpoint',
    })
    new cdk.CfnOutput(this, 'WsCallbackUrl', {
      value: wsStage.callbackUrl,
      description: 'Callback URL used by Lambdas to push messages to clients',
      exportName: 'VotexpertWsCallbackUrl',
    })
  }
}

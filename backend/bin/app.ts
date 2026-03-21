#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { DatabaseStack } from '../lib/stacks/database-stack'
import { AuthStack } from '../lib/stacks/auth-stack'
import { WebSocketStack } from '../lib/stacks/websocket-stack'
import { ApiStack } from '../lib/stacks/api-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
}

// ─── Stack 1: Database ────────────────────────────────────────────────────────
// All DynamoDB tables. No dependencies on other stacks.
const db = new DatabaseStack(app, 'VotexpertDatabaseStack', { env })

// ─── Stack 2: Auth ────────────────────────────────────────────────────────────
// Cognito User Pool + post-confirmation Lambda that writes to Orgs table.
const auth = new AuthStack(app, 'VotexpertAuthStack', { env, db })
auth.addDependency(db)

// ─── Stack 3: WebSocket ───────────────────────────────────────────────────────
// API Gateway WebSocket API for real-time vote broadcasting.
// Must be deployed before ApiStack so we have the WS endpoint URL.
const ws = new WebSocketStack(app, 'VotexpertWebSocketStack', { env, db })
ws.addDependency(db)

// ─── Stack 4: REST API ────────────────────────────────────────────────────────
// All REST API routes + Lambda functions. Depends on all other stacks.
const api = new ApiStack(app, 'VotexpertApiStack', {
  env,
  db,
  auth,
  wsCallbackUrl: ws.apiEndpoint,
})
api.addDependency(db)
api.addDependency(auth)
api.addDependency(ws)

cdk.Tags.of(app).add('Project', 'VoteXpert')
cdk.Tags.of(app).add('Environment', app.node.tryGetContext('env') ?? 'dev')

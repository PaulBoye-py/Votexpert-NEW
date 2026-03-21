import serverlessExpress from '@vendia/serverless-express'
import { app } from './app'

// Wraps the Express app for AWS Lambda + API Gateway proxy integration.
// @vendia/serverless-express translates API Gateway events into Express
// req/res objects and back — transparent to the route handlers.
export const handler = serverlessExpress({ app })

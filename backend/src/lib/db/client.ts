import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

export const db = DynamoDBDocumentClient.from(raw, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
})

// Table names from environment (set by CDK stack)
export const Tables = {
  ORGS: process.env.ORGS_TABLE!,
  ELECTIONS: process.env.ELECTIONS_TABLE!,
  POSITIONS: process.env.POSITIONS_TABLE!,
  CANDIDATES: process.env.CANDIDATES_TABLE!,
  VOTE_SESSIONS: process.env.VOTE_SESSIONS_TABLE!,
  VOTERS: process.env.VOTERS_TABLE!,
  VOTES: process.env.VOTES_TABLE!,
  VOTE_COUNTS: process.env.VOTE_COUNTS_TABLE!,
  WS_CONNECTIONS: process.env.WS_CONNECTIONS_TABLE!,
  LOBBY_PARTICIPANTS: process.env.LOBBY_PARTICIPANTS_TABLE!,
  ORG_VOTERS: process.env.ORG_VOTERS_TABLE!,
}

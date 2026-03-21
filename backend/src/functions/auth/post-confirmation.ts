import { PostConfirmationTriggerEvent } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { Org } from '../../types'

// Triggered by Cognito after a user confirms their email OTP.
// Creates the Org record in DynamoDB.
export async function handler(event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> {
  const { sub, email, name, 'custom:org_name': orgName } = event.request.userAttributes

  const org: Org = {
    org_id: uuid(),
    name: orgName ?? name ?? email,
    email,
    cognito_user_id: sub,
    created_at: new Date().toISOString(),
  }

  await db.send(
    new PutCommand({
      TableName: Tables.ORGS,
      Item: org,
      ConditionExpression: 'attribute_not_exists(org_id)',
    })
  )

  console.log(`[PostConfirmation] Created org for user ${sub}: ${org.org_id}`)

  // Must return the event back to Cognito
  return event
}

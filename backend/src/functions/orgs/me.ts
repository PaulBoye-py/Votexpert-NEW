import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { getRequestOrg } from '../../lib/auth/middleware'
import { notFound, ok, serverError, unauthorized } from '../../lib/utils/response'

// GET /orgs/me — returns the authenticated org's profile
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    return ok(org)
  } catch (err) {
    return serverError(err)
  }
}

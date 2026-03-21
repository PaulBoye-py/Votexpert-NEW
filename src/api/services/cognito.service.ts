/**
 * Direct Cognito API calls (no backend proxy needed).
 * All calls go to the Cognito endpoint with X-Amz-Target header.
 */
import axios from 'axios';
import { COGNITO_CLIENT_ID, COGNITO_ENDPOINT } from '@/lib/constants';
import type { CognitoAuthResult } from '@/types';

const cognitoClient = axios.create({
  baseURL: COGNITO_ENDPOINT,
  headers: { 'Content-Type': 'application/x-amz-json-1.1' },
});

function cognitoCall<T>(target: string, body: Record<string, unknown>): Promise<T> {
  return cognitoClient
    .post<T>('', body, { headers: { 'X-Amz-Target': target } })
    .then((r) => r.data)
    .catch((err) => {
      const data = err.response?.data;
      if (data) console.error('[Cognito]', data.__type, data.message || data.Message);
      const message =
        data?.message ||
        data?.Message ||
        err.message ||
        'Cognito error';
      throw new Error(message);
    });
}

export async function cognitoSignUp(
  email: string,
  password: string,
  name: string,
  orgName: string
): Promise<void> {
  await cognitoCall(
    'AWSCognitoIdentityProviderService.SignUp',
    {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'custom:org_name', Value: orgName },
      ],
    }
  );
}

export async function cognitoConfirmSignUp(
  email: string,
  code: string
): Promise<void> {
  await cognitoCall(
    'AWSCognitoIdentityProviderService.ConfirmSignUp',
    {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }
  );
}

export async function cognitoSignIn(
  email: string,
  password: string
): Promise<CognitoAuthResult> {
  const data = await cognitoCall<{ AuthenticationResult: CognitoAuthResult }>(
    'AWSCognitoIdentityProviderService.InitiateAuth',
    {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }
  );
  return data.AuthenticationResult;
}

export async function cognitoRefreshToken(
  refreshToken: string
): Promise<CognitoAuthResult> {
  const data = await cognitoCall<{ AuthenticationResult: CognitoAuthResult }>(
    'AWSCognitoIdentityProviderService.InitiateAuth',
    {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }
  );
  return data.AuthenticationResult;
}

export async function cognitoForgotPassword(email: string): Promise<void> {
  await cognitoCall(
    'AWSCognitoIdentityProviderService.ForgotPassword',
    { ClientId: COGNITO_CLIENT_ID, Username: email }
  );
}

export async function cognitoConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await cognitoCall(
    'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
    {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }
  );
}

export async function cognitoResendCode(email: string): Promise<void> {
  await cognitoCall(
    'AWSCognitoIdentityProviderService.ResendConfirmationCode',
    { ClientId: COGNITO_CLIENT_ID, Username: email }
  );
}

/** Decode Cognito IdToken (JWT) payload without verifying signature */
export function decodeIdToken(idToken: string): {
  sub: string;
  email: string;
  name?: string;
  'custom:org_name'?: string;
} | null {
  try {
    const payload = idToken.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as path from 'path'
import { Construct } from 'constructs'
import { DatabaseStack } from './database-stack'

interface AuthStackProps extends cdk.StackProps {
  db: DatabaseStack
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly userPoolId: string
  public readonly userPoolClientId: string

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props)

    // ─── Post-Confirmation Lambda ─────────────────────────────────────────────
    // Triggered by Cognito after a user confirms their email OTP.
    // Creates the Org record in DynamoDB using the Cognito user's attributes.
    const postConfirmationFn = new lambdaNode.NodejsFunction(this, 'PostConfirmationFn', {
      functionName: 'votexpert-auth-post-confirmation',
      entry: path.join(__dirname, '../../src/functions/auth/post-confirmation.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ORGS_TABLE: props.db.orgsTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    })

    // Grant the Lambda write access to the Orgs table
    props.db.orgsTable.grantWriteData(postConfirmationFn)

    // ─── Cognito User Pool ────────────────────────────────────────────────────
    // This pool is exclusively for org admins.
    // Voters do NOT have Cognito accounts — they authenticate via:
    //   - Open elections:  anonymous session token (no auth)
    //   - Closed elections: unique invite link token
    this.userPool = new cognito.UserPool(this, 'VotexpertUserPool', {
      userPoolName: 'votexpert-orgs',

      // Sign-in with email only
      signInAliases: { email: true },
      signInCaseSensitive: false,

      // Email OTP verification on signup (this IS the email confirmation step)
      selfSignUpEnabled: true,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
        emailSubject: 'Verify your VoteXpert account',
        emailBody: `
          <h2>Welcome to VoteXpert</h2>
          <p>Your verification code is: <strong>{####}</strong></p>
          <p>This code expires in 24 hours.</p>
        `,
      },

      // Required attributes collected at signup
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },

      // Custom attribute: org name
      customAttributes: {
        org_name: new cognito.StringAttribute({ mutable: true }),
      },

      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },

      // Account recovery via email
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Auto-verify email (required for email OTP to work)
      autoVerify: { email: true },

      // Trigger: create Org record in DynamoDB after email confirmed
      lambdaTriggers: {
        postConfirmation: postConfirmationFn,
      },

      removalPolicy: this.node.tryGetContext('env') === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    })

    // ─── User Pool Client ─────────────────────────────────────────────────────
    // The frontend uses this client to interact with Cognito (signup, login, etc.)
    this.userPoolClient = this.userPool.addClient('VotexpertWebClient', {
      userPoolClientName: 'votexpert-web',

      // Auth flows: SRP for secure password auth, USER_PASSWORD for simplicity
      authFlows: {
        userSrp: true,
        userPassword: true,
      },

      // Explicitly grant write access to standard + custom attributes.
      // Without this, Cognito rejects SignUp calls that include custom:org_name.
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ fullname: true, email: true })
        .withCustomAttributes('org_name'),

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Public client — no client secret (frontend app)
      generateSecret: false,

      // No OAuth — using direct Cognito SDK auth flows only
      disableOAuth: true,
    })

    this.userPoolId = this.userPool.userPoolId
    this.userPoolClientId = this.userPoolClient.userPoolClientId

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'VotexpertUserPoolId',
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'VotexpertUserPoolClientId',
    })
    new cdk.CfnOutput(this, 'UserPoolRegion', {
      value: this.region,
      exportName: 'VotexpertUserPoolRegion',
    })
  }
}

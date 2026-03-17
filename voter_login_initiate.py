import json
import boto3
import random
import os
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
voters_table = dynamodb.Table('voting-voters')

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'chovweprince@gmail.com')

def generate_otp():
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

def lambda_handler(event, context):
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        voter_id = body.get('voter_id')
        email = body.get('email')

        if not voter_id or not email:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST'
                },
                'body': json.dumps({'success': False, 'message': 'Voter ID and email are required'})
            }

        # Find voter by voter_id (need to scan since voter_id is range key)
        response = voters_table.scan(
            FilterExpression='voter_id = :vid AND email = :email',
            ExpressionAttributeValues={
                ':vid': voter_id,
                ':email': email
            }
        )

        items = response.get('Items', [])
        if not items:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST'
                },
                'body': json.dumps({'success': False, 'message': 'Invalid voter credentials'})
            }

        voter = items[0]
        election_id = voter.get('election_id')

        # Check if already voted
        if voter.get('has_voted', False):
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST'
                },
                'body': json.dumps({'success': False, 'message': 'You have already voted in this election'})
            }

        # Generate OTP
        otp = generate_otp()
        otp_expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

        # Store OTP in voter record
        voters_table.update_item(
            Key={
                'election_id': election_id,
                'voter_id': voter_id
            },
            UpdateExpression='SET otp = :otp, otp_expiry = :expiry',
            ExpressionAttributeValues={
                ':otp': otp,
                ':expiry': otp_expiry
            }
        )

        # Send OTP via email
        voter_name = voter.get('name', 'Voter')

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">VoteXpert - Login Verification</h2>
                <p>Dear {voter_name},</p>
                <p>Your one-time password (OTP) for voter login is:</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">{otp}</span>
                </div>
                <p>This OTP is valid for <strong>10 minutes</strong>.</p>
                <p>If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 12px;">
                    This is an automated message from VoteXpert Secure E-Voting Platform.
                </p>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        VoteXpert - Login Verification

        Dear {voter_name},

        Your one-time password (OTP) for voter login is: {otp}

        This OTP is valid for 10 minutes.

        If you did not request this, please ignore this email.
        """

        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': 'VoteXpert - Your Login OTP', 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
        )

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({
                'success': True,
                'message': 'OTP sent to your email',
                'election_id': election_id,
                'voter_id': voter_id
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({'success': False, 'message': str(e)})
        }

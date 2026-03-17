import json
import boto3
import csv
import uuid
import os
from io import StringIO

s3 = boto3.client('s3')
ses = boto3.client('ses')
dynamodb = boto3.resource('dynamodb')
voters_table = dynamodb.Table('voting-voters')
elections_table = dynamodb.Table('voting-elections')

# Environment variables
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@votexpert.com')
LOGIN_URL = os.environ.get('LOGIN_URL', 'https://votexpert.com/voter/login')

def send_voter_email(voter_email, voter_name, voter_id, election_name):
    """Send email to voter with login credentials"""
    try:
        subject = f"You have been registered to vote in: {election_name}"

        html_body = f"""
        <html>
        <head></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">VoteXpert - Voter Registration</h2>
                <p>Dear {voter_name},</p>
                <p>You have been registered as a voter for the following election:</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Election:</strong> {election_name}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Your Voter ID:</strong> <code style="background-color: #e5e7eb; padding: 2px 8px; border-radius: 4px;">{voter_id}</code></p>
                </div>
                <p>To cast your vote, please visit the voting portal:</p>
                <p style="margin: 20px 0;">
                    <a href="{LOGIN_URL}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Voting Portal</a>
                </p>
                <p>Or copy this link: <a href="{LOGIN_URL}">{LOGIN_URL}</a></p>
                <p>Use your <strong>Voter ID</strong> shown above to log in.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 12px;">
                    This is an automated message from VoteXpert Secure E-Voting Platform.<br>
                    If you did not expect this email, please ignore it.
                </p>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        VoteXpert - Voter Registration

        Dear {voter_name},

        You have been registered as a voter for the following election:

        Election: {election_name}
        Your Voter ID: {voter_id}

        To cast your vote, please visit: {LOGIN_URL}

        Use your Voter ID shown above to log in.

        ---
        This is an automated message from VoteXpert Secure E-Voting Platform.
        If you did not expect this email, please ignore it.
        """

        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [voter_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
        )
        print(f"Email sent to {voter_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {voter_email}: {str(e)}")
        return False

def lambda_handler(event, context):
    try:
        # Parse SNS message
        for record in event.get('Records', []):
            message = json.loads(record['Sns']['Message'])
            bucket = message.get('bucket')
            key = message.get('key')
            election_id = message.get('election_id')

            if not all([bucket, key, election_id]):
                print(f"Missing required fields: bucket={bucket}, key={key}, election_id={election_id}")
                continue

            # Get election details for the email
            election_response = elections_table.get_item(Key={'election_id': election_id})
            election = election_response.get('Item', {})
            election_name = election.get('election_name', 'Election')

            # Get CSV from S3
            response = s3.get_object(Bucket=bucket, Key=key)
            csv_content = response['Body'].read().decode('utf-8')

            # Parse CSV
            reader = csv.DictReader(StringIO(csv_content))
            voters_added = 0
            emails_sent = 0

            for row in reader:
                voter_id = str(uuid.uuid4())
                voter_name = row.get('name', '')
                voter_email = row.get('email', '')

                voter = {
                    'voter_id': voter_id,
                    'election_id': election_id,
                    'name': voter_name,
                    'email': voter_email,
                    'face_image_url': row.get('face_image_url', ''),
                    'has_voted': False,
                    'verified': False
                }

                voters_table.put_item(Item=voter)
                voters_added += 1

                # Send email notification if email is provided
                if voter_email:
                    if send_voter_email(voter_email, voter_name or 'Voter', voter_id, election_name):
                        emails_sent += 1

            # Update election with voter count
            elections_table.update_item(
                Key={'election_id': election_id},
                UpdateExpression='SET total_voters = :count',
                ExpressionAttributeValues={':count': voters_added}
            )

            print(f"Added {voters_added} voters for election {election_id}, sent {emails_sent} emails")

        return {
            'statusCode': 200,
            'body': json.dumps({'success': True})
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }

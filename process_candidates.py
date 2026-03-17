import json
import boto3
import csv
import base64
import uuid
from io import StringIO

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
candidates_table = dynamodb.Table('voting-candidates')
elections_table = dynamodb.Table('voting-elections')

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

            # Get CSV from S3
            response = s3.get_object(Bucket=bucket, Key=key)
            csv_content = response['Body'].read().decode('utf-8')

            # Parse CSV
            reader = csv.DictReader(StringIO(csv_content))
            candidates_added = 0

            for row in reader:
                candidate_id = str(uuid.uuid4())
                candidate = {
                    'candidate_id': candidate_id,
                    'election_id': election_id,
                    'name': row.get('name', ''),
                    'position': row.get('position', ''),
                    'bio': row.get('bio', ''),
                    'photo_url': row.get('photo_url', ''),
                    'manifesto': row.get('manifesto', ''),
                    'vote_count': 0
                }

                candidates_table.put_item(Item=candidate)
                candidates_added += 1

            # Update election with candidate count
            elections_table.update_item(
                Key={'election_id': election_id},
                UpdateExpression='SET total_candidates = :count',
                ExpressionAttributeValues={':count': candidates_added}
            )

            print(f"Added {candidates_added} candidates for election {election_id}")

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

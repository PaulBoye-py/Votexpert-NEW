import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('voting-voters')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    try:
        response = table.scan()
        voters = response.get('Items', [])

        formatted_voters = []
        for v in voters:
            formatted_voters.append({
                'voter_id': v.get('voter_id', ''),
                'user_id': v.get('user_id', ''),
                'name': v.get('name', v.get('user_id', '')),
                'email': v.get('email', ''),
                'election_id': v.get('election_id', ''),
                'has_voted': v.get('has_voted', False),
                'verification_status': v.get('verification_status', 'pending'),
                'verified': v.get('verification_status') == 'verified'
            })

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True, 'voters': formatted_voters}, cls=DecimalEncoder)
        }
    except Exception as ex:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': str(ex)})
        }

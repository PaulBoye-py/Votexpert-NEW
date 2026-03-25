import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class DatabaseStack extends cdk.Stack {
  // Expose tables so other stacks can grant Lambda permissions
  public readonly orgsTable: dynamodb.Table
  public readonly electionsTable: dynamodb.Table
  public readonly positionsTable: dynamodb.Table
  public readonly candidatesTable: dynamodb.Table
  public readonly voteSessionsTable: dynamodb.Table  // Open elections — anonymous sessions
  public readonly votersTable: dynamodb.Table          // Closed elections — invited voters
  public readonly votesTable: dynamodb.Table           // Audit trail — one record per vote
  public readonly voteCountsTable: dynamodb.Table      // Fast read — atomic vote counters
  public readonly wsConnectionsTable: dynamodb.Table   // Active WebSocket connections
  public readonly lobbyParticipantsTable: dynamodb.Table // Pre-start waiting room participants
  public readonly orgVotersTable: dynamodb.Table          // Org-level voter pool (reusable across elections)

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const removalPolicy = this.node.tryGetContext('env') === 'prod'
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY

    // ─── Orgs ────────────────────────────────────────────────────────────────
    // One record per organisation that signs up.
    // Keyed by org_id (UUID). Looked up by Cognito sub via GSI.
    this.orgsTable = new dynamodb.Table(this, 'OrgsTable', {
      tableName: 'votexpert-orgs',
      partitionKey: { name: 'org_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: look up org by Cognito user sub (used in Lambda authorizer)
    this.orgsTable.addGlobalSecondaryIndex({
      indexName: 'cognito-sub-index',
      partitionKey: { name: 'cognito_user_id', type: dynamodb.AttributeType.STRING },
    })

    // ─── Elections ───────────────────────────────────────────────────────────
    // One record per election. Orgs can have many elections.
    // GSI on org_id lets us list all elections for an org efficiently.
    this.electionsTable = new dynamodb.Table(this, 'ElectionsTable', {
      tableName: 'votexpert-elections',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: list elections by org, sorted by creation time
    this.electionsTable.addGlobalSecondaryIndex({
      indexName: 'org-elections-index',
      partitionKey: { name: 'org_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
    })

    // GSI: look up election by its 6-digit voter join code
    this.electionsTable.addGlobalSecondaryIndex({
      indexName: 'election-code-index',
      partitionKey: { name: 'election_code', type: dynamodb.AttributeType.STRING },
    })

    // ─── Positions ───────────────────────────────────────────────────────────
    // Each election has N positions voted on sequentially.
    // position_order (1, 2, 3...) and duration_seconds define the voting timeline.
    // SK is position_order (zero-padded string) so they sort correctly.
    this.positionsTable = new dynamodb.Table(this, 'PositionsTable', {
      tableName: 'votexpert-positions',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'position_order', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: look up a single position by its ID (needed when voting)
    this.positionsTable.addGlobalSecondaryIndex({
      indexName: 'position-id-index',
      partitionKey: { name: 'position_id', type: dynamodb.AttributeType.STRING },
    })

    // ─── Candidates ──────────────────────────────────────────────────────────
    // Each position has N candidates.
    // PK = position_id so we can fetch all candidates for a position in one query.
    // GSI on election_id lets us fetch every candidate for an election at once
    // (useful for results page and admin view).
    this.candidatesTable = new dynamodb.Table(this, 'CandidatesTable', {
      tableName: 'votexpert-candidates',
      partitionKey: { name: 'position_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'candidate_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: get all candidates for an election (results page)
    this.candidatesTable.addGlobalSecondaryIndex({
      indexName: 'election-candidates-index',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'position_id', type: dynamodb.AttributeType.STRING },
    })

    // ─── Vote Sessions (Open Elections) ──────────────────────────────────────
    // An anonymous session token is issued when a voter opens an open election.
    // It tracks which candidates they've voted for per position.
    // TTL auto-deletes sessions after the election ends.
    this.voteSessionsTable = new dynamodb.Table(this, 'VoteSessionsTable', {
      tableName: 'votexpert-vote-sessions',
      partitionKey: { name: 'session_token', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',   // Auto-expire sessions
      removalPolicy,
    })

    // GSI: count sessions per election (for duplicate/abuse detection per IP)
    this.voteSessionsTable.addGlobalSecondaryIndex({
      indexName: 'election-sessions-index',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ip_address', type: dynamodb.AttributeType.STRING },
    })

    // ─── Voters (Closed Elections) ───────────────────────────────────────────
    // Invited voters for closed elections.
    // Each voter has a unique invite_token embedded in their email link.
    // That token IS their authentication — no separate login needed.
    this.votersTable = new dynamodb.Table(this, 'VotersTable', {
      tableName: 'votexpert-voters',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'voter_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: look up voter by their invite token (primary auth path for closed elections)
    this.votersTable.addGlobalSecondaryIndex({
      indexName: 'invite-token-index',
      partitionKey: { name: 'invite_token', type: dynamodb.AttributeType.STRING },
    })

    // GSI: look up voter by email within an election (prevent duplicate invites)
    this.votersTable.addGlobalSecondaryIndex({
      indexName: 'election-email-index',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    })

    // ─── Votes (Audit Trail) ─────────────────────────────────────────────────
    // One record per individual vote cast.
    // PK = election_id, SK = position_id#candidate_id#vote_id
    // Allows efficient querying: "all votes for position X in election Y"
    // This table is the source of truth for recounts and audit.
    // vote_counts on candidates are derived from this table (or kept in sync atomically).
    this.votesTable = new dynamodb.Table(this, 'VotesTable', {
      tableName: 'votexpert-votes',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'vote_sk', type: dynamodb.AttributeType.STRING }, // position_id#candidate_id#vote_id
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // ─── Vote Counts (Fast Read) ──────────────────────────────────────────────
    // Separate table for real-time vote counts per candidate.
    // Updated atomically (ADD operation) on every vote.
    // This powers the live results display without scanning the votes table.
    // PK = election_id, SK = position_id#candidate_id for efficient queries.
    this.voteCountsTable = new dynamodb.Table(this, 'VoteCountsTable', {
      tableName: 'votexpert-vote-counts',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'position_candidate_sk', type: dynamodb.AttributeType.STRING }, // position_id#candidate_id
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // ─── WebSocket Connections ───────────────────────────────────────────────
    // Tracks active WebSocket connections per election.
    // On vote, Lambda queries by election_id and broadcasts to all connections.
    // TTL auto-removes stale connections.
    this.wsConnectionsTable = new dynamodb.Table(this, 'WSConnectionsTable', {
      tableName: 'votexpert-ws-connections',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'connection_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    })

    // ─── Lobby Participants ───────────────────────────────────────────────────
    // Tracks who is waiting in the lobby before an election starts.
    // TTL auto-deletes entries after 24 hours.
    this.lobbyParticipantsTable = new dynamodb.Table(this, 'LobbyParticipantsTable', {
      tableName: 'votexpert-lobby-participants',
      partitionKey: { name: 'election_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'participant_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    })

    // ─── Org Voter Pool ───────────────────────────────────────────────────────
    // Org-level voter pool — voters that can be reused across multiple elections.
    // When setting up a closed election, admin selects from this pool.
    this.orgVotersTable = new dynamodb.Table(this, 'OrgVotersTable', {
      tableName: 'votexpert-org-voters',
      partitionKey: { name: 'org_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'org_voter_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    })

    // GSI: check for duplicate email within org
    this.orgVotersTable.addGlobalSecondaryIndex({
      indexName: 'org-email-index',
      partitionKey: { name: 'org_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    })

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'OrgsTableName', { value: this.orgsTable.tableName })
    new cdk.CfnOutput(this, 'ElectionsTableName', { value: this.electionsTable.tableName })
    new cdk.CfnOutput(this, 'PositionsTableName', { value: this.positionsTable.tableName })
    new cdk.CfnOutput(this, 'CandidatesTableName', { value: this.candidatesTable.tableName })
    new cdk.CfnOutput(this, 'VoteSessionsTableName', { value: this.voteSessionsTable.tableName })
    new cdk.CfnOutput(this, 'VotersTableName', { value: this.votersTable.tableName })
    new cdk.CfnOutput(this, 'VotesTableName', { value: this.votesTable.tableName })
    new cdk.CfnOutput(this, 'VoteCountsTableName', { value: this.voteCountsTable.tableName })
    new cdk.CfnOutput(this, 'WSConnectionsTableName', { value: this.wsConnectionsTable.tableName })
    new cdk.CfnOutput(this, 'OrgVotersTableName', { value: this.orgVotersTable.tableName })
  }
}

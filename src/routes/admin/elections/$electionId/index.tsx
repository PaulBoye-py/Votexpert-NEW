import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rootRoute } from '../../../__root';
import { AdminLayout } from '@/components/templates';
import { AlertMessage } from '@/components/molecules';
import { FormField } from '@/components/molecules';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge,
} from '@/components/atoms';
import {
  getElection, getPositions, createPosition, deletePosition,
  getCandidates, createCandidate, deleteCandidate,
  getVoters, addVoters, sendInvites, deleteVoter, updateVoterWeight,
  endElection, publishResults,
  deleteElection,
  getPresignedUploadUrl, uploadFileToS3,
  getOrgVoters,
} from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import {
  ArrowLeft, Play, Square, Trophy, Plus, Trash2,
  Users, Clock, Globe, Lock, BarChart3, Send, UserPlus, Copy, QrCode, ImagePlus, X as XIcon, AlertTriangle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { ELECTION_STATUS_COLORS, ELECTION_STATUS_LABELS, ELECTION_TYPE_LABELS } from '@/lib/constants';
import type { Admin, Position, Candidate } from '@/types';

export const adminElectionDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/elections/$electionId',
  component: AdminElectionDetailsPage,
});

function AdminElectionDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { electionId } = adminElectionDetailsRoute.useParams();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);
  const [actionError, setActionError] = React.useState<string | undefined>();

  // Position form
  const [posForm, setPosForm] = React.useState({ title: '', duration_seconds: '120', description: '' });
  const [showPosForm, setShowPosForm] = React.useState(false);

  // Candidate form (per position)
  const [activeCandPos, setActiveCandPos] = React.useState<string | null>(null);
  const [candForm, setCandForm] = React.useState({ name: '', bio: '', photo_url: '' });
  const [candPhotoFile, setCandPhotoFile] = React.useState<File | null>(null);
  const [candPhotoPreview, setCandPhotoPreview] = React.useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = React.useState(false);

  // QR code modal
  const [showQr, setShowQr] = React.useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Voter form (closed elections)
  const [voterEmails, setVoterEmails] = React.useState('');
  const [showVoterForm, setShowVoterForm] = React.useState(false);
  const [voterMsg, setVoterMsg] = React.useState<string | undefined>();

  // Pool selection modal
  const [showPoolModal, setShowPoolModal] = React.useState(false);
  const [selectedPoolEmails, setSelectedPoolEmails] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: election, isLoading: electionLoading } = useQuery({
    queryKey: ['admin', 'election', electionId],
    queryFn: () => getElection(electionId),
    enabled: isAuthenticated,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ['admin', 'election', electionId, 'positions'],
    queryFn: () => getPositions(electionId),
    enabled: isAuthenticated && !!election,
  });

  const { data: voters = [] } = useQuery({
    queryKey: ['admin', 'election', electionId, 'voters'],
    queryFn: () => getVoters(electionId),
    enabled: isAuthenticated && election?.type === 'CLOSED',
  });

  const { data: orgVoterPool = [] } = useQuery({
    queryKey: ['admin', 'org-voters'],
    queryFn: getOrgVoters,
    enabled: isAuthenticated && election?.type === 'CLOSED',
  });

  // candidates per position
  const candidateQueries = useQuery({
    queryKey: ['admin', 'election', electionId, 'all-candidates'],
    queryFn: async () => {
      const results: Record<string, Candidate[]> = {};
      await Promise.all(
        positions.map(async (pos) => {
          results[pos.position_id] = await getCandidates(electionId, pos.position_id);
        })
      );
      return results;
    },
    enabled: positions.length > 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'elections'] });
  };

  // ─── Position mutations ────────────────────────────────────────────────────
  const addPosMutation = useMutation({
    mutationFn: () =>
      createPosition(electionId, {
        title: posForm.title.trim(),
        description: posForm.description.trim() || undefined,
        duration_seconds: parseInt(posForm.duration_seconds, 10),
      }),
    onSuccess: () => {
      setPosForm({ title: '', duration_seconds: '120', description: '' });
      setShowPosForm(false);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const deletePosMutation = useMutation({
    mutationFn: (positionId: string) => deletePosition(electionId, positionId),
    onSuccess: invalidate,
    onError: (err: Error) => setActionError(err.message),
  });

  // ─── Candidate mutations ───────────────────────────────────────────────────
  const addCandMutation = useMutation({
    mutationFn: async (positionId: string) => {
      let photoUrl = candForm.photo_url || undefined;
      if (candPhotoFile) {
        setPhotoUploading(true);
        try {
          const { uploadUrl, fileUrl } = await getPresignedUploadUrl(candPhotoFile.name, candPhotoFile.type);
          await uploadFileToS3(uploadUrl, candPhotoFile);
          photoUrl = fileUrl;
        } finally {
          setPhotoUploading(false);
        }
      }
      return createCandidate(electionId, positionId, {
        name: candForm.name.trim(),
        bio: candForm.bio.trim() || undefined,
        photo_url: photoUrl,
      });
    },
    onSuccess: () => {
      setCandForm({ name: '', bio: '', photo_url: '' });
      setCandPhotoFile(null);
      setCandPhotoPreview(null);
      setActiveCandPos(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'all-candidates'] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const deleteCandMutation = useMutation({
    mutationFn: ({ positionId, candidateId }: { positionId: string; candidateId: string }) =>
      deleteCandidate(electionId, positionId, candidateId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'all-candidates'] }),
    onError: (err: Error) => setActionError(err.message),
  });

  // ─── Voter mutations ───────────────────────────────────────────────────────
  const addVotersMutation = useMutation({
    mutationFn: () => {
      const emails = voterEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean);
      return addVoters(electionId, emails);
    },
    onSuccess: (data) => {
      setVoterMsg(`Added ${data.added} voter(s). ${data.skipped ? `${data.skipped} already existed.` : ''}`);
      setVoterEmails('');
      setShowVoterForm(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'voters'] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const sendInvitesMutation = useMutation({
    mutationFn: () => sendInvites(electionId),
    onSuccess: (data) => setVoterMsg(`Sent ${data.sent} invite(s).`),
    onError: (err: Error) => setActionError(err.message),
  });

  const deleteVoterMutation = useMutation({
    mutationFn: (voterId: string) => deleteVoter(electionId, voterId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'voters'] }),
  });

  const weightMutation = useMutation({
    mutationFn: ({ voterId, weight }: { voterId: string; weight: number }) =>
      updateVoterWeight(electionId, voterId, weight),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'voters'] }),
    onError: (err: Error) => setActionError(err.message),
  });

  // ─── Election lifecycle ────────────────────────────────────────────────────
  const endMutation = useMutation({
    mutationFn: () => endElection(electionId),
    onSuccess: invalidate,
    onError: (err: Error) => setActionError(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishResults(electionId),
    onSuccess: invalidate,
    onError: (err: Error) => setActionError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteElection(electionId),
    onSuccess: () => navigate({ to: '/admin/elections' }),
    onError: (err: Error) => { setActionError(err.message); setConfirmDelete(false); },
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const isEditable = election?.status === 'DRAFT' || election?.status === 'SCHEDULED';
  const electionCode = election?.election_code ?? '';
  const voteUrl = electionCode
    ? `${window.location.origin}/vote/join?code=${electionCode}`
    : `${window.location.origin}/vote/join?election=${electionId}`;

  const copyCode = () => navigator.clipboard.writeText(electionCode);

  const statusBadge = election ? (
    <Badge
      className={cn(
        'text-white text-xs',
        ELECTION_STATUS_COLORS[election.status] ?? 'bg-gray-500'
      )}
    >
      {ELECTION_STATUS_LABELS[election.status] ?? election.status}
    </Badge>
  ) : null;

  if (!isAuthenticated) return null;

  const isLoading = electionLoading || positionsLoading;

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/elections"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate({ to: '/admin/elections' })} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Elections
        </Button>

        {actionError && (
          <AlertMessage variant="error" className="mb-2">
            {actionError}
          </AlertMessage>
        )}

        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : !election ? (
          <AlertMessage variant="error">Election not found.</AlertMessage>
        ) : (
          <>
            {/* ─── Overview ───────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-foreground truncate">{election.title}</h1>
                    {statusBadge}
                    <Badge variant="outline" className="text-xs gap-1">
                      {election.type === 'OPEN' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {ELECTION_TYPE_LABELS[election.type]}
                    </Badge>
                  </div>
                  {election.description && (
                    <p className="text-muted-foreground text-sm">{election.description}</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Share section — visible from DRAFT onwards ────────── */}
                {election.status !== 'RESULTS_PUBLISHED' && electionCode && (
                  <>
                    {election.type === 'CLOSED' ? (
                      <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                            Closed Election — Invite Only
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Voters join using their personal invite link sent by email. Code and QR joining are disabled for closed elections.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4 space-y-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                          Share with voters
                        </p>
                        {/* Big code display */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Join code</p>
                            <p className="font-mono text-4xl font-bold tracking-[0.3em] text-foreground">
                              {electionCode}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
                              <Copy className="h-3.5 w-3.5" />
                              Copy code
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowQr(true)} className="gap-1.5">
                              <QrCode className="h-3.5 w-3.5" />
                              QR Code
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Voters go to <span className="font-medium">votexpert.online</span> → Join as Voter → enter this code
                        </p>
                      </div>
                    )}

                    {/* QR modal — open elections only */}
                    {showQr && election.type !== 'CLOSED' && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowQr(false)}
                      >
                        <div
                          className="bg-card border border-border rounded-xl p-6 space-y-4 w-full max-w-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">Scan to join</p>
                            <button type="button" onClick={() => setShowQr(false)} className="text-muted-foreground hover:text-foreground">
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex justify-center bg-white rounded-lg p-4">
                            <QRCodeSVG value={voteUrl} size={200} />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="font-mono text-2xl font-bold tracking-[0.2em]">{electionCode}</p>
                            <p className="text-xs text-muted-foreground">Scan or enter code at votexpert.online</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  {(election.status === 'DRAFT' || election.status === 'SCHEDULED') && (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white gap-2"
                      onClick={() => navigate({ to: '/admin/elections/$electionId/present', params: { electionId } })}
                      disabled={positions.length === 0}
                    >
                      <Play className="h-4 w-4" />
                      Open Presenter
                    </Button>
                  )}
                  {election.status === 'ACTIVE' && (
                    <>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        onClick={() => navigate({ to: '/admin/elections/$electionId/present', params: { electionId } })}
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Live Presenter
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => { setActionError(undefined); endMutation.mutate(); }}
                        disabled={endMutation.isPending}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        {endMutation.isPending ? 'Ending…' : 'End Election'}
                      </Button>
                    </>
                  )}
                  {election.status === 'CLOSED' && (
                    <Button
                      onClick={() => { setActionError(undefined); publishMutation.mutate(); }}
                      disabled={publishMutation.isPending}
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      {publishMutation.isPending ? 'Publishing…' : 'Publish Results'}
                    </Button>
                  )}
                  {election.status === 'RESULTS_PUBLISHED' && (
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: '/results/$electionId', params: { electionId } })}
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      View Results
                    </Button>
                  )}
                </div>

                {positions.length === 0 && election.status === 'DRAFT' && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Add at least one position before opening the presenter.
                  </p>
                )}

                {/* Delete election — only for DRAFT/SCHEDULED */}
                {isEditable && (
                  <div className="pt-2 border-t border-border">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete this election
                      </button>
                    ) : (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-destructive">Delete election?</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              This will permanently delete <span className="font-medium">"{election.title}"</span> including all positions and candidates. This cannot be undone.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleteMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Positions & Candidates ─────────────────────────────────── */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Positions ({positions.length})
                </CardTitle>
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={() => setShowPosForm((v) => !v)} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add Position
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add position form */}
                {showPosForm && (
                  <Card className="border-dashed">
                    <CardContent className="pt-4 space-y-3">
                      <FormField
                        label="Position Title"
                        type="text"
                        placeholder="e.g. President"
                        value={posForm.title}
                        onChange={(e) => setPosForm((p) => ({ ...p, title: e.target.value }))}
                        disabled={addPosMutation.isPending}
                        required
                      />
                      <FormField
                        label="Voting Duration (seconds)"
                        type="number"
                        placeholder="120"
                        value={posForm.duration_seconds}
                        onChange={(e) => setPosForm((p) => ({ ...p, duration_seconds: e.target.value }))}
                        disabled={addPosMutation.isPending}
                        required
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => { setActionError(undefined); addPosMutation.mutate(); }}
                          disabled={addPosMutation.isPending || !posForm.title.trim()}
                        >
                          {addPosMutation.isPending ? 'Adding…' : 'Add Position'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowPosForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {positions.length === 0 && !showPosForm && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No positions yet. Add a position to get started.
                  </p>
                )}

                {positions
                  .sort((a: Position, b: Position) => a.position_order - b.position_order)
                  .map((pos: Position) => {
                    const candidates: Candidate[] = candidateQueries.data?.[pos.position_id] ?? [];
                    const isAddingCand = activeCandPos === pos.position_id;
                    return (
                      <div key={pos.position_id} className="rounded-lg border border-border overflow-hidden">
                        {/* Position header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                          <div>
                            <span className="font-medium text-sm">{pos.title}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {pos.duration_seconds}s · {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {isEditable && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActiveCandPos(isAddingCand ? null : pos.position_id)}
                                  className="gap-1 h-7 text-xs"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Candidate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePosMutation.mutate(pos.position_id)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Candidates */}
                        {candidates.length > 0 && (
                          <div className="divide-y divide-border">
                            {candidates.map((c: Candidate) => (
                              <div key={c.candidate_id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                  {c.photo_url ? (
                                    <img src={c.photo_url} alt={c.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                      {c.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{c.name}</p>
                                    {c.bio && <p className="text-xs text-muted-foreground">{c.bio}</p>}
                                  </div>
                                </div>
                                {isEditable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      deleteCandMutation.mutate({
                                        positionId: pos.position_id,
                                        candidateId: c.candidate_id,
                                      })
                                    }
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add candidate inline form */}
                        {isAddingCand && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-2">
                            {/* Photo upload */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Photo (optional)</label>
                              <div className="flex items-center gap-3">
                                {candPhotoPreview ? (
                                  <div className="relative w-12 h-12 shrink-0">
                                    <img src={candPhotoPreview} alt="preview" className="w-12 h-12 rounded-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => { setCandPhotoFile(null); setCandPhotoPreview(null); }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center"
                                    >
                                      <XIcon className="h-2.5 w-2.5 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <label className="cursor-pointer">
                                  <span className="text-xs text-primary hover:underline">
                                    {candPhotoFile ? 'Change photo' : 'Upload photo'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={addCandMutation.isPending}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setCandPhotoFile(file);
                                      const reader = new FileReader();
                                      reader.onload = (ev) => setCandPhotoPreview(ev.target?.result as string);
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>

                            <FormField
                              label="Candidate Name"
                              type="text"
                              placeholder="Full name"
                              value={candForm.name}
                              onChange={(e) => setCandForm((p) => ({ ...p, name: e.target.value }))}
                              disabled={addCandMutation.isPending}
                              required
                            />
                            <FormField
                              label="Short Bio (optional)"
                              type="text"
                              placeholder="e.g. Year 3, Computer Science"
                              value={candForm.bio}
                              onChange={(e) => setCandForm((p) => ({ ...p, bio: e.target.value }))}
                              disabled={addCandMutation.isPending}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setActionError(undefined);
                                  addCandMutation.mutate(pos.position_id);
                                }}
                                disabled={addCandMutation.isPending || photoUploading || !candForm.name.trim()}
                              >
                                {photoUploading ? 'Uploading…' : addCandMutation.isPending ? 'Adding…' : 'Add'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setActiveCandPos(null); setCandPhotoFile(null); setCandPhotoPreview(null); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* ─── Voters (Closed elections only) ─────────────────────────── */}
            {election.type === 'CLOSED' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Voters ({voters.length})
                  </CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    {isEditable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVoterForm((v) => !v)}
                        className="gap-1.5"
                      >
                        <UserPlus className="h-4 w-4" />
                        Add Voters
                      </Button>
                    )}
                    {isEditable && orgVoterPool.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const existingEmails = new Set(voters.map((v) => v.email));
                          setSelectedPoolEmails(new Set(
                            orgVoterPool
                              .filter((v) => !existingEmails.has(v.email))
                              .map((v) => v.email)
                          ));
                          setShowPoolModal(true);
                        }}
                        className="gap-1.5"
                      >
                        <Users className="h-4 w-4" />
                        Select from Pool
                      </Button>
                    )}
                    {voters.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setActionError(undefined); sendInvitesMutation.mutate(); }}
                        disabled={sendInvitesMutation.isPending}
                        className="gap-1.5"
                      >
                        <Send className="h-4 w-4" />
                        {sendInvitesMutation.isPending ? 'Sending…' : 'Send Invites'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {voterMsg && <AlertMessage variant="info">{voterMsg}</AlertMessage>}

                  {showVoterForm && (
                    <Card className="border-dashed">
                      <CardContent className="pt-4 space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Email Addresses</label>
                          <textarea
                            placeholder="Enter emails separated by newline or comma&#10;e.g.&#10;alice@example.com&#10;bob@example.com"
                            value={voterEmails}
                            onChange={(e) => setVoterEmails(e.target.value)}
                            rows={5}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => { setActionError(undefined); addVotersMutation.mutate(); }}
                            disabled={addVotersMutation.isPending || !voterEmails.trim()}
                          >
                            {addVotersMutation.isPending ? 'Adding…' : 'Add Voters'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowVoterForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {voters.length === 0 && !showVoterForm ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No voters added yet.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {voters.map((v) => {
                        const weight = v.vote_weight ?? 1;
                        const isJudge = weight > 1;
                        return (
                          <div key={v.voter_id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm truncate">{v.email}</p>
                                {isJudge && (
                                  <Badge className="text-xs bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 shrink-0">
                                    Judge ×{weight}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {v.voted_at
                                  ? `Voted ${new Date(v.voted_at).toLocaleString()}`
                                  : v.invite_sent_at
                                  ? `Invite sent ${new Date(v.invite_sent_at).toLocaleString()}`
                                  : 'Invite not sent'}
                              </p>
                            </div>
                            {isEditable && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Weight selector */}
                                <select
                                  value={weight}
                                  onChange={(e) =>
                                    weightMutation.mutate({ voterId: v.voter_id, weight: Number(e.target.value) })
                                  }
                                  disabled={weightMutation.isPending}
                                  title="Vote weight"
                                  className="text-xs rounded border border-input bg-background px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                                >
                                  {[1, 2, 3, 4, 5].map((w) => (
                                    <option key={w} value={w}>
                                      {w === 1 ? 'Voter (×1)' : `Judge (×${w})`}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteVoterMutation.mutate(v.voter_id)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── Select from Pool Modal ─────────────────────────────────────────── */}
      {showPoolModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPoolModal(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-semibold">Select from Voter Pool</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPoolEmails.size} selected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPoolModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Voter list */}
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {orgVoterPool.map((v) => {
                const alreadyAdded = voters.some((ev) => ev.email === v.email);
                const checked = selectedPoolEmails.has(v.email);
                return (
                  <label
                    key={v.org_voter_id}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
                      alreadyAdded && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alreadyAdded}
                      onChange={() => {
                        if (alreadyAdded) return;
                        setSelectedPoolEmails((prev) => {
                          const next = new Set(prev);
                          if (next.has(v.email)) next.delete(v.email);
                          else next.add(v.email);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{v.email}</p>
                      {alreadyAdded && (
                        <p className="text-xs text-muted-foreground">Already in election</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <Button
                className="flex-1"
                disabled={selectedPoolEmails.size === 0 || addVotersMutation.isPending}
                onClick={() => {
                  const emails = [...selectedPoolEmails];
                  addVoters(electionId, emails).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['admin', 'election', electionId, 'voters'] });
                    setShowPoolModal(false);
                    setVoterMsg(`Added ${emails.length} voter${emails.length !== 1 ? 's' : ''} from pool.`);
                  }).catch((err: Error) => setActionError(err.message));
                }}
              >
                Add {selectedPoolEmails.size > 0 ? `${selectedPoolEmails.size} ` : ''}Selected
              </Button>
              <Button variant="outline" onClick={() => setShowPoolModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

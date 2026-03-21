// Re-export all stores from a single entry point

// Auth store
export {
  $accessToken,
  $refreshToken,
  $user,
  $userType,
  $voterSession,
  $pendingEmail,
  $isAuthenticated,
  $isAdmin,
  setTokens,
  setUser,
  setVoterSession,
  setPendingEmail,
  logout,
  initializeAuth,
} from './auth.store';

// UI store
export {
  $isLoading,
  $loadingMessage,
  $toasts,
  $activeModal,
  $modalData,
  $sidebarOpen,
  showToast,
  removeToast,
  clearToasts,
  setLoading,
  openModal,
  closeModal,
  toggleSidebar,
  setSidebarOpen,
  toast,
} from './ui.store';
export type { Toast, ToastType } from './ui.store';

// Election store
export {
  $currentElectionId,
  $currentElectionName,
  $selectedCandidates,
  $currentPositionIndex,
  $totalPositions,
  $isReviewingVote,
  $hasSelectedCandidate,
  $votingProgress,
  $canSubmitVote,
  setCurrentElection,
  selectCandidate,
  deselectCandidate,
  setPositionIndex,
  nextPosition,
  previousPosition,
  setTotalPositions,
  setReviewingVote,
  resetVotingState,
  clearElectionContext,
  getVotePayload,
} from './election.store';

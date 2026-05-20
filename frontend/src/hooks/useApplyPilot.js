/* ================================================================
   useApplyPilot · data-fetching hooks for the four AgentArena screens.

   No more mock fallback. When the backend is not reachable, hooks
   expose `error` + `isOffline` so the UI can show a banner, but they
   never invent data. Empty arrays / null are passed through as-is so
   the components can render proper empty states.
   ================================================================ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyPilotAPI } from '../services/api';
import { POLLING_INTERVAL_MS } from '../pages/AgentArena/constants';

const isNetworkOr404 = (err) => {
  if (!err) return false;
  return err.response?.status === 404 || !err.response;
};

/* ================================================================
   Generic one-shot fetcher (no fallback data).
   ================================================================ */
function useFetch(fetcher, initial, deps = []) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Reset stale data whenever the dependencies change so consumers don't
  // momentarily render the previous resource (e.g. switching to a different
  // application would show the prior application's submission telemetry
  // until the new fetch resolves).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(initial); }, deps);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (!mountedRef.current) return;
      setData(res?.data ?? initial);
      setIsOffline(false);
    } catch (err) {
      if (!mountedRef.current) return;
      if (isNetworkOr404(err)) {
        setIsOffline(true);   // backend not reachable / route not mounted
      } else {
        setError(err);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, isOffline, refetch: run, setData };
}

/* ================================================================
   Setup page
   ================================================================ */
export function useApplyPilotConfig({ enabled = true } = {}) {
  return useFetch(
    () => (enabled
      ? applyPilotAPI.getConfig()
      : Promise.resolve({ data: { config: null, status: 'idle', training: { coverage: [] } } })),
    { config: null, status: 'idle', training: { coverage: [] } },
    [enabled],
  );
}

export async function saveApplyPilotConfig(payload) {
  const res = await applyPilotAPI.updateConfig(payload);
  return res?.data;
}

export function useApplyPilotCredentials() {
  return useFetch(
    () => applyPilotAPI.getCredentials(),
    { items: [], ready: false },
    [],
  );
}

export function useApplyPilotAts() {
  return useFetch(
    () => applyPilotAPI.getATS(),
    { mode: 'api', providers: [] },
    [],
  );
}

export async function saveApplyPilotCredential(payload) {
  const res = await applyPilotAPI.saveCredentials(payload);
  return res?.data;
}

/* ================================================================
   Polling helper, calls `fn` every `interval` ms while mounted.
   ================================================================ */
function usePolling(fn, interval = POLLING_INTERVAL_MS) {
  const savedFn = useRef(fn);
  useEffect(() => { savedFn.current = fn; }, [fn]);

  useEffect(() => {
    if (!interval) return;
    const id = setInterval(() => savedFn.current(), interval);
    return () => clearInterval(id);
  }, [interval]);
}

/* ================================================================
   Dashboard
   ================================================================ */
export function useDashboardData() {
  const stats = useFetch(() => applyPilotAPI.getStats(), [], []);
  const queue = useFetch(() => applyPilotAPI.getQueue(), [], []);
  const activity = useFetch(() => applyPilotAPI.getActivity(), [], []);
  const status = useFetch(() => applyPilotAPI.getStatus(), { state: 'idle' }, []);

  const refetchAll = useCallback(() => {
    stats.refetch();
    queue.refetch();
    activity.refetch();
    status.refetch();
  }, [stats, queue, activity, status]);

  // Auto-refresh every POLLING_INTERVAL_MS so status changes appear live.
  usePolling(refetchAll);

  return {
    stats: stats.data,
    queue: queue.data,
    activity: activity.data,
    status: status.data,
    loading: stats.loading || queue.loading || activity.loading,
    isOffline: stats.isOffline || queue.isOffline || activity.isOffline || status.isOffline,
    refetchAll,
  };
}

export async function startPilot() {
  return applyPilotAPI.start();
}
export async function pausePilot() {
  return applyPilotAPI.pause();
}

/* ================================================================
   Review page
   ================================================================ */
export function useReviewQueue() {
  const [statusFilter, setStatusFilter] = useState(null);
  const { data, loading, error, isOffline, refetch } = useFetch(
    () => applyPilotAPI.getQueue(statusFilter ? { status: statusFilter } : {}),
    [],
    [statusFilter],
  );

  // Auto-refresh the review queue so status transitions appear live.
  usePolling(refetch);

  return { queue: data, loading, error, isOffline, refetch, statusFilter, setStatusFilter };
}

export function useApplicationDetail(appId) {
  return useFetch(
    () => (appId ? applyPilotAPI.getApplication(appId) : Promise.resolve({ data: null })),
    null,
    [appId],
  );
}

export async function previewApplication(appId) {
  return applyPilotAPI.previewApplication(appId);
}
export async function approveApplication(appId, edits) {
  return applyPilotAPI.approveApplication(appId, edits);
}
export async function rejectApplication(appId, reason) {
  return applyPilotAPI.rejectApplication(appId, reason);
}
export async function rejectApplicationsBulk(payload) {
  return applyPilotAPI.rejectApplicationsBulk(payload);
}
export async function reopenApplication(appId) {
  return applyPilotAPI.reopenApplication(appId);
}
export async function deleteApplication(appId) {
  return applyPilotAPI.deleteApplication(appId);
}
export async function requestApplicationEdit(appId, section, instruction) {
  return applyPilotAPI.requestEdit(appId, section, instruction);
}

/* ----- Hybrid manual-submit helpers (APPLYPILOT_AUTOSUBMIT=off) ----- */
export async function regenerateResume(appId, payload) {
  return applyPilotAPI.regenerateResume(appId, payload);
}
export async function regenerateCoverLetter(appId, payload) {
  return applyPilotAPI.regenerateCoverLetter(appId, payload);
}
export async function regenerateAnswer(appId, payload) {
  return applyPilotAPI.regenerateAnswer(appId, payload);
}
export async function patchAnswers(appId, answers) {
  return applyPilotAPI.patchAnswers(appId, answers);
}
export async function markApplied(appId, payload) {
  return applyPilotAPI.markApplied(appId, payload);
}
export async function patchTracking(appId, payload) {
  return applyPilotAPI.patchTracking(appId, payload);
}
export async function downloadResumePdf(appId) {
  return applyPilotAPI.downloadResumePdf(appId);
}
export async function analyzeApplicationGaps(appId) {
  const { data } = await applyPilotAPI.analyzeApplicationGaps(appId);
  return data;
}

/* ================================================================
   Training page
   ================================================================ */
export function useTrainingState() {
  return useFetch(
    () => applyPilotAPI.getTrainingState(),
    { topics: [], memory: [], messages: [], quickReplies: [], currentTopic: 'motive' },
    [],
  );
}

export async function sendTrainingMessage(content, topic) {
  const res = await applyPilotAPI.sendTrainingMessage(content, topic);
  return res?.data;
}

export async function advanceTrainingTopic(topic) {
  const res = await applyPilotAPI.advanceTrainingTopic(topic);
  return res?.data;
}

export async function resetTraining() {
  const res = await applyPilotAPI.resetTraining();
  return res?.data;
}

/**
 * Job-match scores for this session, shared by every surface that shows one:
 * the list badge, its breakdown dialog, the detail card and Analyze Match.
 * One store means a job scored anywhere shows the same number everywhere.
 *
 * Stored scores are fetched for free from /job-match/cached; a new score is
 * one AI read (/job-match), which spends a job-match allowance.
 */
import { useEffect, useState } from 'react';
import { profileAPI } from '@/services/api';

const scores = new Map();
/** Ids already asked about, hit or miss, so a page isn't re-requested. */
const looked = new Set();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

export function getJobMatch(jobId) {
  return scores.get(jobId) || null;
}

function setJobMatch(jobId, data) {
  if (!jobId || !data || typeof data.score !== 'number') return;
  scores.set(jobId, data);
  notify();
}

/** Loads stored scores for these ids (never spends anything). */
export async function loadCachedJobMatches(jobIds) {
  const wanted = (jobIds || []).filter((id) => id && !looked.has(id));
  if (wanted.length === 0) return;
  wanted.forEach((id) => looked.add(id));
  try {
    const { data } = await profileAPI.jobMatchCached(wanted);
    let changed = false;
    for (const [id, payload] of Object.entries(data?.scores || {})) {
      if (typeof payload?.score === 'number') {
        scores.set(id, payload);
        changed = true;
      }
    }
    if (changed) notify();
  } catch {
    // A failed lookup just means no badge; let a later page retry these ids.
    wanted.forEach((id) => looked.delete(id));
  }
}

/**
 * Scores one posting we hold. Resolves to the score payload; rejects with
 * the server's message (allowance used up, posting too short) for the caller
 * to show.
 */
export async function scoreJob(jobId) {
  try {
    const { data } = await profileAPI.jobMatch({ externalJobId: jobId });
    if (!data?.success || !data?.data) throw new Error('The match score could not be computed.');
    setJobMatch(jobId, data.data);
    return data.data;
  } catch (err) {
    const body = err?.response?.data;
    const e = new Error(body?.message || body?.error || err?.message || 'The match score could not be computed.');
    e.status = err?.response?.status;
    throw e;
  }
}

/** Re-renders the caller whenever any score arrives; returns a snapshot map. */
export function useJobMatches(jobIds) {
  const [, force] = useState(0);
  const key = (jobIds || []).join(',');
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  useEffect(() => {
    if (key) loadCachedJobMatches(key.split(','));
  }, [key]);
  return Object.fromEntries(scores);
}

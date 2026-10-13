import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Long-running AI work that has to outlive the page that started it.
 *
 * The progress modal promised "You can hide this and keep working. It will
 * reopen when finished." That held only while the user stayed on the same
 * page: the request lived inside the page component, so navigating to a job
 * page unmounted it. The request still finished and the credit was still
 * charged — an enhancement's result then had nowhere to go and was lost, and
 * nothing anywhere on screen said that work was running at all.
 *
 * This provider sits above the routes, so a task started here survives
 * navigation. Each task records whether the component that started it was
 * still mounted when it finished: if so, that component already showed the
 * result and nothing further is needed; if not, the task is flagged as needing
 * attention and the indicator offers to take the user to it.
 */

const STORAGE_KEY = 'profileai.backgroundTasks.v1';
/** A finished result is offered for review for this long, across refreshes. */
const KEEP_FINISHED_MS = 30 * 60 * 1000;

const BackgroundTasksContext = createContext(null);

const NOOP = {
  tasks: {},
  startTask: ({ run }) => Promise.resolve().then(run),
  dismissTask: () => {},
  getTask: () => null,
};

/** Safe outside the provider (tests, isolated renders): tasks just run inline. */
export const useBackgroundTasks = () => useContext(BackgroundTasksContext) || NOOP;

const errorMessage = (err) =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Something went wrong';

function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    // Only finished work can survive a refresh; an in-flight request cannot.
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, t]) => t && t.status !== 'running' && now - (t.finishedAt || 0) < KEEP_FINISHED_MS
      )
    );
  } catch (_) {
    return {};
  }
}

export function BackgroundTasksProvider({ children }) {
  const [tasks, setTasks] = useState(loadPersisted);
  const inFlight = useRef({});

  useEffect(() => {
    try {
      const finished = Object.fromEntries(Object.entries(tasks).filter(([, t]) => t.status !== 'running'));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(finished));
    } catch (_) {
      /* storage full or unavailable — the in-memory state still works */
    }
  }, [tasks]);

  /**
   * Run `run()` as a tracked task.
   *
   * @param {Object} spec
   * @param {string} spec.id        - stable id; a second start while running joins the first
   * @param {string} spec.label     - what the indicator says ("Enhancing your profile")
   * @param {string} [spec.doneLabel] - what it says when finished
   * @param {string} [spec.openPath] - where "Review" takes the user
   * @param {() => boolean} [spec.ownerAlive] - is the starting component still mounted?
   * @param {() => Promise<any>} spec.run
   */
  const startTask = useCallback(({ id, label, doneLabel, openPath, ownerAlive, run }) => {
    if (inFlight.current[id]) return inFlight.current[id];

    setTasks((prev) => ({
      ...prev,
      [id]: { id, label, doneLabel, openPath, status: 'running', startedAt: Date.now() },
    }));

    const promise = Promise.resolve()
      .then(run)
      .then(
        (result) => {
          const needsAttention = !(ownerAlive && ownerAlive());
          setTasks((prev) => ({
            ...prev,
            [id]: { ...prev[id], status: 'done', finishedAt: Date.now(), result, needsAttention },
          }));
          return result;
        },
        (err) => {
          setTasks((prev) => ({
            ...prev,
            [id]: { ...prev[id], status: 'error', finishedAt: Date.now(), error: errorMessage(err), needsAttention: true },
          }));
          throw err;
        }
      )
      .finally(() => {
        delete inFlight.current[id];
      });

    inFlight.current[id] = promise;
    return promise;
  }, []);

  const dismissTask = useCallback((id) => {
    setTasks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // A finished task its own page already handled flashes "done" briefly and
  // then clears itself; one that needs attention stays until acted on.
  useEffect(() => {
    const quiet = Object.values(tasks).filter((t) => t.status === 'done' && !t.needsAttention);
    if (!quiet.length) return undefined;
    const timer = setTimeout(() => quiet.forEach((t) => dismissTask(t.id)), 4000);
    return () => clearTimeout(timer);
  }, [tasks, dismissTask]);

  const getTask = useCallback((id) => tasks[id] || null, [tasks]);

  const value = useMemo(() => ({ tasks, startTask, dismissTask, getTask }), [tasks, startTask, dismissTask, getTask]);

  return <BackgroundTasksContext.Provider value={value}>{children}</BackgroundTasksContext.Provider>;
}

/** A ref that is true while the calling component is mounted. */
export function useMountedRef() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

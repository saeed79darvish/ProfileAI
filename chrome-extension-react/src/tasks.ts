/**
 * Durable background tasks for the long-running AI operations.
 *
 * An MV3 service worker is killed roughly 30 seconds after its last event, and
 * the thing keeping it awake during a tailor / cover letter / analysis run is
 * the message port held open by the side panel. Close the panel and the port
 * dies, the worker is torn down, and the in-flight fetch dies with it — which
 * is why work used to vanish when the panel was closed mid-run.
 *
 * Every long operation now runs as a *task*:
 *
 *   - the worker keeps itself alive (a cheap extension API call every 20s)
 *     for as long as any task is running, so the fetch actually completes;
 *   - status + result are mirrored into chrome.storage.local, so a panel that
 *     opens later picks up either a live spinner or the finished result
 *     instead of starting from scratch;
 *   - a duplicate request joins the running task rather than firing a second
 *     (billed) AI call.
 *
 * Both the service worker and the side panel import this module. Only the
 * worker calls runBackgroundTask / sweepInterruptedTasks; the panel side only
 * reads records and marks them seen.
 */

/** chrome.storage.local key holding the id -> record map. */
export const BG_TASKS_KEY = 'bgTasks';

export type BgTaskKind =
  | 'tailor'
  | 'gaps'
  | 'coverLetter'
  | 'match'
  | 'keywords'
  | 'smartAnswers'
  | 'singleAnswer'
  | 'linkedin'
  | 'linkedinGuest';

export type BgTaskStatus = 'running' | 'done' | 'error';

export interface BgTaskRecord<T = any> {
  id: string;
  kind: BgTaskKind;
  key: string;
  status: BgTaskStatus;
  startedAt: number;
  updatedAt: number;
  /** Context for the UI (job title, company, target title…) so a restored
   *  panel can say which job the running task belongs to. */
  meta?: Record<string, any>;
  /** Whatever the runner resolved with — the same payload the panel would
   *  have received as the sendMessage response. */
  result?: T;
  /** Set when the runner threw. A runner that resolves with
   *  `{ success: false, error }` still counts as 'done'. */
  error?: string;
  /** The worker was torn down mid-run; the result is unrecoverable. */
  interrupted?: boolean;
  /** The panel has already surfaced this outcome, so it must not pop the
   *  same modal again on the next open. */
  seenAt?: number;
}

/** How long a finished record stays around for a returning panel to claim. */
export const TASK_RESULT_TTL_MS = 30 * 60 * 1000;

/** A 'running' record older than this is presumed dead even if the sweep on
 *  worker boot never got to it (e.g. the fetch itself hung). */
export const TASK_RUN_TIMEOUT_MS = 5 * 60 * 1000;

/** Finished records older than this are restored silently (state only) rather
 *  than popping a modal in the user's face. */
export const TASK_AUTO_SURFACE_MS = 15 * 60 * 1000;

const MAX_TASK_RECORDS = 24;

export const bgTaskId = (kind: BgTaskKind, key: string): string =>
  `${kind}::${key || 'default'}`;

/**
 * Stable per-job key. Query strings are dropped so the same posting reached
 * via different tracking params maps to one task.
 */
export function jobTaskKey(
  job: { jobUrl?: string | null; jobTitle?: string | null; company?: string | null } = {},
): string {
  const url = (job.jobUrl || '').trim();
  if (url) {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  const label = `${(job.jobTitle || '').trim()}|${(job.company || '').trim()}`.toLowerCase();
  return label === '|' ? 'default' : label;
}

export function isTaskStale(rec: BgTaskRecord | null | undefined): boolean {
  if (!rec) return false;
  if (rec.status !== 'running') return false;
  return Date.now() - rec.startedAt > TASK_RUN_TIMEOUT_MS;
}

// --- storage access --------------------------------------------------------

export async function readBgTasks(): Promise<Record<string, BgTaskRecord>> {
  try {
    const { [BG_TASKS_KEY]: tasks } = await chrome.storage.local.get(BG_TASKS_KEY);
    if (tasks && typeof tasks === 'object') return tasks as Record<string, BgTaskRecord>;
  } catch {
    /* treat an unreadable store as empty */
  }
  return {};
}

export async function readBgTask(
  kind: BgTaskKind,
  key: string,
): Promise<BgTaskRecord | null> {
  const tasks = await readBgTasks();
  return tasks[bgTaskId(kind, key)] || null;
}

/** Most recently updated record of a kind, optionally filtered. */
export function pickLatestTask(
  tasks: Record<string, BgTaskRecord>,
  kind: BgTaskKind,
  predicate?: (rec: BgTaskRecord) => boolean,
): BgTaskRecord | null {
  let best: BgTaskRecord | null = null;
  for (const rec of Object.values(tasks)) {
    if (!rec || rec.kind !== kind) continue;
    if (predicate && !predicate(rec)) continue;
    if (!best || (rec.updatedAt || 0) > (best.updatedAt || 0)) best = rec;
  }
  return best;
}

// Every write is a read-modify-write of one storage key, so concurrent tasks
// would clobber each other's records. Funnel them through a single chain.
let writeChain: Promise<void> = Promise.resolve();

function mutateTasks(fn: (tasks: Record<string, BgTaskRecord>) => void): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      const tasks = await readBgTasks();
      fn(tasks);
      pruneTasks(tasks);
      await chrome.storage.local.set({ [BG_TASKS_KEY]: tasks });
    } catch {
      /* storage failures must never break the operation itself */
    }
  });
  return writeChain;
}

function pruneTasks(tasks: Record<string, BgTaskRecord>): void {
  const now = Date.now();
  for (const [id, rec] of Object.entries(tasks)) {
    if (!rec) {
      delete tasks[id];
      continue;
    }
    if (rec.status !== 'running' && now - (rec.updatedAt || 0) > TASK_RESULT_TTL_MS) {
      delete tasks[id];
    }
  }
  const ids = Object.keys(tasks);
  if (ids.length <= MAX_TASK_RECORDS) return;
  ids
    .sort((a, b) => (tasks[b].updatedAt || 0) - (tasks[a].updatedAt || 0))
    .slice(MAX_TASK_RECORDS)
    .forEach((id) => {
      if (tasks[id]?.status !== 'running') delete tasks[id];
    });
}

/** Marks a record as already shown, so reopening the panel doesn't replay it. */
export async function markBgTaskSeen(id: string): Promise<void> {
  await mutateTasks((tasks) => {
    if (tasks[id]) tasks[id].seenAt = Date.now();
  });
}

export async function clearBgTask(id: string): Promise<void> {
  await mutateTasks((tasks) => {
    delete tasks[id];
  });
}

// --- badge -----------------------------------------------------------------

/**
 * A dot on the toolbar icon is the only way to tell someone that work they
 * started finished while the panel was closed (a real notification would need
 * the "notifications" permission). The panel clears it as soon as it opens.
 */
async function setTaskBadge(on: boolean): Promise<void> {
  try {
    if (on) {
      await chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
      await chrome.action.setBadgeText({ text: '•' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    /* action API unavailable in this context — non-fatal */
  }
}

export async function clearTaskBadge(): Promise<void> {
  await setTaskBadge(false);
}

// --- runner (service worker only) ------------------------------------------

/** Tasks running in THIS worker generation. Empty after a worker restart,
 *  which is exactly how the sweep below detects interrupted work. */
const inFlight = new Map<string, Promise<unknown>>();

/** Module evaluation time == worker start time. */
const WORKER_BOOT_AT = Date.now();

const KEEPALIVE_INTERVAL_MS = 20_000;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    // Any extension API call resets the worker's idle timer. Without this the
    // worker is collected ~30s after the side panel closes, killing the fetch.
    try {
      void chrome.runtime.getPlatformInfo();
    } catch {
      /* ignore */
    }
  }, KEEPALIVE_INTERVAL_MS);
}

function stopKeepAliveIfIdle(): void {
  if (inFlight.size > 0 || keepAliveTimer === null) return;
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

/**
 * Runs `runner` as a durable task and returns its value, so existing call
 * sites can keep awaiting the response exactly as before. The difference is
 * that the work now survives the caller disappearing.
 */
export function runBackgroundTask<T>(
  kind: BgTaskKind,
  key: string,
  meta: Record<string, any> | undefined,
  runner: () => Promise<T>,
): Promise<T> {
  const id = bgTaskId(kind, key);
  const joined = inFlight.get(id) as Promise<T> | undefined;
  if (joined) return joined;

  const startedAt = Date.now();
  const promise = (async (): Promise<T> => {
    // Written before the runner starts: if the outcome landed first, this
    // write would resurrect a finished task as 'running'.
    await mutateTasks((tasks) => {
      tasks[id] = { id, kind, key, status: 'running', startedAt, updatedAt: startedAt, meta };
    });
    try {
      const result = await runner();
      await mutateTasks((tasks) => {
        const prev = tasks[id];
        tasks[id] = {
          ...(prev || { id, kind, key, startedAt, meta }),
          id,
          kind,
          key,
          status: 'done',
          result,
          error: undefined,
          updatedAt: Date.now(),
        };
      });
      void setTaskBadge(true);
      return result;
    } catch (error) {
      const message = (error as Error)?.message || 'Something went wrong';
      await mutateTasks((tasks) => {
        const prev = tasks[id];
        tasks[id] = {
          ...(prev || { id, kind, key, startedAt, meta }),
          id,
          kind,
          key,
          status: 'error',
          error: message,
          updatedAt: Date.now(),
        };
      });
      void setTaskBadge(true);
      throw error;
    } finally {
      inFlight.delete(id);
      stopKeepAliveIfIdle();
    }
  })();

  inFlight.set(id, promise);
  startKeepAlive();
  // The panel may be gone by the time this settles and nobody will await it —
  // swallow here so a failure isn't reported as an unhandled rejection. The
  // promise handed back to callers is unaffected.
  promise.catch(() => {});
  return promise;
}

/**
 * Marks tasks that were running when a previous worker generation died. Called
 * once at worker start: anything still 'running' from before boot has no fetch
 * behind it any more, so leaving it would strand the panel on a spinner.
 */
export async function sweepInterruptedTasks(): Promise<void> {
  await mutateTasks((tasks) => {
    const now = Date.now();
    for (const rec of Object.values(tasks)) {
      if (!rec || rec.status !== 'running') continue;
      if (inFlight.has(rec.id)) continue;
      if (rec.startedAt >= WORKER_BOOT_AT) continue;
      if (now - rec.startedAt > TASK_RESULT_TTL_MS) {
        // Long enough ago that the user has moved on — drop it rather than
        // greeting them with an error about something they've forgotten.
        delete tasks[rec.id];
        continue;
      }
      rec.status = 'error';
      rec.interrupted = true;
      rec.error = 'Chrome paused the extension before this finished. Please run it again.';
      rec.updatedAt = now;
    }
  });
}

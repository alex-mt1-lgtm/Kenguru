'use strict';

function createAccountProgress(user, onChange) {
  const cacheKey = `kenguru:account-progress:${encodeURIComponent(user.id)}`;
  const controller = new AbortController();
  const requestOptions = {signal: controller.signal, accountId: user.id};
  let remote = {};
  let pending = {};
  let firstAnswers = {};
  let revision = null;
  let loading = true;
  let running = false;
  let retryTimer;
  let retryDelay = 1000;

  try {
    const saved = JSON.parse(globalThis.sessionStorage?.getItem(cacheKey) ?? 'null');
    remote = saved?.progress ?? {};
    pending = saved?.pending ?? {};
    firstAnswers = saved?.firstAnswers ?? {};
  } catch {
    // Synchronization also works when browser storage is unavailable.
  }

  function cache() {
    try {
      globalThis.sessionStorage?.setItem(cacheKey, JSON.stringify({progress: remote, pending, firstAnswers}));
    } catch {
      // Keep changes in memory until the server accepts them.
    }
  }

  function read(key) {
    return pending[key] ?? remote[key] ?? null;
  }

  function accept({progress, revision: nextRevision}, sent = {}) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress) || !Number.isSafeInteger(nextRevision)) {
      throw new Error('Invalid progress response');
    }
    const before = {...remote, ...pending};
    remote = progress;
    revision = nextRevision;
    for (const [key, value] of Object.entries(pending)) {
      const stored = remote[key];
      if (stored === value || sent[key] === value) {
        delete pending[key];
      } else if (key.startsWith('rating:')) {
        if (stored) {
          delete pending[key];
        } else if (value === 'solved') {
          const prior = JSON.parse(remote[key.slice('rating:'.length)] ?? 'null');
          if (prior?.seen || prior?.reviewOpened || prior?.step > 0) pending[key] = 'reviewed';
        }
      } else if (stored && key !== 'current') {
        // Keep the newly chosen answer and step while preserving completion from either device.
        const localLesson = JSON.parse(value);
        const remoteLesson = JSON.parse(stored);
        pending[key] = JSON.stringify({
          ...localLesson,
          seen: localLesson.seen || remoteLesson.seen === true,
          reviewOpened: localLesson.reviewOpened || remoteLesson.reviewOpened === true || remoteLesson.step > 0,
        });
      }
    }
    for (const key of Object.keys(firstAnswers)) {
      if (pending['rating:' + key] !== 'solved') delete firstAnswers[key];
    }
    const changed = new Set([...Object.keys(before), ...Object.keys(remote)].filter(key => before[key] !== read(key)));
    cache();
    onChange(changed);
  }

  async function sync() {
    if (running || controller.signal.aborted) return;
    running = true;
    // Batch writes belonging to the same user action, such as a rating and its lesson step.
    await Promise.resolve();
    if (controller.signal.aborted) return;
    try {
      const {request} = globalThis.KenguruAccount;
      if (loading) {
        const result = await request('progress', undefined, requestOptions);
        if (controller.signal.aborted) return;
        loading = false;
        accept(result);
      }
      const progress = {...pending};
      if (Object.keys(progress).length) {
        try {
          const ratingAnswers = Object.fromEntries(Object.entries(firstAnswers).filter(([key]) => progress['rating:' + key] === 'solved'));
          const data = {revision, progress, ...(Object.keys(ratingAnswers).length ? {ratingAnswers} : {})};
          const result = await request('progress', data, requestOptions);
          if (!controller.signal.aborted) accept(result, progress);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error.status !== 409 || !error.payload?.progress) throw error;
          accept(error.payload);
        }
      }
      retryDelay = 1000;
    } catch {
      if (!controller.signal.aborted) {
        loading = true;
        retryTimer = globalThis.setTimeout(() => {
          retryTimer = undefined;
          sync();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    } finally {
      running = false;
      if (!controller.signal.aborted && retryTimer === undefined && (loading || Object.keys(pending).length)) sync();
    }
  }

  return {
    read,
    write(key, value, firstAnswer) {
      if (controller.signal.aborted || read(key) === value) return;
      pending[key] = value;
      if (key.startsWith('rating:') && value === 'solved' && Number.isInteger(firstAnswer)) {
        firstAnswers[key.slice('rating:'.length)] = firstAnswer;
      }
      cache();
      if (retryTimer === undefined) sync();
    },
    refresh() {
      if (retryTimer !== undefined) globalThis.clearTimeout(retryTimer);
      retryTimer = undefined;
      loading = true;
      sync();
    },
    close() {
      if (retryTimer !== undefined) globalThis.clearTimeout(retryTimer);
      controller.abort();
    },
  };
}

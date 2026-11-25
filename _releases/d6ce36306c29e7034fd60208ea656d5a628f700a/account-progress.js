'use strict';

function createAccountProgress(user, onChange) {
  const cacheKey = `kenguru:account-progress:${encodeURIComponent(user.id)}`;
  const controller = new AbortController();
  const requestOptions = {signal: controller.signal, accountId: user.id};
  const encoder = new TextEncoder();
  let remote = {};
  let pending = {};
  let firstAnswers = {};
  let revision = null;
  let loading = true;
  let inFlight;
  let retryTimer;
  let retryDelay = 1000;
  let blocked;
  let consecutiveConflicts = 0;
  const newAwards = new Set();

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
      try {
        // On large profiles, give unsent changes priority over the server snapshot.
        globalThis.sessionStorage?.setItem(cacheKey, JSON.stringify({pending, firstAnswers}));
      } catch {
        // Keep changes in memory until the server accepts them.
      }
    }
  }

  function read(key) {
    return pending[key] ?? remote[key] ?? null;
  }

  function acknowledge({progress, revision: nextRevision}, sent = {}) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress) || !Number.isSafeInteger(nextRevision)) {
      throw new Error('Invalid progress response');
    }
    const before = {...remote, ...pending};
    const confirmedBefore = remote;
    remote = progress;
    revision = nextRevision;
    for (const [key, value] of Object.entries(sent)) {
      if (key.startsWith('rating:') && value === 'solved' && !confirmedBefore[key] && remote[key] === 'solved') {
        newAwards.add(key);
      }
    }
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
      } else if (stored && /^\d{4}-[^/]+\/\d+$/.test(key)) {
        // Keep the chosen answer and step while preserving access to the walkthrough from either device.
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
      if (!pending['rating:' + key]) delete firstAnswers[key];
    }
    cache();
    const changed = new Set([...Object.keys(before), ...Object.keys(remote)].filter(key =>
      before[key] !== read(key) || (key.startsWith('rating:') && confirmedBefore[key] !== remote[key])));
    onChange(changed);
  }

  function hasChanges() {
    return Object.keys(pending).length > 0;
  }

  function batch() {
    const groups = new Map();
    for (const key of Object.keys(pending)) {
      const group = key.replace(/^rating:/, '');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(key);
    }
    const progress = {}, ratingAnswers = {};
    let bytes = 100;
    for (const keys of groups.values()) {
      const match = keys.find(key => key.startsWith('rating:'));
      const lesson = match?.slice('rating:'.length);
      const answer = match && Object.hasOwn(firstAnswers, lesson) ? firstAnswers[lesson] : undefined;
      const updates = Object.fromEntries(keys.map(key => [key, pending[key]]));
      const size = encoder.encode(JSON.stringify(updates)).length + (answer === undefined ? 0 : lesson.length + JSON.stringify(answer).length + 4);
      // Keep a rating claim and the accompanying lesson state in the same request.
      if (bytes > 100 && bytes + size > 500000) break;
      bytes += size;
      Object.assign(progress, updates);
      if (answer !== undefined) ratingAnswers[lesson] = answer;
    }
    return {revision, progress, ratingAnswers};
  }

  function report() {
    onChange(new Set());
  }

  function postpone() {
    retryTimer = globalThis.setTimeout(() => {
      retryTimer = undefined;
      sync();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }

  async function send() {
    // Batch writes belonging to the same action, such as rating and lesson state.
    await Promise.resolve();
    if (controller.signal.aborted) return;
    try {
      const {request} = globalThis.KenguruAccount;
      if (loading) {
        const result = await request('progress', undefined, requestOptions);
        if (controller.signal.aborted) return;
        loading = false;
        acknowledge(result);
      }
      if (hasChanges()) {
        const data = batch();
        try {
          const result = await request('progress', data, requestOptions);
          if (!controller.signal.aborted) acknowledge(result, data.progress);
        } catch (error) {
          if (error.status !== 409 || !error.payload?.progress) throw error;
          if (controller.signal.aborted) return;
          acknowledge(error.payload);
          if (++consecutiveConflicts > 2) postpone();
          return;
        }
      }
      consecutiveConflicts = 0;
      retryDelay = 1000;
    } catch (error) {
      if (controller.signal.aborted) return;
      loading = true;
      if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
        blocked = error.status;
      } else {
        postpone();
      }
    }
  }

  function sync() {
    if (controller.signal.aborted || blocked || retryTimer !== undefined) return inFlight;
    if (!inFlight && (loading || hasChanges())) {
      inFlight = send().finally(() => {
        inFlight = undefined;
        report();
        sync();
      });
    }
    return inFlight;
  }

  function retry(resetBlock = false) {
    if (resetBlock) blocked = undefined;
    if (retryTimer !== undefined) globalThis.clearTimeout(retryTimer);
    retryTimer = undefined;
    loading = true;
    return sync();
  }

  return {
    read,
    confirmed(key) { return remote[key] ?? null; },
    confirmedAward(key) { return newAwards.has(key); },
    hasChanges,
    status() {
      if (blocked) return {state: 'blocked', code: blocked};
      if (retryTimer !== undefined || (hasChanges() && globalThis.navigator?.onLine === false)) return {state: 'local'};
      if (hasChanges()) return {state: 'sending'};
      return {state: loading ? 'loading' : 'saved'};
    },
    write(key, value, firstAnswer) {
      if (controller.signal.aborted || read(key) === value) return;
      pending[key] = value;
      if (key.startsWith('rating:') && (Number.isInteger(firstAnswer) || typeof firstAnswer === 'string')) firstAnswers[key.slice('rating:'.length)] = firstAnswer;
      cache();
      report();
      sync();
    },
    refresh() { return retry(); },
    retry() { return retry(true); },
    async flush() {
      if (!hasChanges()) return true;
      await retry(true);
      while (inFlight && !blocked && retryTimer === undefined) await inFlight;
      return !hasChanges();
    },
    close({clear = false} = {}) {
      if (retryTimer !== undefined) globalThis.clearTimeout(retryTimer);
      controller.abort();
      if (clear) {
        try { globalThis.sessionStorage?.removeItem(cacheKey); } catch { /* Storage is unavailable. */ }
      }
    },
  };
}

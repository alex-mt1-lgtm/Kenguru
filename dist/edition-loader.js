'use strict';

const LESSONS = [];

(() => {
  const base = new URL('editions/', document.currentScript.src);
  const loaded = new Map();
  const requests = new Map();
  const address = id => new URL(id + '.js', base).href;
  const linked = /^#zadacha=(\d{4}(?:-[a-z0-9]{1,12}){1,4})\/\d+$/u.exec(location.hash);
  const preload = document.createElement('link');
  preload.rel = 'preload';
  preload.as = 'script';
  preload.href = address(linked?.[1] ?? '2024-3-4');
  document.head.append(preload);

  globalThis.KenguruEditions = {
    register(edition, layouts, descriptions) {
      loaded.set(edition.id, {edition, layouts, descriptions});
    },
    load(id) {
      if (loaded.has(id)) return Promise.resolve(loaded.get(id));
      if (!requests.has(id)) {
        const promise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = address(id);
          const finish = () => {
            script.remove();
            if (loaded.has(id)) resolve(loaded.get(id));
            else reject(new Error('Edition did not load'));
          };
          script.addEventListener('load', finish, {once: true});
          script.addEventListener('error', finish, {once: true});
          document.head.append(script);
        }).finally(() => requests.delete(id));
        requests.set(id, promise);
      }
      return requests.get(id);
    },
  };
})();

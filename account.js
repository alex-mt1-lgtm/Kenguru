(() => {
  'use strict';

  const endpoint = new URL('api/auth.php', document.baseURI);
  const unavailable = 'Сервис аккаунтов временно недоступен. Попробуйте ещё раз.';
  let csrf;
  let user;
  let pendingSession;

  // Capture the mail link before the lesson script restores its own fragment.
  function takeResetFragment() {
    const url = new URL(window.location.href);
    if (!url.hash.startsWith('#reset=')) return null;
    const token = url.hash.slice('#reset='.length);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    return token;
  }

  let incomingReset = takeResetFragment();

  async function send(action, data, method, signal, accountId) {
    const url = new URL(endpoint);
    url.searchParams.set('action', action);
    if (method === 'GET' && accountId !== undefined) url.searchParams.set('accountId', accountId);
    const sentCsrf = csrf;
    const headers = {Accept: 'application/json'};
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = sentCsrf;
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, {once: true});
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let response;
    let payload;
    try {
      response = await fetch(url, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers,
        body: method === 'POST' ? JSON.stringify(data ?? {}) : undefined,
        signal: controller.signal
      });
      payload = await response.json();
    } catch {
      if (signal?.aborted) throw signal.reason;
      throw new Error(unavailable);
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
    if (typeof payload?.csrf === 'string' && csrf === sentCsrf) csrf = payload.csrf;
    if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw Object.assign(new Error(payload?.error || unavailable), {status: response.status, payload});
    }
    return payload;
  }

  function setUser(next, restored = false) {
    if (next !== null && !(Number.isInteger(next?.id) && typeof next.username === 'string')) {
      throw new Error(unavailable);
    }
    const previous = user;
    user = next;
    if (previous === undefined || previous?.id !== user?.id || previous?.username !== user?.username) {
      window.dispatchEvent(new CustomEvent('kenguru:accountchange', {detail: {user, restored}}));
    }
  }

  function loadSession() {
    if (!pendingSession) {
      pendingSession = send('session', undefined, 'GET').then(payload => {
        if (!csrf) throw new Error(unavailable);
        setUser(payload.user, true);
      }).finally(() => { pendingSession = undefined; });
    }
    return pendingSession;
  }

  async function request(action, data, methodOrOptions) {
    const options = typeof methodOrOptions === 'string' ? {method: methodOrOptions} : methodOrOptions ?? {};
    const {method = data === undefined ? 'GET' : 'POST', signal, accountId} = options;
    const body = method === 'POST' && accountId !== undefined ? {...data, accountId} : data;
    const isCurrentAccount = () => !signal?.aborted && (accountId === undefined || user?.id === accountId);
    const sendScoped = () => {
      if (!isCurrentAccount()) throw new DOMException('Request aborted', 'AbortError');
      return send(action, body, method, signal, accountId);
    };
    try {
      if (method === 'POST' && !csrf) await loadSession();
      try {
        return await sendScoped();
      } catch (error) {
        if (method !== 'POST' || error.status !== 403 || !error.payload?.csrf) throw error;
        return await sendScoped();
      }
    } catch (error) {
      if (accountId !== undefined && isCurrentAccount()) {
        if (error.status === 401) setUser(null);
        if (error.status === 409 && Object.hasOwn(error.payload ?? {}, 'user')) setUser(error.payload.user, true);
      }
      throw error;
    }
  }

  window.KenguruAccount = {request};

  document.addEventListener('DOMContentLoaded', () => {
    const byId = id => document.getElementById(id);
    const menu = byId('profileMenu');
    const menuStatus = byId('accountMenuStatus');
    const openButton = byId('accountOpen');
    const logoutButton = byId('accountLogout');
    const dialog = byId('accountDialog');
    const notice = byId('accountNotice');
    const errorMessage = byId('accountError');
    const forms = [...dialog.querySelectorAll('[data-account-form]')];
    const controls = [...dialog.querySelectorAll('button[type="submit"].account-primary, [data-account-mode]')];
    const titles = {
      login: 'Вход в аккаунт',
      register: 'Создание аккаунта',
      'request-reset': 'Восстановление пароля',
      reset: 'Новый пароль'
    };
    let modeVersion = 0;
    let resetToken = '';
    let busy = false;

    function renderMenu(message) {
      menuStatus.textContent = message ?? (user ? `Вы вошли как ${user.username}` : '');
      openButton.hidden = Boolean(user);
      logoutButton.hidden = !user;
    }

    function setBusy(next) {
      busy = next;
      for (const control of [...controls, openButton, logoutButton]) {
        control.setAttribute('aria-disabled', String(busy));
      }
    }

    function showMode(mode, failure = '') {
      modeVersion++;
      if (mode !== 'reset') resetToken = '';
      byId('accountTitle').textContent = titles[mode];
      notice.textContent = '';
      errorMessage.textContent = '';
      for (const form of forms) {
        form.hidden = form.dataset.accountForm !== mode;
        const password = form.elements.namedItem('password');
        if (password) password.value = '';
      }
      if (!dialog.open) dialog.showModal();
      forms.find(form => !form.hidden).querySelector('input').focus();
      errorMessage.textContent = failure;
    }

    function openReset(token) {
      if (/^[a-f0-9]{64}$/.test(token)) {
        resetToken = token;
        showMode('reset');
      } else {
        showMode('request-reset', 'Ссылка недействительна. Запросите новую ссылку.');
      }
    }

    function validate(form, mode, data) {
      if (mode === 'register' && !/^[\p{Script=Latin}\p{Script=Cyrillic}0-9_-]{3,24}$/u.test(data.username)) {
        form.elements.namedItem('username').focus();
        return 'В имени пользователя допустимы русские и латинские буквы, цифры, дефис и подчёркивание.';
      }
      if (mode === 'register' || mode === 'reset') {
        if ([...data.password].length < 10) {
          form.elements.namedItem('password').focus();
          return 'Введите пароль из 10 или более символов.';
        }
        if (new TextEncoder().encode(data.password).length > 72) {
          form.elements.namedItem('password').focus();
          return 'Пароль слишком длинный. Введите более короткий.';
        }
      }
      return '';
    }

    for (const form of forms) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || form.hidden) return;
        const mode = form.dataset.accountForm;
        const version = modeVersion;
        const stillOpen = () => dialog.open && version === modeVersion;
        const data = Object.fromEntries(new FormData(form));
        notice.textContent = '';
        errorMessage.textContent = validate(form, mode, data);
        if (errorMessage.textContent) return;
        if (mode === 'reset') data.token = resetToken;
        setBusy(true);
        notice.textContent = 'Подождите…';
        try {
          const payload = await request(mode, data);
          if (mode === 'request-reset') {
            if (stillOpen()) notice.textContent = payload.message || 'Если аккаунт с таким адресом существует, мы отправим ссылку.';
          } else if (mode === 'reset') {
            setUser(payload.user);
            if (resetToken === data.token) resetToken = '';
            if (stillOpen()) {
              showMode('login');
              notice.textContent = payload.message || 'Пароль изменён. Войдите с новым паролем.';
            }
          } else {
            if (!payload.user) throw new Error(unavailable);
            setUser(payload.user);
            if (stillOpen()) dialog.close();
          }
        } catch (error) {
          if (stillOpen()) {
            notice.textContent = '';
            errorMessage.textContent = error.message;
          }
        } finally {
          setBusy(false);
        }
      });
    }

    dialog.addEventListener('click', event => {
      const control = event.target.closest('[data-account-mode]');
      if (control && !busy) showMode(control.dataset.accountMode);
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      resetToken = '';
      for (const form of forms) form.reset();
      (menu.open && !openButton.hidden ? openButton : byId('profileToggle')).focus();
    });
    openButton.addEventListener('click', () => { if (!busy) showMode('login'); });
    logoutButton.addEventListener('click', async () => {
      if (busy) return;
      setBusy(true);
      menuStatus.textContent = 'Выходим из аккаунта…';
      try {
        const payload = await request('logout', {});
        if (payload.user !== null) throw new Error(unavailable);
        setUser(null);
        renderMenu(payload.message || 'Вы вышли из аккаунта.');
        if (menu.open) openButton.focus();
      } catch (error) {
        renderMenu(user ? `Вы вошли как ${user.username}. ${error.message}` : error.message);
      } finally {
        setBusy(false);
      }
    });
    window.addEventListener('kenguru:accountchange', () => renderMenu());
    window.addEventListener('hashchange', () => {
      const token = takeResetFragment();
      if (token !== null) openReset(token);
    });

    byId('accountMenu').hidden = false;
    renderMenu('Проверяем вход…');
    if (incomingReset !== null) {
      openReset(incomingReset);
      incomingReset = null;
    }
    loadSession().catch(() => renderMenu(unavailable));
  }, {once: true});
})();

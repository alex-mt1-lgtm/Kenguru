(() => {
  'use strict';

  const endpoint = new URL('/api/auth.php', document.baseURI);
  const unavailable = 'Сервис аккаунтов временно недоступен. Попробуйте ещё раз.';
  let csrf;
  let user;
  let pendingSession;

  // Capture a mail link before the lesson script restores its own fragment.
  function takeAccountFragment() {
    const url = new URL(window.location.href);
    const request = /^#(reset|confirm-email)=(.*)$/u.exec(url.hash);
    if (!request) return null;
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    return {action: request[1], token: request[2]};
  }

  let incomingLink = takeAccountFragment();

  async function send(action, data, method, signal, accountId, page) {
    const url = new URL(endpoint);
    url.searchParams.set('action', action);
    if (action === 'leaderboard' && page !== undefined) url.searchParams.set('page', page);
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
      throw Object.assign(new Error(unavailable), {status: response?.status});
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

  function setUser(next, restored = false, clearLocal = false) {
    if (next !== null && !(Number.isInteger(next?.id) && typeof next.username === 'string')) {
      throw new Error(unavailable);
    }
    const previous = user;
    user = next;
    if (clearLocal && previous && previous.id !== user?.id) {
      try { window.sessionStorage.removeItem(`kenguru:account-progress:${encodeURIComponent(previous.id)}`); }
      catch { /* Storage is unavailable. */ }
    }
    if (previous === undefined || previous?.id !== user?.id || previous?.username !== user?.username ||
        previous?.email !== user?.email || previous?.emailConfirmed !== user?.emailConfirmed ||
        previous?.pendingEmail !== user?.pendingEmail) {
      window.dispatchEvent(new CustomEvent('kenguru:accountchange', {detail: {user, restored, clearLocal}}));
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
    const {method = data === undefined ? 'GET' : 'POST', signal, accountId, page} = options;
    const body = method === 'POST' && accountId !== undefined ? {...data, accountId} : data;
    const isCurrentAccount = () => !signal?.aborted && (accountId === undefined || user?.id === accountId);
    const sendScoped = () => {
      if (!isCurrentAccount()) throw new DOMException('Request aborted', 'AbortError');
      return send(action, body, method, signal, accountId, page);
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
    const standaloneSignIn = !menu.contains(byId('accountOpen'));
    const openButton = byId('accountOpen');
    const logoutButton = byId('accountLogout');
    const settingsButton = byId('accountSettings');
    const resendButton = byId('resendVerification');
    const dialog = byId('accountDialog');
    const notice = byId('accountNotice');
    const errorMessage = byId('accountError');
    const forms = [...dialog.querySelectorAll('[data-account-form]')];
    const controls = [...dialog.querySelectorAll('button[type="submit"].account-primary, [data-account-mode]')];
    const titles = {
      login: 'Вход в аккаунт',
      register: 'Создание аккаунта',
      'request-reset': 'Восстановление пароля',
      reset: 'Новый пароль',
      'edit-account': 'Данные аккаунта',
      'delete-account': 'Удаление аккаунта',
      'confirm-email': 'Подтверждение почты'
    };
    let modeVersion = 0;
    let resetToken = '';
    let busy = false;
    let settingsAfterLogin = false;

    function renderMenu(message) {
      const emailStatus = user?.pendingEmail ? 'Ждём подтверждения нового адреса.' :
        user?.emailConfirmed ? 'Почта подтверждена.' : 'Подтверди почту для восстановления пароля.';
      byId('accountMenuName').textContent = user?.username ?? '';
      byId('accountEmailHint').textContent = user ? emailStatus : '';
      menuStatus.textContent = message ?? '';
      if (standaloneSignIn) menu.hidden = !user;
      openButton.hidden = Boolean(user);
      logoutButton.hidden = !user;
      settingsButton.hidden = !user;
    }

    function setBusy(next) {
      busy = next;
      for (const control of [...controls, openButton, logoutButton, settingsButton, resendButton]) {
        control.setAttribute('aria-disabled', String(busy));
      }
    }

    function showMode(mode, failure = '', openSettings = false) {
      modeVersion++;
      settingsAfterLogin = openSettings;
      if (mode !== 'reset') resetToken = '';
      byId('accountTitle').textContent = titles[mode];
      notice.textContent = '';
      errorMessage.textContent = '';
      for (const form of forms) {
        form.hidden = form.dataset.accountForm !== mode;
        const password = form.elements.namedItem('password');
        if (password) password.value = '';
      }
      if (mode === 'edit-account' && user) {
        const form = forms.find(item => item.dataset.accountForm === mode);
        form.elements.namedItem('username').value = user.username;
        form.elements.namedItem('email').value = user.pendingEmail ?? user.email ?? '';
        byId('accountEmailStatus').textContent = user.pendingEmail
          ? `Ждём подтверждения ${user.pendingEmail}. Текущий адрес — ${user.email}.`
          : user.emailConfirmed ? 'Почта подтверждена.' : 'Почта пока не подтверждена.';
        resendButton.hidden = user.emailConfirmed && !user.pendingEmail;
      }
      if (!dialog.open) dialog.showModal();
      forms.find(form => !form.hidden).querySelector('input, button').focus();
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

    async function openAccountLink({action, token}) {
      if (action === 'reset') {
        openReset(token);
        return;
      }
      showMode('confirm-email');
      const version = modeVersion;
      setBusy(true);
      notice.textContent = 'Проверяем ссылку…';
      try {
        const payload = await request('verify-email', {token});
        setUser(payload.user);
        if (dialog.open && version === modeVersion) notice.textContent = payload.message;
      } catch (error) {
        if (dialog.open && version === modeVersion) {
          notice.textContent = '';
          errorMessage.textContent = error.message;
        }
      } finally {
        byId('afterConfirmEmail').dataset.accountMode = user ? 'edit-account' : 'login';
        byId('afterConfirmEmail').textContent = user ? 'К данным аккаунта' : 'Ко входу';
        setBusy(false);
      }
    }

    function validate(form, mode, data) {
      if (['register', 'edit-account'].includes(mode) && !/^[\p{Script=Latin}\p{Script=Cyrillic}0-9_-]{3,24}$/u.test(data.username)) {
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
        if (mode === 'delete-account') data.confirm = data.confirm === 'on';
        setBusy(true);
        notice.textContent = 'Подождите…';
        try {
          const scoped = mode === 'edit-account' || mode === 'delete-account';
          const payload = await request(mode, data, scoped ? {accountId: user?.id} : undefined);
          if (mode === 'request-reset') {
            if (stillOpen()) notice.textContent = payload.message || 'Если аккаунт с таким адресом существует, мы отправим ссылку.';
          } else if (mode === 'reset') {
            setUser(payload.user);
            if (resetToken === data.token) resetToken = '';
            if (stillOpen()) {
              showMode('login');
              notice.textContent = payload.message || 'Пароль изменён. Войдите с новым паролем.';
            }
          } else if (mode === 'delete-account') {
            setUser(null, false, true);
            if (stillOpen()) {
              showMode('login');
              notice.textContent = payload.message;
            }
          } else if (mode === 'register' || mode === 'edit-account') {
            setUser(payload.user);
            if (stillOpen()) {
              showMode('edit-account');
              notice.textContent = payload.message ?? '';
            }
          } else {
            if (!payload.user) throw new Error(unavailable);
            setUser(payload.user);
            if (stillOpen()) {
              if (settingsAfterLogin) showMode('edit-account');
              else dialog.close();
            }
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
      if (control && !busy) showMode(control.dataset.accountMode, '', control.hasAttribute('data-settings-after-login'));
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      resetToken = '';
      for (const form of forms) form.reset();
      (!openButton.hidden && (standaloneSignIn || menu.open) ? openButton : byId('profileToggle')).focus();
    });
    openButton.addEventListener('click', () => { if (!busy) showMode('login'); });
    settingsButton.addEventListener('click', () => {
      if (busy) return;
      menu.open = false;
      showMode('edit-account');
    });
    resendButton.addEventListener('click', async () => {
      if (busy || !user) return;
      const version = modeVersion;
      setBusy(true);
      notice.textContent = 'Отправляем письмо…';
      errorMessage.textContent = '';
      try {
        const payload = await request('send-verification', {}, {accountId: user.id});
        setUser(payload.user);
        if (dialog.open && version === modeVersion) {
          showMode('edit-account');
          notice.textContent = payload.message;
        }
      } catch (error) {
        if (dialog.open && version === modeVersion) {
          notice.textContent = '';
          errorMessage.textContent = error.message;
        }
      } finally {
        setBusy(false);
      }
    });
    logoutButton.addEventListener('click', async () => {
      if (busy) return;
      setBusy(true);
      byId('lessonPage').inert = true;
      menuStatus.textContent = 'Выходим из аккаунта…';
      try {
        const accountId = user?.id;
        if (window.KenguruAccount.flushProgress && !await window.KenguruAccount.flushProgress() &&
            !window.confirm('Не удалось синхронизировать последние изменения. Выйти и удалить их с этого устройства?')) {
          renderMenu('Ты остаёшься в аккаунте. Когда появится связь, попробуй сохранить изменения.');
          return;
        }
        const payload = await request('logout', {}, {accountId});
        if (payload.user !== null) throw new Error(unavailable);
        setUser(null, false, true);
        renderMenu(payload.message || 'Вы вышли из аккаунта.');
        menu.open = false;
        openButton.focus();
      } catch (error) {
        renderMenu(error.message);
      } finally {
        byId('lessonPage').inert = false;
        setBusy(false);
      }
    });
    window.addEventListener('kenguru:accountchange', () => renderMenu());
    window.addEventListener('hashchange', () => {
      const link = takeAccountFragment();
      if (link) openAccountLink(link);
    });

    byId('accountMenu').hidden = false;
    renderMenu('Проверяем вход…');
    if (incomingLink !== null) {
      openAccountLink(incomingLink);
      incomingLink = null;
    }
    loadSession().catch(() => renderMenu(unavailable));
  }, {once: true});
})();

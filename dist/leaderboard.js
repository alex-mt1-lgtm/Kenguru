(() => {
  'use strict';

  function setupLeaderboard() {
    const trigger = document.getElementById('openLeaderboard');
    if (!trigger) return;

    const dialog = document.createElement('dialog');
    dialog.id = 'leaderboardDialog';
    dialog.className = 'leaderboard';
    dialog.setAttribute('aria-labelledby', 'leaderboardTitle');
    dialog.innerHTML = `
      <div class="leaderboard-hero poster-heading">
        <div>
          <h2 id="leaderboardTitle">Рейтинг участников</h2>
          <p>Тренировочный рейтинг за самостоятельно решённые задачи.</p>
        </div>
        <button type="button" class="leaderboard-close" aria-label="Закрыть рейтинг" autofocus>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round"><path d="m5 5 10 10M15 5 5 15"/></svg>
        </button>
      </div>
      <div class="leaderboard-content">
        <details class="leaderboard-rules">
          <summary>Как начисляются баллы</summary>
          <p>Засчитывается ответ, выбранный к первому открытию разбора. За верный ответ сервер начисляет баллы один раз. Если ты решаешь без сети, результат появится после отправки. При конфликте действует история, уже сохранённая на сервере.</p>
        </details>
        <section class="leaderboard-current" aria-label="Ваше место в рейтинге" hidden>
          <div class="leaderboard-current-rank">
            <span>Ваше место</span><strong></strong>
          </div>
          <p class="leaderboard-current-name"></p>
          <dl class="leaderboard-current-score">
            <div><dt>Баллы</dt><dd data-score="points"></dd></div>
            <div><dt>Решено</dt><dd data-score="solved"></dd></div>
          </dl>
        </section>
        <div class="leaderboard-state" hidden>
          <p role="status" aria-live="polite" aria-atomic="true"></p>
          <button type="button" class="leaderboard-retry" hidden>Повторить</button>
        </div>
        <div class="leaderboard-results" aria-busy="false" hidden>
          <table class="leaderboard-table" aria-label="Места участников">
            <thead><tr>
              <th scope="col">Место</th><th scope="col">Участник</th>
              <th scope="col">Баллы</th><th scope="col">Решено</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <nav class="leaderboard-pagination" aria-label="Страницы рейтинга" hidden>
          <button type="button" class="leaderboard-prev" aria-label="Предыдущая страница">
            <span aria-hidden="true">←</span><span>Назад</span>
          </button>
          <span class="leaderboard-page"></span>
          <button type="button" class="leaderboard-next" aria-label="Следующая страница">
            <span>Далее</span><span aria-hidden="true">→</span>
          </button>
        </nav>
        <p class="leaderboard-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>`;
    document.body.append(dialog);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);

    const find = selector => dialog.querySelector(selector);
    const state = find('.leaderboard-state');
    const stateMessage = state.querySelector('p');
    const retry = find('.leaderboard-retry');
    const close = find('.leaderboard-close');
    const current = find('.leaderboard-current');
    const results = find('.leaderboard-results');
    const rows = find('tbody');
    const pagination = find('.leaderboard-pagination');
    const pageLabel = find('.leaderboard-page');
    const previous = find('.leaderboard-prev');
    const next = find('.leaderboard-next');
    const announcement = find('.leaderboard-announcement');
    const numberFormat = new Intl.NumberFormat('ru-RU');
    let request;
    let page = 1;
    let totalPages = 1;

    function format(value) {
      return Number.isInteger(value) && value >= 0 ? numberFormat.format(value) : '—';
    }

    function element(tag, text, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = text;
      return node;
    }

    function renderCurrent(entry) {
      current.hidden = !entry;
      if (!entry) {
        current.querySelector('strong').textContent = '';
        current.querySelector('.leaderboard-current-name').textContent = '';
        current.querySelector('[data-score="points"]').textContent = '';
        current.querySelector('[data-score="solved"]').textContent = '';
        return;
      }
      current.querySelector('strong').textContent = format(entry.rank);
      current.querySelector('.leaderboard-current-name').textContent = entry.username;
      current.querySelector('[data-score="points"]').textContent = format(entry.points);
      current.querySelector('[data-score="solved"]').textContent = format(entry.solved);
    }

    function nameAndBadge(entry) {
      const name = element('span', entry.username, 'leaderboard-username');
      if (!entry.isCurrent) return name;
      const content = document.createElement('span');
      content.className = 'leaderboard-name';
      content.append(name, element('span', 'Вы', 'leaderboard-you'));
      return content;
    }

    function renderRows(entries) {
      rows.replaceChildren(...entries.map(entry => {
        const row = document.createElement('tr');
        if (entry.isCurrent) row.classList.add('is-current');
        const name = document.createElement('th');
        name.scope = 'row';
        name.append(nameAndBadge(entry));
        const place = document.createElement('td');
        place.append(element('span', format(entry.rank),
          entry.rank === 1 ? 'leaderboard-rank is-first' : 'leaderboard-rank'));
        row.append(
          place, name,
          element('td', format(entry.points), 'leaderboard-points'),
          element('td', format(entry.solved), 'leaderboard-solved')
        );
        return row;
      }));
    }

    function renderPagination() {
      pagination.hidden = totalPages <= 1;
      pageLabel.textContent = `${format(page)} из ${format(totalPages)}`;
      previous.setAttribute('aria-disabled', String(page <= 1));
      next.setAttribute('aria-disabled', String(page >= totalPages));
    }

    function showState(message, kind) {
      state.hidden = !message;
      state.dataset.kind = kind;
      retry.hidden = kind !== 'error';
      stateMessage.textContent = message;
    }

    function abortRequest() {
      request?.abort();
      request = undefined;
    }

    async function loadPage(nextPage) {
      abortRequest();
      const controller = new AbortController();
      request = controller;
      page = nextPage;
      results.hidden = true;
      renderCurrent(null);
      results.setAttribute('aria-busy', 'true');
      announcement.textContent = '';
      showState('Загружаем рейтинг…', 'loading');
      renderPagination();
      try {
        const data = await window.KenguruAccount.request('leaderboard', undefined, {
          page: nextPage, signal: controller.signal,
        });
        if (controller.signal.aborted || !dialog.open || request !== controller) return;
        if (!(Array.isArray(data.entries) && Number.isInteger(data.page) && Number.isInteger(data.totalPages))) {
          throw new Error('Invalid leaderboard data');
        }
        page = data.page;
        totalPages = data.totalPages;
        renderCurrent(data.entries.some(entry => entry.isCurrent) ? null : data.current);
        renderPagination();
        renderRows(data.entries);
        results.hidden = data.entries.length === 0;
        if (data.entries.length) {
          showState('', '');
          announcement.textContent = `Страница ${format(page)} из ${format(totalPages)}. Участников: ${format(data.total)}.`;
        } else {
          showState('В рейтинге пока нет участников.', 'empty');
        }
      } catch {
        if (controller.signal.aborted || !dialog.open || request !== controller) return;
        showState('Рейтинг не загрузился. Попробуйте ещё раз.', 'error');
      } finally {
        if (request === controller) {
          request = undefined;
          results.setAttribute('aria-busy', 'false');
        }
      }
    }

    function dismiss() {
      abortRequest();
      dialog.close();
    }

    trigger.addEventListener('click', () => {
      if (dialog.open || trigger.hidden) return;
      const profile = document.getElementById('profileMenu');
      if (profile) profile.open = false;
      totalPages = 1;
      dialog.showModal();
      loadPage(1);
    });
    previous.addEventListener('click', () => {
      if (page > 1) loadPage(page - 1);
    });
    next.addEventListener('click', () => {
      if (page < totalPages) loadPage(page + 1);
    });
    retry.addEventListener('click', () => {
      close.focus();
      loadPage(page);
    });
    close.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', abortRequest);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dismiss();
    });
    dialog.addEventListener('close', () => {
      abortRequest();
      renderCurrent(null);
      renderRows([]);
      const profileToggle = document.getElementById('profileToggle');
      if (profileToggle?.getClientRects().length) profileToggle.focus();
      else document.getElementById('accountOpen')?.focus();
    });
    window.addEventListener('kenguru:accountchange', () => {
      if (dialog.open) dismiss();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLeaderboard, {once: true});
  } else {
    setupLeaderboard();
  }
})();

'use strict';

function formatRatingPoints(points) {
  const word = {one: 'балл', few: 'балла', many: 'баллов'}[taskPlural.select(points)] ?? 'баллов';
  return `${points} ${word}`;
}

function recordRatedTransition(step, index = task) {
  const lesson = LESSONS[index];
  const state = states[index];
  const answer = lesson.numericAnswer ?? lesson.answer;
  if (!activeProfileId || state.step !== 0 || step === 0 || !Number.isInteger(answer)) return 0;
  const key = 'rating:' + lessonKey(lesson);
  try {
    if (readProfileValue(activeProfileId, key)) return 0;
    const previous = readProgress(lessonKey(lesson));
    const independent = !state.seen && !previous?.seen && !previous?.reviewOpened && !(previous?.step > 0);
    const correct = independent && (lesson.acceptedAnswers?.includes(state.selected) ?? (state.selected === answer));
    writeProfileValue(activeProfileId, key, correct ? 'solved' : 'reviewed', independent ? state.selected : undefined);
    return correct ? lesson.points : 0;
  } catch {
    return 0;
  }
}

function getProfileRating() {
  const rating = {points: 0, solved: 0, hard: 0, levels: 0};
  const levels = new Set();
  try {
    for (const lesson of LESSONS) {
      const points = lesson.ratingPoints ?? lesson.points;
      if (!points) continue;
      if (accountProgress?.confirmed('rating:' + lessonKey(lesson)) !== 'solved') continue;
      rating.points += points;
      rating.solved += 1;
      if ([3, 4, 5].includes(points)) levels.add(points);
      if (points === 5) rating.hard += 1;
    }
  } catch {
    // Display the entries the browser permitted us to read.
  }
  rating.levels = levels.size;
  return rating;
}

function ratingAchievements(rating) {
  return [
    ['Первая задача', 'Решить одну задачу', rating.solved, 1],
    ['Первые десять', 'Решить 10 задач', rating.solved, 10],
    ['Полсотни задач', 'Решить 50 задач', rating.solved, 50],
    ['Пять баллов', 'Решить задачу на 5 баллов', rating.hard, 1],
    ['Все уровни', 'Решить задачи на 3, 4 и 5 баллов', rating.levels, 3],
    ['Сто баллов', 'Набрать 100 баллов', rating.points, 100],
  ];
}

function renderRatingSummary() {
  $('openProfileRating').hidden = !activeProfileId;
  if (!activeProfileId) return;
  $('profileRatingPoints').textContent = formatRatingPoints(getProfileRating().points);
}

function renderRatingDialog() {
  const rating = getProfileRating();
  $('ratingProfileName').textContent = accountProfile?.name ?? '';
  $('ratingPoints').textContent = rating.points.toLocaleString('ru-RU');
  $('ratingSolved').textContent = rating.solved.toLocaleString('ru-RU');
  const achievements = ratingAchievements(rating);
  $('ratingBadgeCount').textContent = `${achievements.filter(([, , value, goal]) => value >= goal).length} из ${achievements.length}`;
  $('ratingBadges').innerHTML = achievements.map(([title, description, value, goal]) => {
    const earned = value >= goal;
    return `<li class="rating-badge${earned ? ' is-earned' : ''}">
      <div class="rating-badge-label"><strong>${title}</strong><small>${description}</small></div>
      <div class="rating-badge-status">${earned ? 'Получено' :
        `<span>${value} / ${goal}</span><progress value="${value}" max="${goal}" aria-hidden="true"></progress>`}</div>
    </li>`;
  }).join('');
}

function setupProfileRating() {
  const dialog = $('profileRatingDialog');
  $('openProfileRating').onclick = () => {
    if (!activeProfileId) return;
    $('profileMenu').open = false;
    renderRatingDialog();
    dialog.showModal();
  };
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    ($('profileMenu').hidden ? $('accountOpen') : $('profileToggle')).focus();
  });
}

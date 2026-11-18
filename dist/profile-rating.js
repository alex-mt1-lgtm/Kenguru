'use strict';

function formatRatingPoints(points) {
  const word = {one: 'балл', few: 'балла', many: 'баллов'}[taskPlural.select(points)] ?? 'баллов';
  return `${points} ${word}`;
}

function recordRatedTransition(step) {
  const lesson = LESSONS[task];
  const state = current();
  if (!activeProfileId || state.step !== 0 || step === 0 || !Number.isInteger(lesson.answer)) return 0;
  const key = 'rating:' + lessonKey(lesson);
  try {
    if (readProfileValue(activeProfileId, key)) return 0;
    const previous = readProgress(lessonKey(lesson));
    const independent = !state.seen && !previous?.seen && !previous?.reviewOpened && !(previous?.step > 0);
    const correct = independent && state.selected === lesson.answer;
    writeProfileValue(activeProfileId, key, correct ? 'solved' : 'reviewed');
    return correct ? lesson.points : 0;
  } catch {
    return 0;
  }
}

function getProfileRating(profileId) {
  const rating = {points: 0, solved: 0, hard: 0, levels: 0};
  const levels = new Set();
  try {
    for (const lesson of LESSONS) {
      if (readProfileValue(profileId, 'rating:' + lessonKey(lesson)) !== 'solved') continue;
      rating.points += lesson.points;
      rating.solved += 1;
      levels.add(lesson.points);
      if (lesson.points === 5) rating.hard += 1;
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
  $('profileRatingPoints').textContent = formatRatingPoints(getProfileRating(activeProfileId).points);
}

function renderRatingDialog() {
  const profiles = availableProfiles();
  const rating = getProfileRating(activeProfileId);
  $('ratingProfileName').textContent = profiles.find(profile => profile.id === activeProfileId)?.name ?? '';
  $('ratingPoints').textContent = formatRatingPoints(rating.points);
  $('ratingSolved').textContent = taskCount(rating.solved);
  const achievements = ratingAchievements(rating);
  $('ratingBadgeCount').textContent = `${achievements.filter(([, , value, goal]) => value >= goal).length} из ${achievements.length}`;
  $('ratingBadges').innerHTML = achievements.map(([title, description, value, goal]) => {
    const earned = value >= goal;
    return `<li class="rating-badge${earned ? ' is-earned' : ''}">
      <div><strong>${title}</strong><span class="rating-badge-status">${earned ? 'Получено' : `${value} / ${goal}`}</span></div>
      <small>${description}</small>
    </li>`;
  }).join('');

  const entries = profiles.map(profile => ({
    ...profile,
    points: profile.id === activeProfileId ? rating.points : getProfileRating(profile.id).points,
  })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ru'));
  let place = 0;
  $('ratingLeaderboard').innerHTML = entries.map((entry, index) => {
    if (entries[index - 1]?.points !== entry.points) place = index + 1;
    const isActive = entry.id === activeProfileId;
    const name = entry.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return `<li${isActive ? ' aria-current="true"' : ''}>
      <span><b>${place}.</b> ${name}${isActive ? ' <small>(ты)</small>' : ''}</span>
      <strong>${formatRatingPoints(entry.points)}</strong>
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
  dialog.addEventListener('close', () => $('profileToggle').focus());
  globalThis.addEventListener?.('storage', event => {
    if (event.key && event.key !== profileListKey && !event.key.includes(':rating:')) return;
    renderRatingSummary();
    if (dialog.open) renderRatingDialog();
  });
}

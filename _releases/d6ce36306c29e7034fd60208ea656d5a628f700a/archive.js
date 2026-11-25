'use strict';

const gradeNav = document.querySelector('.archive-grades');
const grades = [...document.querySelectorAll('.archive-grade')];
const gradeLinks = [...gradeNav.querySelectorAll('a')];
const russianEditions = document.getElementById('russian');
const russianYear = document.getElementById('russianYear');
const newestRussianYear = russianYear.options[0].value;
let lastRussianYear = newestRussianYear;
russianYear.parentElement.hidden = false;
const subjectPicker = document.getElementById('archiveSubject');
const mathIntro = document.querySelector('.archive-heading .intro').textContent;
let lastMathGrade = '#grades-3-4';

function showArchiveGrade() {
  const target = document.getElementById(location.hash.slice(1));
  const russian = Boolean(target?.closest('#russian'));
  if (russian) {
    lastRussianYear = target === russianEditions ? newestRussianYear : target.id.slice('russian-'.length);
    russianYear.value = lastRussianYear;
    for (const group of russianEditions.querySelectorAll('.archive-editions')) group.hidden = group.id !== 'russian-' + lastRussianYear;
  }
  const contest = target?.closest('.subject-archive');
  let selectedYear;
  if (contest) {
    const picker = contest.querySelector('[data-contest-year]');
    selectedYear = target.closest('[data-contest-group]')?.dataset.contestGroup ?? picker.value;
    picker.value = selectedYear;
    picker.parentElement.hidden = false;
    for (const group of contest.querySelectorAll('[data-contest-group]')) group.hidden = group.dataset.contestGroup !== selectedYear;
  }
  const subject = contest?.id ?? (russian ? 'ru' : 'math');
  const math = subject === 'math';
  for (const section of document.querySelectorAll('.subject-archive')) section.hidden = section !== contest;
  subjectPicker.value = subject;
  document.getElementById('currentSubject').textContent = subjectPicker.selectedOptions[0].dataset.short ?? subjectPicker.selectedOptions[0].textContent;
  document.getElementById('editionToggle').dataset.subject = subject;
  document.getElementById('archivePeriod').textContent = contest?.dataset.period ?? (russian ? russianYear.options[russianYear.options.length - 1].value + '–' + newestRussianYear : '1997–2026');
  document.querySelector('.archive-heading .intro').textContent = contest || russian
    ? 'Выбери год конкурса и класс.' : mathIntro;
  for (const link of document.querySelectorAll('footer [data-subject]')) link.hidden = link.dataset.subject !== subject;
  const contestLesson = contest && (document.getElementById(contest.id + '-' + selectedYear)?.querySelector('.archive-open') ?? contest.querySelector('.archive-open'));
  const russianLesson = russian && (document.getElementById('russian-' + lastRussianYear)?.querySelector('.archive-open') ?? russianEditions.querySelector('.archive-open'));
  const lessonUrl = (contestLesson || russianLesson)?.getAttribute('href')?.replace('./#', '/#') ?? '/';
  document.querySelector('.archive-back').href = lessonUrl;
  document.querySelector('.archive-header .site-brand').href = lessonUrl;
  russianEditions.hidden = !russian;
  gradeNav.hidden = !math;
  const selected = target?.closest('.archive-grade') ?? document.getElementById('grades-3-4');
  if (math) lastMathGrade = '#' + selected.id;
  for (const group of grades) group.hidden = !math || group !== selected;
  selected.open = true;
  for (const link of gradeLinks) {
    document.getElementById(link.hash.slice(1))?.setAttribute('aria-label', link.textContent);
    if (link.hash === '#' + selected.id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  const decade = target?.closest('.archive-decade');
  if (decade) {
    decade.open = true;
    target.scrollIntoView({block: 'start'});
  }
}

const formatNames = {
  key: 'Проверка по ключу',
  mixed: 'Часть задач с проверкой по ключу',
  pdf: 'Только PDF',
};
const formats = globalThis.KENGURU_ARCHIVE_FORMATS ?? {};

for (const card of document.querySelectorAll('.archive-card')) {
  const solveLink = card.querySelector('a[href*="#zadacha="]');
  const edition = solveLink?.hash.slice('#zadacha='.length).split('/')[0];
  const text = !solveLink && card.closest('.subject-archive') ? '' : formatNames[solveLink ? formats[edition] : 'pdf'];
  if (!text) continue;
  const label = document.createElement('p');
  label.className = 'archive-format';
  label.textContent = text;
  card.querySelector('h3').after(label);
}

document.querySelector('.archive-page').classList.add('has-grade-nav');
for (const picker of document.querySelectorAll('[data-contest-year]')) {
  picker.addEventListener('change', () => { location.hash = picker.closest('.subject-archive').id + '-' + picker.value; });
}
showArchiveGrade();
window.addEventListener('hashchange', showArchiveGrade);
russianYear.addEventListener('change', () => { location.hash = 'russian-' + russianYear.value; });
const menu = document.getElementById('editionMenu');
subjectPicker.addEventListener('change', () => {
  location.hash = subjectPicker.value === 'ru' ? (lastRussianYear === newestRussianYear ? 'russian' : 'russian-' + lastRussianYear) : subjectPicker.value === 'math' ? lastMathGrade : subjectPicker.value;
  menu.open = false;
  document.getElementById('editionToggle').focus();
});
document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
menu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    document.getElementById('editionToggle').focus();
  }
});

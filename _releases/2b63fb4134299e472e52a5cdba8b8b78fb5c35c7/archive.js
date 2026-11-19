'use strict';

const gradeNav = document.querySelector('.archive-grades');
const grades = [...document.querySelectorAll('.archive-grade')];
const gradeLinks = [...gradeNav.querySelectorAll('a')];
const russianEditions = document.getElementById('russian');
const subjectPicker = document.getElementById('archiveSubject');
const mathIntro = document.querySelector('.archive-heading .intro').textContent;
let lastMathGrade = '#grades-3-4';

function showArchiveGrade() {
  const target = document.getElementById(location.hash.slice(1));
  const russian = target === russianEditions;
  const subject = russian ? 'ru' : 'math';
  subjectPicker.value = subject;
  document.getElementById('currentSubject').textContent = subjectPicker.selectedOptions[0].textContent;
  document.getElementById('editionToggle').dataset.subject = subject;
  document.getElementById('archivePeriod').textContent = russian ? '2025' : '1997–2026';
  document.querySelector('.archive-heading .intro').textContent = russian
    ? 'Выбери класс, чтобы открыть задания конкурса «Русский медвежонок» и пошаговые разборы.' : mathIntro;
  for (const link of document.querySelectorAll('footer [data-subject]')) link.hidden = link.dataset.subject !== subject;
  const lessonUrl = russian ? '/#zadacha=2025-medvezhonok-2-3/1' : '/';
  document.querySelector('.archive-back').href = lessonUrl;
  document.querySelector('.archive-header .site-brand').href = lessonUrl;
  russianEditions.hidden = !russian;
  gradeNav.hidden = russian;
  const selected = target?.closest('.archive-grade') ?? document.getElementById('grades-3-4');
  if (!russian) lastMathGrade = '#' + selected.id;
  for (const group of grades) group.hidden = russian || group !== selected;
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
  walkthrough: 'С разбором',
  key: 'Проверка по ключу',
  mixed: 'Разборы и проверка по ключу',
  pdf: 'Только PDF',
};
const formats = globalThis.KENGURU_ARCHIVE_FORMATS ?? {};

for (const card of document.querySelectorAll('.archive-card')) {
  const solveLink = card.querySelector('a[href*="#zadacha="]');
  const edition = solveLink?.hash.slice('#zadacha='.length).split('/')[0];
  const text = formatNames[solveLink ? formats[edition] : 'pdf'];
  if (!text) continue;
  const label = document.createElement('p');
  label.className = 'archive-format';
  label.textContent = text;
  card.querySelector('h3').after(label);
}

document.querySelector('.archive-page').classList.add('has-grade-nav');
showArchiveGrade();
window.addEventListener('hashchange', showArchiveGrade);
const menu = document.getElementById('editionMenu');
subjectPicker.addEventListener('change', () => {
  location.hash = subjectPicker.value === 'ru' ? 'russian' : lastMathGrade;
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

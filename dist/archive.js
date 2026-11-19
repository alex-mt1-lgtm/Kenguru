'use strict';

const gradeNav = document.querySelector('.archive-grades');
const grades = [...document.querySelectorAll('.archive-grade')];
const gradeLinks = [...gradeNav.querySelectorAll('a')];

function showArchiveGrade() {
  const target = document.getElementById(location.hash.slice(1));
  const selected = target?.closest('.archive-grade') ?? document.getElementById('grades-3-4');
  for (const group of grades) group.hidden = group !== selected;
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

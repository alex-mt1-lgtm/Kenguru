'use strict';

const archive = document.querySelector('.archive-page');
const gradePicker = archive.querySelector('.archive-grades');
const gradeLinks = [...gradePicker.querySelectorAll('a')];
const gradeSections = [...archive.querySelectorAll('.archive-grade')];

function showArchiveGrade() {
  const target = document.getElementById(location.hash.slice(1));
  const grade = target?.closest('.archive-grade') ?? gradeSections[0];

  for (const section of gradeSections) section.hidden = section !== grade;
  for (const link of gradeLinks) {
    if (link.hash === '#' + grade.id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }

  const decade = target?.closest('.archive-decade');
  if (decade) {
    decade.open = true;
    target.scrollIntoView();
  }
}

archive.classList.add('has-grade-picker');
showArchiveGrade();
window.addEventListener('hashchange', showArchiveGrade);

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {loadSubjects, idFor, fileKey} = require('./subject-data.cjs');
const root = path.join(__dirname, '..');
const subjects = {
  'british-bulldog': 'British Bulldog',
  'golden-fleece': 'Золотое руно',
  kit: 'КИТ',
  chip: 'Человек и природа',
};
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const groupKey = row => [row.year, row.session || '', row.grade].join('/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function materialLinks(subject, row) {
  const bookletLabel = row.readerFile ? 'Буклет для печати' : row.reviewedKey ? 'Исходный бланк' : 'Задания';
  const files = [[row.readerFile, 'Задания для чтения'], [row.tasksFile, bookletLabel], [row.answersFile, row.reviewedKey ? 'Редакционный ключ' : 'Ответы'],
    [row.solutionsFile, 'Решения'], [row.additionalSolutionsFile, 'Дополнительные решения'], [row.listeningFile, 'Аудио']];
  return files.filter(([file]) => file).map(([file, name]) => {
    if (!/^(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_.-]+$/u.test(file) || file.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('Invalid archive path ' + file);
    }
    const url = 'assets/' + subject + '/' + row.year + '/' + file;
    if (!fs.statSync(path.join(root, 'dist', url)).isFile()) throw new Error('Missing archive file ' + url);
    const ext = path.extname(file).slice(1).toUpperCase();
    return '<a href="' + escape(url) + '" target="_blank" rel="noopener">' + escape(name + ' ' + ext) + '</a>';
  }).join(' ');
}

function card(subject, variants, lesson) {
  const ordered = [...variants];
  const selected = lesson ? ordered.findIndex(row => row.tasksFile === lesson.tasksFile) : -1;
  if (selected > 0) ordered.unshift(ordered.splice(selected, 1)[0]);
  const row = ordered[0];
  const grade = row.grade.replace('-', '–') + (row.grade.includes('-') ? ' классы' : ' класс');
  const title = row.title ?? lesson?.title;
  const parts = ['<li class="archive-card"><h3>' + escape(grade) + '</h3>'];
  if (title) parts.push('<p class="archive-format">' + escape(title) + '</p>');
  const openLesson = entry => {
    if (!entry) return '';
    const label = entry.partial ? 'Решать задания в редакции сайта' : 'Решать вариант';
    return '<a class="archive-open" href="./#zadacha=' + idFor(entry) + '/' + (entry.firstNumber || 1) + '">' + label + '</a>';
  };
  if (ordered.length > 1 && (row.variantLabel || row.variant)) {
    parts.push('<p class="archive-format">' + escape(row.variantLabel || 'Вариант ' + row.variant) + '</p>');
  }
  parts.push(openLesson(lesson));
  if (row.archiveNote) parts.push('<p class="archive-format">' + escape(row.archiveNote) + '</p>');
  parts.push('<div class="archive-files">' + materialLinks(subject, row) + '</div>');
  if (!row.answersFile) parts.push('<p class="archive-format">Ключ пока не найден</p>');
  if (ordered.length > 1) {
    parts.push('<details class="archive-variants"><summary>Другие бланки (' + (ordered.length - 1) + ')</summary>');
    for (const variant of ordered.slice(1)) {
      const name = variant.variantLabel ?? (variant.variant ? 'Вариант ' + variant.variant : 'Другая копия буклета');
      parts.push('<p>' + escape(name) + '</p>' + openLesson(variant.interactive) + '<div class="archive-files">' + materialLinks(subject, variant) + '</div>');
    }
    parts.push('</details>');
  }
  return parts.join('') + '</li>';
}

function buildSubjectArchive(html) {
  const {editions, paper} = loadSubjects();
  const lessons = editions.map(e => e.meta);
  const sections = [];
  for (const [subject, name] of Object.entries(subjects)) {
    const interactive = lessons.filter(row => row.subject === subject);
    const manifest = path.join(root, 'sources', subject, 'archive-materials.json');
    const materials = fs.existsSync(manifest) ? readJson(manifest) : [];
    const groups = new Map();
    for (const row of materials) {
      if (!Number.isInteger(row.year) || !/^\d+(?:-\d+)?$/.test(row.grade) || !row.tasksFile) {
        throw new Error(subject + ': invalid archive material ' + JSON.stringify(row));
      }
      const key = groupKey(row);
      if (!groups.has(key)) groups.set(key, []);
      const reviewed = subject === 'golden-fleece' && paper.get(fileKey(row));
      groups.get(key).push(reviewed ? {...row, answersFile: reviewed.meta.answersFile, reviewedKey:true} : row);
    }
    for (const lesson of interactive) {
      const key = groupKey(lesson);
      if (!groups.has(key)) groups.set(key, []);
      const variants = groups.get(key);
      const existing = variants.find(row => row.tasksFile === lesson.tasksFile);
      if (existing) Object.assign(existing, lesson, {interactive: lesson});
      else variants.unshift({...lesson, interactive:lesson});
    }
    const years = [...new Set([...groups.values()].map(rows => rows[0].year))].sort((a, b) => b - a);
    const options = years.map(y => '<option>' + y + '</option>').join('');
    const period = years.length > 1 ? years.at(-1) + '–' + years[0] : years[0];
    const lines = ['    <section class="subject-archive" id="' + subject + '" data-period="' + period + '">',
      '      <h2>' + escape(name) + '</h2>',
      '      <label class="archive-russian-year" hidden>Год конкурса <select data-contest-year>' + options + '</select></label>'];
    for (const year of years) {
      lines.push('      <div id="' + subject + '-' + year + '" data-contest-group="' + year + '"><h3 class="archive-year-heading">' +
        year + '</h3><ul class="archive-editions">');
      const byGrade = [...groups.values()].filter(rows => rows[0].year === year).sort((a, b) =>
        a[0].grade.localeCompare(b[0].grade, 'ru', {numeric: true}) || String(a[0].session || '').localeCompare(b[0].session || ''));
      for (const group of byGrade) lines.push('        ' + card(subject, group, group.find(row => row.interactive)?.interactive));
      lines.push('      </ul></div>');
    }
    sections.push([...lines, '    </section>'].join('\n'));
  }
  const marker = /(    <!-- subject-editions:start -->\n)[\s\S]*?(    <!-- subject-editions:end -->)/;
  if (!marker.test(html)) throw new Error('Missing archive section markers');
  return html.replace(marker, (_, start, end) => start + sections.join('\n') + '\n' + end);
}

module.exports = {buildSubjectArchive};

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../sources/medvezhonok');
const assets = path.resolve(__dirname, '../dist/assets/medvezhonok');
const manifest = path.join(source, 'archive-materials.json');

function readMaterials() {
  if (!fs.existsSync(manifest)) return [];
  const rows = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const ids = new Set();
  for (const row of rows) {
    const id = row.year + '/' + row.grade;
    if (!Number.isInteger(row.year) || !/^\d+(?:-\d+)?$/.test(row.grade) || !row.tasksFile || ids.has(id)) {
      throw new Error('Invalid Russian archive entry ' + id);
    }
    ids.add(id);
    for (const name of [row.tasksFile, row.answersFile, row.solutionsFile].filter(Boolean)) {
      if (!/^[\p{L}\p{N}_.-]+\.pdf$/u.test(name) || !fs.statSync(path.join(assets, String(row.year), name)).isFile()) {
        throw new Error(id + ': missing or invalid PDF ' + name);
      }
    }
  }
  return rows;
}

function buildRussianArchive(html) {
  const rows = readMaterials();
  const section = /<section id="russian"[^>]*>[\s\S]*?<\/section>/;
  const current = html.match(section)[0];
  const years = new Map();
  function add(year, grade, card) {
    if (!years.has(year)) years.set(year, new Map());
    if (years.get(year).has(grade)) throw new Error('Duplicate Russian archive card ' + year + '/' + grade);
    years.get(year).set(grade, card);
  }
  // Keep hand-edited links to reading copies and corrected keys in the first 44 editions.
  for (const match of current.matchAll(/<li class="archive-card"><h3>(\d+) · (\d+(?:–\d+)?) классы<\/h3>[\s\S]*?<\/li>/g)) {
    add(Number(match[1]), match[2].replace('–', '-'), match[0]);
  }
  for (const {year, grade, tasksFile, answersFile, solutionsFile} of rows) {
    const interactive = fs.existsSync(path.join(source, String(year), 'editions', grade + '.json'));
    const base = 'assets/medvezhonok/' + year + '/';
    const links = [[tasksFile, 'Задания'], [answersFile, 'Ответы'], [solutionsFile, 'Решения']].filter(([file]) => file)
      .map(([file, label]) => '<a href="' + base + file + '" target="_blank" rel="noopener">' + label + ' PDF</a>').join(' ');
    const solve = interactive ? '<a class="archive-open" href="./#zadacha=' + year + '-medvezhonok-' + grade + '/1">Решать вариант</a>' : '';
    const title = grade.replace('-', '–') + (grade.includes('-') ? ' классы' : ' класс');
    add(year, grade, '<li class="archive-card" data-russian-material><h3>' + year + ' · ' + title + '</h3>' + solve + '<div class="archive-files">' + links + '</div></li>');
  }
  const ordered = [...years.keys()].sort((a,b) => b-a);
  const options = ordered.map(year => '<option>' + year + '</option>').join('');
  const lines = ['<section id="russian" aria-label="Русский медвежонок">', '      <h2>Русский медвежонок</h2>',
    '      <label class="archive-russian-year" hidden>Год конкурса <select id="russianYear">' + options + '</select></label>'];
  for (const year of ordered) {
    const cards = [...years.get(year)].sort(([a], [b]) => a.localeCompare(b, 'ru', {numeric:true}));
    lines.push('      <ul class="archive-editions" id="russian-' + year + '" aria-label="' + year + ' год">',
      ...cards.map(([, card]) => '        ' + card), '      </ul>');
  }
  return html.replace(section, () => [...lines, '    </section>'].join('\n'));
}

module.exports = {readMaterials, buildRussianArchive};

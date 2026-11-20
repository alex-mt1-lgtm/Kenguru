'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '../dist');
const defaultScripts = [
  'lessons.js', 'four-point-lessons.js', 'five-point-lessons.js',
  'four-point-scenes.js', 'five-point-scenes.js',
];
const yearScripts = [
  'legacy-catalog', 'legacy-conditions', 'choice-layouts', 'legacy-editions',
  '2000-visual', '2000-three', '2000-four', '2000-five', '2000',
  '2020', '2021', '2022', '2023', '2025', '2026-condition-art', '2026',
  'grades-5-6-data', 'grade-conditions', 'grade-solution-steps',
  'visual-2024-three', 'visual-2024-four', 'visual-2024-five', 'visual-2000-five-six',
  'visual-2026-three', 'visual-2026-four', 'visual-2026-five',
  'grade-5-6-keys', 'grade-titles', 'grades-5-6',
  'grades-7-8-data', 'grade-junior-senior-data', 'grade-editions',
];
const yearFile = name => `years/${name}.js`;
const readScript = file => fs.readFileSync(path.join(dist, file), 'utf8');

function loadLessonCatalog() {
  const context = vm.createContext({});
  const descriptions = yearFile('graphic-answer-descriptions');
  const files = [...defaultScripts, 'lesson-visuals.js', ...yearScripts.map(yearFile), 'contests/medvezhonok-2025.js'];
  if (fs.existsSync(path.join(dist, descriptions))) files.push(descriptions);
  for (const file of files) vm.runInContext(readScript(file), context, {filename: file});
  const russianRows = new Map();
  vm.runInContext(readScript('contests/medvezhonok-archive.js'), context);
  for (let year = 2024; year >= 2004; year--) {
    const directory = path.join(dist, '../sources/medvezhonok', String(year));
    const read = file => JSON.parse(fs.readFileSync(path.join(directory, file + '.json'), 'utf8'));
    const tasks = read('tasks');
    const reviews = read('reviews');
    const figures = fs.existsSync(path.join(directory, 'figures.json')) ? read('figures') : {};
    const corrections = fs.existsSync(path.join(directory, 'corrections.json')) ? read('corrections') : {};
    for (const [grade, list] of Object.entries(tasks)) {
      if (reviews[grade]?.length !== list.length) throw new Error(year + '/' + grade + ': incomplete walkthroughs');
      const rows = list.map((task, i) => {
        const id = grade + '/' + (i + 1);
        return {...task, ...corrections[id], review: reviews[grade][i], figure: figures[id]};
      });
      const edition = context.makeMedvezhonokEdition(year, grade, rows);
      russianRows.set(edition.id, rows);
      context.MEDVEZHONOK_EDITIONS.push(edition);
    }
  }
  const subjectRows = new Map();
  context.SUBJECT_EDITIONS = [];
  vm.runInContext(readScript('contests/subject-edition.js'), context);
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, '../sources/subject-editions.json'), 'utf8'));
  for (const meta of manifest) {
    const file = path.join(dist, '../sources', meta.subject, String(meta.year), meta.grade + '.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (rows.length !== meta.count) throw new Error(file + ': incomplete edition');
    for (const [index, row] of rows.entries()) {
      const numeric = Number.isInteger(row.numericAnswer);
      const validAnswer = numeric ? row.choices.length === 0
        : row.choices.length === meta.letters.length && Number.isInteger(row.answer)
          && row.answer >= 0 && row.answer < row.choices.length;
      if (!row.question || !validAnswer || row.steps.length < 2 || row.steps.some(step => !step.trim())) {
        throw new Error(file + ': incomplete question or walkthrough at ' + (index + 1));
      }
    }
    const edition = context.makeSubjectEdition(meta, rows);
    subjectRows.set(edition.id, {meta, rows});
    context.SUBJECT_EDITIONS.push(edition);
  }
  const app = readScript('app.js');
  const end = app.indexOf('\nconst $=id=>');
  if (end === -1) throw new Error('Cannot find the lesson catalogue');
  vm.runInContext(app.slice(0, end), context, {filename: 'app.js'});
  const {lessons, catalog} = vm.runInContext('({lessons: LESSONS, catalog: CATALOG})', context);
  return {
    lessons, catalog, context, russianRows, subjectRows,
    choiceLayouts: context.KENGURU_CHOICE_LAYOUTS ?? {},
    graphicAnswerDescriptions: context.KENGURU_GRAPHIC_ANSWER_DESCRIPTIONS ?? {},
  };
}

module.exports = {defaultScripts, dist, loadLessonCatalog, readScript, yearFile};

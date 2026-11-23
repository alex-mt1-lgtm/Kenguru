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
  const completedMath = require('./math-completion.cjs').loadCompletedMath();
  vm.runInNewContext(readScript(yearFile('grade-editions')), {
    KenguruVisual: context.KenguruVisual,
    KENGURU_ARCHIVE: context.KENGURU_ARCHIVE,
    KENGURU_GRADES_7_8: completedMath,
  });
  for (const {id, reviewedKey} of completedMath) {
    if (reviewedKey) context.KENGURU_ARCHIVE[id].sources.reviewedKey = true;
  }
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
  const russianMaterials = require('./russian-archive.cjs').readMaterials();
  for (const material of russianMaterials) {
    const {year, grade} = material;
    const file = path.join(dist, '../sources/medvezhonok', String(year), 'editions', grade + '.json');
    if (!fs.existsSync(file)) continue;
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!rows.length || rows.some(row => !row.question?.trim() || !Array.isArray(row.choices) ||
        !/^[АБВГД]$/.test(row.key) || 'АБВГД'.indexOf(row.key) >= row.choices.length ||
        row.review?.length !== 3 || !row.review.every(step => typeof step === 'string' && step.trim()))) {
      throw new Error(file + ': incomplete tasks or walkthroughs');
    }
    const edition = context.makeMedvezhonokEdition(year, grade, rows, material);
    if (context.MEDVEZHONOK_EDITIONS.some(previous => previous.id === edition.id)) {
      throw new Error('Duplicate Russian edition ' + edition.id);
    }
    russianRows.set(edition.id, rows);
    context.MEDVEZHONOK_EDITIONS.push(edition);
  }
  const subjectRows = new Map();
  context.SUBJECT_EDITIONS = [];
  vm.runInContext(readScript('contests/subject-edition.js'), context);
  for (const {meta, rows, file} of require('./subject-data.cjs').loadSubjects().editions) {
    if (rows.length !== meta.count) throw new Error(file + ': incomplete edition');
    if (meta.sections) {
      if (!Array.isArray(meta.sections) || meta.sections[0]?.start !== 1) {
        throw new Error(file + ': named sections must start at question 1');
      }
      let previous = 0;
      for (const {start, title} of meta.sections) {
        if (!Number.isInteger(start) || start <= previous || start > rows.length || typeof title !== 'string' || !title.trim()) {
          throw new Error(file + ': invalid section boundary or title at question ' + start);
        }
        previous = start;
      }
    }
    for (const [index, row] of rows.entries()) {
      const numeric = Number.isInteger(row.numericAnswer);
      const choiceCounts = meta.choiceCounts ?? [meta.letters.length];
      const validAnswer = numeric ? row.choices.length === 0 && row.numericAnswer >= 0 && row.numericAnswer <= 999999
        : row.choices.length >= 2 && choiceCounts.includes(row.choices.length) && row.choices.length <= meta.letters.length
          && Number.isInteger(row.answer) && row.answer >= 0 && row.answer < row.choices.length;
      const points = row.points ?? meta.points;
      if (!row.question || !validAnswer || row.acceptedAnswers || row.keyConflict ||
          !Number.isInteger(points) || points <= 0 || row.steps.length < 2 || row.steps.some(step => !step.trim())) {
        throw new Error(file + ': incomplete question, score or walkthrough at ' + (row.number ?? index + 1));
      }
    }
    const edition = context.makeSubjectEdition(meta, rows);
    if (subjectRows.has(edition.id)) throw new Error(file + ': duplicate edition ' + edition.id);
    subjectRows.set(edition.id, {meta, rows});
    context.SUBJECT_EDITIONS.push(edition);
  }
  const app = readScript('app.js');
  const end = app.indexOf('\nconst $=id=>');
  if (end === -1) throw new Error('Cannot find the lesson catalogue');
  vm.runInContext(app.slice(0, end), context, {filename: 'app.js'});
  const {lessons, catalog} = vm.runInContext('({lessons: LESSONS, catalog: CATALOG})', context);
  return {
    lessons, catalog, context, completedMath, russianRows, russianMaterials, subjectRows,
    choiceLayouts: context.KENGURU_CHOICE_LAYOUTS ?? {},
    graphicAnswerDescriptions: context.KENGURU_GRAPHIC_ANSWER_DESCRIPTIONS ?? {},
  };
}

module.exports = {defaultScripts, dist, loadLessonCatalog, readScript, yearFile};

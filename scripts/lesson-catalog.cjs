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
  const files = [...defaultScripts, 'lesson-visuals.js', ...yearScripts.map(yearFile)];
  if (fs.existsSync(path.join(dist, descriptions))) files.push(descriptions);
  for (const file of files) vm.runInContext(readScript(file), context, {filename: file});
  const app = readScript('app.js');
  const end = app.indexOf('\nconst $=id=>');
  if (end === -1) throw new Error('Cannot find the lesson catalogue');
  vm.runInContext(app.slice(0, end), context, {filename: 'app.js'});
  const {lessons, catalog} = vm.runInContext('({lessons: LESSONS, catalog: CATALOG})', context);
  return {
    lessons, catalog, context,
    choiceLayouts: context.KENGURU_CHOICE_LAYOUTS ?? {},
    graphicAnswerDescriptions: context.KENGURU_GRAPHIC_ANSWER_DESCRIPTIONS ?? {},
  };
}

module.exports = {defaultScripts, dist, loadLessonCatalog, readScript, yearFile};

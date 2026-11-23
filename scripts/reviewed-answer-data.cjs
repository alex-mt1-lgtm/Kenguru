'use strict';
const {loadSubjects} = require('./subject-data.cjs');
const {editions, paper} = loadSubjects();
const output = new Map();
function add(meta, rows, partial, paperKey = false) {
  const filename = meta.answersFile;
  const title = [meta.contest, meta.year, meta.grade.replace('-', '–') + ' кл.', meta.editionLabel || meta.sessionTitle].filter(Boolean).join(' · ');
  const data = rows.map((row, i) => {
    const number = row.number ?? i + 1;
    const matching = meta.matchingGroups?.find(group => number >= group.start && number < group.start + group.count);
    return {number, choices: row.choices, answer: row.answer, acceptedAnswers: row.acceptedAnswers, numericAnswer: row.numericAnswer,
      ...(row.reviewedEdition && row.review ? {solution: row.review.slice(1), keyNote: row.keyNote} : {}),
      ...((paperKey && row.question || row.adaptation || row.reviewedEdition) ? {
        revisedQuestion: [row.context, row.question].filter(Boolean).join('\n\n'), revisedChoices: row.choices,
        figure: row.figure, figures: row.figures, optionFigures: row.optionFigures} : {}),
      ...(matching ? {matching, label: 'Рисунок ' + (number - matching.start + 1)} : {})};
  });
  output.set([meta.subject, meta.year, filename].join('/'), {subject:meta.subject, year:meta.year, grade:meta.grade,
    title, filename, letters:meta.letters, partial, rows:data});
}
for (const {meta, rows} of editions) add(meta, rows, Boolean(meta.partial));
for (const {meta, rows, partial} of paper.values()) add(meta, rows, partial, true);
const model = require('./lesson-catalog.cjs').loadLessonCatalog();
for (const set of model.catalog.filter(s => s.subject === 'ru' && s.sources.reviewedKey)) {
  const grade = set.grades.join('-');
  const rows = model.russianRows.get(set.id);
  add({subject:'medvezhonok', contest:'Русский медвежонок', year:set.year, grade, letters:'АБВГД',
    answersFile:'reviewed-' + grade + '.pdf'}, rows.map((row, i) => ({...row, figure:row.figure?.condition, optionFigures:row.figure?.options, answer:model.lessons[set.indices[i]].answer, choices:model.lessons[set.indices[i]].choices})), false);
}
process.stdout.write(JSON.stringify([...output.values()]));

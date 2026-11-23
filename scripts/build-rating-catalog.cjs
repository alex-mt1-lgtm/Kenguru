'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {dist, loadLessonCatalog} = require('./lesson-catalog.cjs');

function buildRatingCatalog() {
  const {lessons} = loadLessonCatalog();
  const catalog = Object.fromEntries(lessons.filter(lesson => Number.isInteger(lesson.numericAnswer ?? lesson.answer))
    .map(lesson => [lesson.datasetId + '/' + lesson.number, Number.isInteger(lesson.numericAnswer)
      ? [lesson.numericAnswer, lesson.points, 'number'] : [lesson.answer, lesson.points, ...(lesson.acceptedAnswers ? [lesson.acceptedAnswers] : [])]]));
  return JSON.stringify(catalog) + '\n';
}

module.exports = {buildRatingCatalog};

if (require.main === module) {
  const encoded = buildRatingCatalog();
  const output = path.join(dist, 'api/rating-catalog.json');

  if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== encoded) {
      throw new Error('Run node scripts/build-rating-catalog.cjs to update the rating catalogue');
    }
  } else {
    fs.writeFileSync(output, encoded);
  }
}

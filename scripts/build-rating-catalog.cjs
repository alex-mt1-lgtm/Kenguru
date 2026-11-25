'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {dist, loadLessonCatalog} = require('./lesson-catalog.cjs');

function buildRatingCatalog() {
  const {lessons} = loadLessonCatalog();
  const catalog = {};
  for (const lesson of lessons) {
    const id = lesson.datasetId + '/' + lesson.number;
    if (lesson.textAnswer !== undefined) {
      catalog[id] = [lesson.textAnswer, lesson.points, 'text'];
    } else if (Number.isInteger(lesson.numericAnswer)) {
      catalog[id] = [lesson.numericAnswer, lesson.points, 'number'];
      if (lesson.acceptedNumericAnswers) catalog[id].push(lesson.acceptedNumericAnswers);
    } else if (Number.isInteger(lesson.answer)) {
      catalog[id] = [lesson.answer, lesson.points];
      if (lesson.acceptedAnswers) catalog[id].push(lesson.acceptedAnswers);
    }
  }
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

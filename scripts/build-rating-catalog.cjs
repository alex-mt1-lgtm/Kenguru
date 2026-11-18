'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.resolve(__dirname, '../dist');
function buildRatingCatalog() {
  const page = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const context = vm.createContext({});
  for (const [, file] of page.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/gu)) {
    if (file === 'app.js') break;
    if (file !== 'account.js') vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, {filename: file});
  }

  const app = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
  const end = app.indexOf('\nconst $=id=>');
  if (end === -1) throw new Error('Cannot find the lesson catalogue');
  vm.runInContext(app.slice(0, end), context, {filename: 'app.js'});
  const catalog = vm.runInContext(`Object.fromEntries(LESSONS
    .filter(lesson => Number.isInteger(lesson.answer))
    .map(lesson => [lesson.datasetId + '/' + lesson.number, [lesson.answer, lesson.points]]))`, context);
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

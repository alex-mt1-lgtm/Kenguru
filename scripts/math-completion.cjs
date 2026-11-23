'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'sources/math-completion');

function loadCompletedMath() {
  const datasets = ['archive-manifest', 'grade-7-8-manifest'].flatMap(name =>
    JSON.parse(fs.readFileSync(path.join(root, 'sources', name + '.json'), 'utf8')).datasets);
  const editions = new Map(datasets.map(edition => [edition.id, edition]));
  return fs.readdirSync(directory).sort().filter(name => /^\d{4}-(?:3-4|7-8)\.json$/.test(name)).map(file => {
    const id = file.slice(0, -5);
    const [year, lower] = id.split('-').map(Number);
    const rows = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    const expected = lower === 7 ? 30 : year === 1997 ? 25 : 26;
    if (rows.length !== expected) throw new Error(id + ': incomplete booklet');
    const titles = new Set();
    const cards = rows.map(({steps, ...card}, i) => {
      if (card.number !== i + 1 || !card.question?.trim() || !card.title?.trim() ||
          card.title.length > 30 || titles.has(card.title) || !Array.isArray(card.options) || card.options.length !== 5 ||
          !Number.isInteger(card.answer) || card.answer < 0 || card.answer >= card.options.length ||
          ![3, 4, 5].includes(card.points) || !Array.isArray(steps) || steps.length < 2 ||
          !steps.every(step => typeof step === 'string' && step.trim()) ||
          card.options.some(option => option.image ? !option.description?.trim() : !option.text?.trim()) ||
          (card.condition && !(card.condition.src && card.condition.alt?.trim()))) {
        throw new Error(id + ': incomplete task ' + (i + 1));
      }
      titles.add(card.title);
      for (const image of [card.condition?.src, ...card.options.map(option => option.image)].filter(Boolean)) {
        if (!fs.existsSync(path.join(root, 'dist', image))) throw new Error(id + ': missing ' + image);
      }
      const review = steps.map((text, j) => ({title: j === steps.length - 1 ? 'Ответ' : 'Решение', text}));
      return {...card, review};
    });
    const meta = editions.get(id);
    if (!meta) throw new Error('Missing archive entry for ' + id);
    if (cards.some(card => card.questionNote || card.keyNote) && !meta.reviewedKey) {
      throw new Error('Missing editorial key for ' + id);
    }
    const answerLetters = year <= 2007 && !(year === 1997 && lower === 3) ? 'ABCDE' : 'АБВГД';
    return {...meta, answerLetters, cards};
  });
}

module.exports = {loadCompletedMath};

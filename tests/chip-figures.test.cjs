const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sources = path.join(root, 'sources/chip');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const editions = json(path.join(root, 'sources/subject-editions.json'))
  .filter(edition => edition.subject === 'chip');

function webpSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 16383, bytes.readUInt16LE(28) & 16383];
  if (chunk === 'VP8L') {
    const dimensions = bytes.readUInt32LE(21);
    return [(dimensions & 16383) + 1, ((dimensions >>> 14) & 16383) + 1];
  }
  assert.equal(chunk, 'VP8X');
  return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
}

test('each ЧИП illustration opens a local vector or a more detailed version of its preview', () => {
  for (const { year, grade, count } of editions) {
    const folder = path.join(sources, String(year));
    const rows = json(path.join(folder, `${grade}.json`));
    const manifest = json(path.join(folder, 'figures.json')).figures;
    assert.equal(rows.length, count);
    const localPrefix = 'assets/chip/' + year + '/';
    for (const row of rows) {
      for (const figure of [row.figure, ...(row.figures || []), ...(row.optionFigures || [])].filter(Boolean)) {
        assert.ok(figure.src.startsWith(localPrefix), row.title);
        assert.ok(figure.detailSrc?.startsWith(localPrefix), row.title);
        const detail = path.join(root, 'dist', figure.detailSrc);
        assert.ok(fs.existsSync(detail), detail);
        if (figure.src === figure.detailSrc) {
          assert.ok(figure.src.endsWith('.svg'), row.title);
          continue;
        }
        const entry = manifest[path.parse(figure.src).name]?.detail;
        assert.equal(localPrefix + entry.file, figure.detailSrc);
        assert.ok(entry.source && entry.author && entry.license);
        const thumb = webpSize(path.join(root, 'dist', figure.src));
        if (detail.endsWith('.svg')) {
          assert.match(fs.readFileSync(detail, 'utf8'), /viewBox=/);
        } else {
          const full = webpSize(detail);
          assert.ok(Math.max(...full) > Math.max(...thumb), row.title);
          assert.ok(Math.abs(thumb[0] - full[0] / full[1] * thumb[1]) <= 3, row.title);
        }
      }
    }
  }
});

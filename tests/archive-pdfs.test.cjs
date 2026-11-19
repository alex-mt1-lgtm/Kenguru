'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {dist, loadLessonCatalog} = require('../scripts/lesson-catalog.cjs');

test('each archive and lesson PDF link points to a published PDF in this release', () => {
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const pdfLinks = html => [...html.matchAll(/href="([^"]+\.pdf(?:[?#][^"]*)?)"/gi)].map(match => match[1]);
  const files = new Set([...pdfLinks(archive), ...pdfLinks(home)]);
  const editions = new Map();
  for (const [card] of archive.matchAll(/<li\b[^>]*class="archive-card"[^>]*>[\s\S]*?<\/li>/g)) {
    const id = /#zadacha=([^/]+)\//.exec(card)?.[1];
    if (id) editions.set(id, pdfLinks(card));
  }
  for (const {id, sources} of loadLessonCatalog().catalog) {
    const cardLinks = editions.get(id);
    assert.ok(cardLinks, id);
    for (const link of [sources.tasksUrl, sources.answersUrl, sources.solutionUrl].filter(Boolean)) {
      assert.ok(cardLinks.includes(link), id + ' ' + link);
    }
  }
  for (const link of files) {
    assert.match(link, /^assets\/(?:[\w-]+\/)+[\w.-]+\.pdf$/);
    const file = path.join(dist, link);
    assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), '%PDF-', link);
  }
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {buildArchiveFormats} = require('../scripts/build-archive-formats.cjs');

const dist = path.join(__dirname, '..', 'dist');

test('archive format labels are current and every interactive archive card has one', () => {
  const script = fs.readFileSync(path.join(dist, 'years', 'archive-formats.js'), 'utf8');
  assert.equal(script, buildArchiveFormats());

  const context = vm.createContext({});
  vm.runInContext(script, context);
  const formats = context.KENGURU_ARCHIVE_FORMATS;
  const archive = fs.readFileSync(path.join(dist, 'archive.html'), 'utf8');
  const interactiveEditions = [...archive.matchAll(/href="\.\/#zadacha=([0-9-]+)\/\d+"/gu)].map(link => link[1]);
  assert.deepEqual([...new Set(interactiveEditions)].sort(), Object.keys(formats).sort());
  assert.equal(formats['2024-3-4'], 'walkthrough');
  assert.equal(formats['2000-5-6'], 'mixed');
  assert.equal(formats['2017-5-6'], 'key');
});

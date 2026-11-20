const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('release assets keep their URLs, contents, permissions and existing hard links', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-assets-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.mkdirSync(path.join(root, '.olympiads-deploy'));
  const releases = path.join(root, 'www/olympiads.pro/_releases');
  const file = (id, name = 'picture one.pdf') => path.join(releases, id.repeat(40), 'assets', name);
  const inode = (name) => fs.statSync(name).ino;
  const run = (...args) => execFileSync('bash', [path.join(__dirname, '../scripts/link-reg-ru-assets.sh'), ...args], { cwd: root, encoding: 'utf8' });
  for (const id of ['1', '2', '3', '4', '5', '6']) {
    fs.mkdirSync(path.dirname(file(id)), { recursive: true });
    fs.writeFileSync(file(id), id === '4' ? 'different' : 'identical');
  }
  fs.unlinkSync(file('2'));
  fs.linkSync(file('1'), file('2'));
  fs.chmodSync(file('5'), 0o400);
  fs.unlinkSync(file('6'));
  fs.symlinkSync(file('1'), file('6'));
  fs.writeFileSync(file('3', 'other.pdf'), 'identical');
  fs.writeFileSync(path.join(releases, '3'.repeat(40), 'app.js'), 'identical');

  const existing = inode(file('1'));
  const separate = inode(file('3'));
  assert.match(run(), /Files: 1\n/);
  assert.equal(inode(file('3')), separate);
  assert.match(run('--apply'), /Files: 1\n/);
  for (const id of ['1', '2', '3']) {
    assert.equal(inode(file(id)), existing);
    assert.equal(fs.readFileSync(file(id), 'utf8'), 'identical');
  }
  assert.notEqual(inode(file('4')), existing);
  assert.equal(fs.readFileSync(file('4'), 'utf8'), 'different');
  assert.notEqual(inode(file('5')), existing);
  assert.equal(fs.statSync(file('5')).mode & 0o777, 0o400);
  assert.equal(fs.lstatSync(file('6')).isSymbolicLink(), true);
  assert.notEqual(inode(file('3', 'other.pdf')), existing);
  assert.notEqual(inode(path.join(releases, '3'.repeat(40), 'app.js')), existing);
  assert.match(run('--apply'), /Files: 0\nSaved: 0\.00 MiB/);
});

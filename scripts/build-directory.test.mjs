import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDirectory } from './build-directory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'notebook-staged-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function snapshot(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Object.fromEntries(await Promise.all(entries.map(async entry => [
    entry.name,
    entry.isDirectory() ? await snapshot(path.join(directory, entry.name)) : await readFile(path.join(directory, entry.name))
  ])));
}
async function assertClean(directory) {
  assert.deepEqual((await readdir(directory)).filter(name => name.startsWith('.dist-build-')), []);
}

for (const failure of ['render', 'copy', 'write']) {
  test(`${failure} failure after partial output keeps the previous directory and cleans staging`, async t => {
    const directory = await fixture(t);
    const output = path.join(directory, 'dist');
    await mkdir(output);
    await writeFile(path.join(output, 'index.html'), 'previous successful build');
    const before = await snapshot(output);
    await assert.rejects(buildDirectory(output, async staged => {
      await writeFile(path.join(staged, 'index.html'), 'partial replacement');
      if (failure === 'render') throw new Error('fixture render failed');
      if (failure === 'copy') await cp(path.join(directory, 'missing-source'), path.join(staged, 'asset'));
      if (failure === 'write') await writeFile(path.join(staged, 'missing-parent', 'page.html'), 'page');
    }), failure === 'render' ? /fixture render failed/ : { code: 'ENOENT' });
    assert.deepEqual(await snapshot(output), before);
    await assertClean(directory);
  });
}

test('first build failure leaves no output or temporary directory', async t => {
  const directory = await fixture(t);
  await assert.rejects(buildDirectory(path.join(directory, 'dist'), async staged => {
    await writeFile(path.join(staged, 'partial'), 'partial');
    throw new Error('first build failed');
  }), /first build failed/);
  assert.deepEqual(await readdir(directory), []);
});

test('successful first build and replacement remove stale output and staging', async t => {
  const directory = await fixture(t);
  const output = path.join(directory, 'dist');
  await buildDirectory(output, async staged => {
    await mkdir(path.join(staged, 'old-note'));
    await writeFile(path.join(staged, 'old-note', 'index.html'), 'old');
    await writeFile(path.join(staged, 'style.old.css'), 'old');
  });
  await buildDirectory(output, async staged => {
    await writeFile(path.join(staged, 'index.html'), 'new');
  });
  assert.deepEqual(await snapshot(output), { 'index.html': Buffer.from('new') });
  assert.deepEqual(await readdir(directory), ['dist']);
});

test('real build retains all output after late feed rendering fails, then replaces stale files', async t => {
  const directory = await fixture(t);
  for (const name of ['scripts', 'public', 'content']) {
    await cp(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  const build = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: directory, stdio: 'pipe' });
  build();
  const output = path.join(directory, 'dist');
  await writeFile(path.join(output, 'stale.html'), 'old page');
  const before = await snapshot(output);
  const feedPath = path.join(directory, 'scripts/feed.mjs');
  const feed = await readFile(feedPath, 'utf8');
  // Alter only the disposable fixture: this executes after HTML pages are written.
  await writeFile(feedPath, feed.replace('export function renderFeed(posts) {', 'export function renderFeed(posts) { throw new Error("fixture late render failure");'));
  assert.throws(build, error => {
    assert.notEqual(error.status, 0);
    assert.match(error.stderr.toString(), /fixture late render failure/);
    return true;
  });
  assert.deepEqual(await snapshot(output), before);
  await assertClean(directory);
  await writeFile(feedPath, feed);
  await writeFile(path.join(directory, 'content/posts.json'), '[]');
  build();
  const after = await snapshot(output);
  assert.equal(after['stale.html'], undefined);
  assert.equal(after.notes, undefined);
  assert.match(after['index.html'].toString(), /第一篇手记正在路上/);
  await assertClean(directory);
});

test('promotion failure restores the previous output and cleans staging', async t => {
  const directory = await fixture(t);
  const output = path.join(directory, 'dist');
  await mkdir(output);
  await writeFile(path.join(output, 'index.html'), 'previous');
  const before = await snapshot(output);
  await assert.rejects(buildDirectory(output, async staged => {
    // A missing staged directory makes promotion fail after the old output moved.
    await rm(staged, { recursive: true });
  }), { code: 'ENOENT' });
  assert.deepEqual(await snapshot(output), before);
  assert.deepEqual(await readdir(directory), ['dist']);
});

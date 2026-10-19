import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePosts } from './validate-posts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const makePost = (overrides = {}) => ({
  slug: 'public-example', date: '2026-10-19', title: 'Title', subtitle: 'Subtitle',
  category: 'Category', summary: 'Summary', readingMinutes: 1,
  sections: [{ heading: 'Heading', paragraphs: ['Body'] }], closing: 'Closing',
  ...overrides
});

function rejectsUnknown(posts, location) {
  assert.throws(() => validatePosts(posts), {
    name: 'TypeError',
    message: `Invalid content at ${location}: unknown field; only reviewed public content fields are allowed`
  });
}

for (const key of ['draft', 'internalNotes', 'notes', 'titel', 'Heading', '__proto__', 'constructor', 'toString']) {
  test(`rejects unknown post and section field ${key}`, () => {
    // Computed keys also create an ordinary own property for __proto__.
    rejectsUnknown([makePost({ [key]: 'Unreviewed text' })], `posts[0].${key}`);
    rejectsUnknown([makePost({ sections: [{ heading: 'Heading', paragraphs: ['Body'], [key]: 'Unreviewed text' }] })], `posts[0].sections[0].${key}`);
  });
}

test('unknown fields are rejected regardless of their value', () => {
  for (const value of [undefined, null, false, 0, '', [], {}]) {
    rejectsUnknown([makePost({ draft: value })], 'posts[0].draft');
    rejectsUnknown([makePost({ sections: [{ heading: 'Heading', paragraphs: ['Body'], notes: value }] })], 'posts[0].sections[0].notes');
  }
});

test('unknown-field errors identify the exact post, section and unusual JSON key', () => {
  for (const key of ['', 'internal.notes', 'a[b]', 'private note', '备注', 'quote"\nline']) {
    rejectsUnknown([makePost(), makePost({ slug: 'second', [key]: 'Text' })], `posts[1][${JSON.stringify(key)}]`);
    rejectsUnknown([makePost(), makePost({ slug: 'second', sections: [
      { heading: 'First', paragraphs: ['Body'] },
      { heading: 'Second', paragraphs: ['Body'], [key]: 'Text' }
    ] })], `posts[1].sections[1][${JSON.stringify(key)}]`);
  }
});

test('rejection leaves frozen input and extra content intact rather than silently stripping it', () => {
  for (const posts of [
    [makePost({ internalNotes: 'Unreviewed text' })],
    [makePost({ sections: [{ heading: 'Heading', paragraphs: ['Body'], notes: 'Unreviewed text' }] })]
  ]) {
    const before = structuredClone(posts);
    for (const post of posts) {
      for (const section of post.sections) {
        Object.freeze(section.paragraphs);
        Object.freeze(section);
      }
      Object.freeze(post.sections);
      Object.freeze(post);
    }
    Object.freeze(posts);
    assert.throws(() => validatePosts(posts), /unknown field/);
    assert.deepEqual(posts, before);
  }
});

test('the field allowlist is a schema check, not a privacy detector', () => {
  const posts = [makePost({ summary: 'A draft about internal notes is still ordinary text.' })];
  assert.equal(validatePosts(posts), posts);
  const empty = [];
  assert.equal(validatePosts(empty), empty);
});

async function snapshot(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Object.fromEntries(await Promise.all(entries.map(async entry => [
    entry.name,
    entry.isDirectory() ? await snapshot(path.join(directory, entry.name)) : await readFile(path.join(directory, entry.name))
  ])));
}

test('build rejects extra JSON fields, preserves previous output and succeeds after their removal', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'notebook-content-fields-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const name of ['scripts', 'public', 'content']) {
    await cp(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  const input = path.join(directory, 'content/posts.json');
  const output = path.join(directory, 'dist');
  const build = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: directory, stdio: 'pipe' });
  await writeFile(input, JSON.stringify([makePost()]));
  build();
  const before = await snapshot(output);
  for (const [posts, location] of [
    [[makePost({ internalNotes: 'Unreviewed text' })], 'posts[0].internalNotes'],
    [[makePost({ sections: [{ heading: 'Heading', paragraphs: ['Body'], draft: 'Unreviewed text' }] })], 'posts[0].sections[0].draft'],
    [[makePost({ ['__proto__']: { notes: 'Unreviewed text' } })], 'posts[0].__proto__']
  ]) {
    await writeFile(input, JSON.stringify(posts));
    assert.throws(build, error => {
      assert.notEqual(error.status, 0);
      assert.ok(error.stderr.toString().includes(`Invalid content at ${location}: unknown field`));
      return true;
    });
    assert.deepEqual(await snapshot(output), before);
    assert.deepEqual((await readdir(directory)).filter(name => name.startsWith('.dist-build-')), []);
  }
  await writeFile(input, JSON.stringify([makePost({ title: 'Reviewed replacement' })]));
  build();
  assert.match(await readFile(path.join(output, 'notes/public-example/index.html'), 'utf8'), /Reviewed replacement/);
});

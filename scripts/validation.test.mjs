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
  slug: 'validation-example',
  date: '2026-10-15',
  title: '测试标题',
  subtitle: '测试副标题',
  category: '测试分类',
  summary: '测试摘要',
  readingMinutes: 2,
  sections: [{ heading: '测试章节', paragraphs: ['测试正文'] }],
  closing: '测试小结',
  ...overrides
});

function rejectsAt(input, location) {
  assert.throws(() => validatePosts(input), error => {
    assert.ok(error instanceof TypeError);
    assert.ok(error.message.startsWith(`Invalid content at ${location}: `), error.message);
    return true;
  });
}

test('validation accepts empty notebooks and leaves valid input unchanged', () => {
  const empty = [];
  assert.equal(validatePosts(empty), empty);
  const posts = [makePost({ slug: 'z-123' }), makePost({ slug: 'a', date: '2024-02-29' })];
  const original = structuredClone(posts);
  for (const post of posts) {
    for (const section of post.sections) {
      Object.freeze(section.paragraphs);
      Object.freeze(section);
    }
    Object.freeze(post.sections);
    Object.freeze(post);
  }
  Object.freeze(posts);
  assert.equal(validatePosts(posts), posts);
  assert.deepEqual(posts, original);
});

test('the top-level value must be an array', () => {
  for (const input of [undefined, null, {}, { length: 0 }, '', '[]', 0, true]) {
    rejectsAt(input, 'posts');
  }
});

test('posts must be objects, including sparse array positions', () => {
  for (const post of [undefined, null, [], '', 'post', 0, true]) {
    rejectsAt([post], 'posts[0]');
  }
  rejectsAt(new Array(1), 'posts[0]');
  rejectsAt([makePost(), null], 'posts[1]');
});

test('slugs must be strings with safe lowercase segments and no duplicates', () => {
  for (const slug of [undefined, null, 123, true, {}, [], '', ' ', 'Upper', '-start', 'end-', 'two--hyphens', 'under_score', '../outside', 'path/name', 'query?x', 'fragment#x', '中文', 'slug\n']) {
    rejectsAt([makePost({ slug })], 'posts[0].slug');
  }
  assert.throws(() => validatePosts([makePost(), makePost()]), /posts\[1\]\.slug: must be unique \(already used at posts\[0\]\.slug\)/);
  assert.doesNotThrow(() => validatePosts(['a', '0', '1-2', 'lowercase-123'].map(slug => makePost({ slug }))));
});

test('dates must be real calendar days in exact YYYY-MM-DD format', () => {
  for (const date of [undefined, null, 20261015, [], {}, '', '2026-2-03', '26-02-03', '2026/10/15', '2026-10-15T00:00:00Z', '2026-10-15\n', '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32', '2026-04-31', '2026-02-29', '1900-02-29', '2024-02-30']) {
    rejectsAt([makePost({ date })], 'posts[0].date');
  }
  for (const date of ['2000-02-29', '2024-02-29', '2026-02-28', '2026-12-31', '0099-01-01']) {
    assert.doesNotThrow(() => validatePosts([makePost({ date })]));
  }
});

test('every required article text field rejects missing, blank and non-string values', () => {
  for (const field of ['title', 'subtitle', 'category', 'summary', 'closing']) {
    for (const value of [undefined, null, 1, true, {}, [], '', ' \n\t\r', '\u3000\u00a0']) {
      rejectsAt([makePost({ [field]: value })], `posts[0].${field}`);
    }
  }
  const text = '  <em>Plain text</em> & 中文 😀  ';
  const post = makePost({ title: text });
  validatePosts([post]);
  assert.equal(post.title, text, 'Validation must not trim or rewrite accepted content');
});

test('reading time must be a positive safe integer', () => {
  for (const readingMinutes of [undefined, null, '', '2', true, [], {}, 0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    rejectsAt([makePost({ readingMinutes })], 'posts[0].readingMinutes');
  }
  for (const readingMinutes of [1, 2, Number.MAX_SAFE_INTEGER]) {
    assert.doesNotThrow(() => validatePosts([makePost({ readingMinutes })]));
  }
});

test('sections must be a non-empty array of objects', () => {
  for (const sections of [undefined, null, [], {}, '', 1, true]) {
    rejectsAt([makePost({ sections })], 'posts[0].sections');
  }
  for (const section of [undefined, null, [], '', 1, true]) {
    rejectsAt([makePost({ sections: [section] })], 'posts[0].sections[0]');
  }
  rejectsAt([makePost({ sections: new Array(1) })], 'posts[0].sections[0]');
});

test('each section has a non-blank heading and non-empty paragraph array', () => {
  for (const heading of [undefined, null, 1, true, {}, [], '', ' \n\t', '\u3000']) {
    rejectsAt([makePost({ sections: [{ heading, paragraphs: ['Body'] }] })], 'posts[0].sections[0].heading');
  }
  for (const paragraphs of [undefined, null, [], {}, '', 1, true]) {
    rejectsAt([makePost({ sections: [{ heading: 'Heading', paragraphs }] })], 'posts[0].sections[0].paragraphs');
  }
});

test('every paragraph must be non-blank text and errors locate nested failures', () => {
  for (const paragraph of [undefined, null, {}, [], 1, true, '', ' \n\t', '\u3000']) {
    rejectsAt([makePost({ sections: [{ heading: 'Heading', paragraphs: [paragraph] }] })], 'posts[0].sections[0].paragraphs[0]');
  }
  rejectsAt([makePost({ sections: [{ heading: 'Heading', paragraphs: new Array(1) }] })], 'posts[0].sections[0].paragraphs[0]');
  rejectsAt([makePost(), makePost({ slug: 'second', sections: [
    { heading: 'First', paragraphs: ['Valid'] },
    { heading: 'Second', paragraphs: ['Valid', '  '] }
  ] })], 'posts[1].sections[1].paragraphs[1]');
});

async function snapshot(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(result, await snapshot(absolute, relative));
    } else {
      result[relative] = await readFile(absolute);
    }
  }
  return result;
}

test('invalid content fails before replacing the last successful build', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-validation-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(path.join(root, dir), path.join(temp, dir), { recursive: true });
    }
    const inputPath = path.join(temp, 'content/posts.json');
    const outputPath = path.join(temp, 'dist');
    const build = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: temp, stdio: 'pipe' });
    await writeFile(inputPath, JSON.stringify([makePost()]));
    build();
    const previous = await snapshot(outputPath);
    const invalidInputs = [
      null,
      {},
      [null],
      [makePost({ slug: 123 })],
      [makePost({ slug: '../outside' })],
      [makePost(), makePost()],
      [makePost({ date: '2026-02-30' })],
      [makePost({ title: '  ' })],
      [makePost({ readingMinutes: 0 })],
      [makePost({ sections: [] })],
      [makePost({ sections: [null] })],
      [makePost({ sections: [{ heading: ' ', paragraphs: ['Body'] }] })],
      [makePost({ sections: [{ heading: 'Heading', paragraphs: [' '] }] })]
    ];
    for (const input of invalidInputs) {
      await writeFile(inputPath, JSON.stringify(input));
      assert.throws(build, error => {
        assert.notEqual(error.status, 0);
        assert.match(error.stderr.toString(), /Invalid content at posts/);
        return true;
      });
      assert.deepEqual(await snapshot(outputPath), previous);
    }
    await writeFile(inputPath, '{malformed JSON');
    assert.throws(build);
    assert.deepEqual(await snapshot(outputPath), previous);

    await writeFile(inputPath, '[]');
    build();
    const empty = await snapshot(outputPath);
    assert.match(empty['index.html'].toString(), /第一篇手记正在路上/);
    assert.doesNotMatch(empty['feed.xml'].toString(), /<item>/);
    assert.ok(!Object.keys(empty).some(file => file.startsWith(`notes${path.sep}`)));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

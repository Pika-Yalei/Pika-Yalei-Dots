import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { siteUrl } from './feed.mjs';
import { validateLinks } from './validate-links.mjs';

async function fixture(t, files) {
  const directory = await mkdtemp(path.join(tmpdir(), 'notebook-links-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const destination = path.join(directory, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return directory;
}

test('root, relative and same-origin links resolve files, directory indexes and target-page fragments', async t => {
  const directory = await fixture(t, {
    'index.html': `<h1 id="home">Home</h1>
      <a href="/notes/one/#section">Note</a>
      <a href="/notes/one?from=home#section">Directory without trailing slash</a>
      <a href="${siteUrl}/notes/one/index.html?from=home#section">Absolute URL</a>
      <a href="//${new URL(siteUrl).host}/notes/one/#section">Same origin</a>
      <link rel="canonical" href="${siteUrl}/">
      <link rel="stylesheet" href="/style.css?v=1&amp;mode=light">
      <a href="/feed.xml">Feed</a><img src="/icon.svg#view">`,
    'notes/one/index.html': `<h2 id="section">Section</h2>
      <a href="#section">Section</a><a href="?mode=read#section">Query</a>
      <a href="../../#home">Home</a><a href="./index.html#section">Explicit file</a>
      <a href="../two/#other">Sibling</a>
      <a href="">Self</a><a href="#">Top</a><a href="#ToP">Top keyword</a>`,
    'notes/two/index.html': '<h2 id="other">Other</h2>',
    'style.css': 'body { color: black; }',
    'feed.xml': '<rss/>',
    'icon.svg': '<svg/>'
  });
  await assert.doesNotReject(validateLinks(directory));
});

test('all broken paths and fragments report their source and reference', async t => {
  const directory = await fixture(t, {
    'index.html': `<h1 id="only-here">Home</h1>
      <a href="/missing/">Missing page</a><img src="/missing.svg">
      <a href="#gone">Missing local ID</a>
      <a href="/notes/one/#only-here">ID is on wrong page</a>
      <a href="${siteUrl}/missing-canonical/">Missing canonical page</a>
      <a href="${siteUrl}/notes/one/#missing">Missing canonical fragment</a>
      <a href="/empty/">Missing directory index</a>`,
    'notes/one/index.html': '<h2 id="real">Real</h2><a href="../gone/">Missing sibling</a>',
    'empty/note.txt': 'A directory without a page'
  });
  await assert.rejects(validateLinks(directory), error => {
    assert.equal(error.message.split('\n').length, 9, 'Every broken reference should be reported');
    for (const [reference, problem] of [
      ['/missing/', 'Missing local target /missing/'],
      ['/missing.svg', 'Missing local target /missing.svg'],
      ['#gone', 'Missing fragment #gone in /index.html'],
      ['/notes/one/#only-here', 'Missing fragment #only-here in /notes/one/index.html'],
      [`${siteUrl}/missing-canonical/`, 'Missing local target /missing-canonical/'],
      [`${siteUrl}/notes/one/#missing`, 'Missing fragment #missing in /notes/one/index.html'],
      ['/empty/', 'Missing local target /empty/']
    ]) {
      assert.ok(error.message.includes(`/index.html: ${reference.endsWith('.svg') ? 'src' : 'href'}=${JSON.stringify(reference)}: ${problem}`), error.message);
    }
    assert.ok(error.message.includes('/notes/one/index.html: href="../gone/": Missing local target /notes/gone/'));
    return true;
  });
});

test('fragment and path encoding is decoded once, with literal plus and case preserved', async t => {
  const directory = await fixture(t, {
    'index.html': `<a href="/encoded%20page/#%E7%AB%A0%E8%8A%82">Chinese</a>
      <a href="/encoded%20page/#a+b">Plus</a>
      <a href="/encoded%20page/#a%20b">Space</a>
      <a href="/encoded%20page/#%2520">Literal percent</a>
      <a href="/encoded%20page/#%F0%9F%9A%80">Emoji</a>`,
    'encoded page/index.html': '<h2 id="章节"></h2><h2 id="a+b"></h2><h2 id="a b"></h2><h2 id="%20"></h2><h2 id="&#x1F680;"></h2>'
  });
  await assert.doesNotReject(validateLinks(directory));
  await writeFile(path.join(directory, 'index.html'), '<a href="/encoded%20page/#A+b">Case-sensitive ID</a>');
  await assert.rejects(validateLinks(directory), /Missing fragment #A\+b/);
});

test('quoted, unquoted, uppercase and escaped attributes match real IDs', async t => {
  const directory = await fixture(t, {
    'index.html': `<h2 ID='a&amp;b'></h2><a HREF='#a&#38;b'>Ampersand</a>
      <h2 id="&quot;quote&apos;&lt;tag&gt;"></h2><a href='#%22quote%27%3Ctag%3E'>Quotes</a>
      <h2 id="literal&amp;lt;"></h2><a href="#literal%26lt%3B">Decode once</a>
      <h2 id=plain></h2><a href = #plain>Unquoted</a>
      <h2 id="greater>than"></h2><a title="a > b" href="#greater%3Ethan">Quoted angle</a>
      <a href="#plain" href="/ignored-duplicate/">First attribute wins</a>
      <a href="/a&amp;b/?x=1&amp;y=2#real">Escaped path</a>`,
    'a&b/index.html': '<h2 id="real">Real</h2>'
  });
  await assert.doesNotReject(validateLinks(directory));
});

test('comments, text, unrelated attributes and raw text cannot create references or IDs', async t => {
  const directory = await fixture(t, {
    'index.html': `<p>href="/not-a-link/" &lt;a href="/escaped/"&gt;</p>
      <!-- <a href="/comment/"><h2 id="comment-id"> -->
      <div data-href="/data/" data-id="data-id" title='href="/title/" id="title-id"'></div>
      <style>/* <a href="/style/"><h2 id="style-id"> */</style>
      <textarea><a href="/textarea/"><h2 id="textarea-id"></textarea>
      <title><a href="/title/"><h2 id="raw-title-id"></title>
      <script>const html = '<a href="/script/"><h2 id="script-id">';</script>`
  });
  await assert.doesNotReject(validateLinks(directory));
  const hiddenIds = ['comment-id', 'data-id', 'title-id', 'style-id', 'textarea-id', 'raw-title-id', 'script-id'];
  await writeFile(path.join(directory, 'other.html'), hiddenIds.map(id => `<a href="/#${id}">Invalid</a>`).join(''));
  await assert.rejects(validateLinks(directory), error => {
    for (const id of hiddenIds) assert.ok(error.message.includes(`Missing fragment #${id} in /index.html`));
    assert.equal(error.message.split('\n').length, hiddenIds.length + 1);
    return true;
  });
});

test('approved external navigation is skipped, but new destinations and external resources fail', async t => {
  const repository = 'https://github.com/Pika-Yalei/Pika-Yalei-Dots';
  const directory = await fixture(t, {
    'index.html': `<a href="${repository}">Repository</a>`
  });
  await assert.doesNotReject(validateLinks(directory));
  const invalid = [
    ['<a href="https://example.com/">Other</a>', 'External URL is not approved'],
    [`<a href="${siteUrl}.example.com/">Lookalike</a>`, 'External URL is not approved'],
    ['<a href="mailto:example">Email</a>', 'External URL is not approved'],
    ['<a href="javascript:void(0)">Script</a>', 'External URL is not approved'],
    [`<img src="${repository}">`, 'External resource loads are not allowed'],
    [`<link rel="stylesheet" href="${repository}">`, 'External resource loads are not allowed']
  ];
  for (const [html, message] of invalid) {
    await writeFile(path.join(directory, 'index.html'), html);
    await assert.rejects(validateLinks(directory), error => error.message.includes(message));
  }
});

test('malformed URLs and invalid percent encoding give actionable diagnostics', async t => {
  const directory = await fixture(t, {
    'index.html': '<a href="https://[broken/">URL</a><a href="/%zz/">Path</a><a href="#%E0%A4">Fragment</a>'
  });
  await assert.rejects(validateLinks(directory), error => {
    assert.ok(error.message.includes('/index.html: href="https://[broken/": Invalid URL'));
    assert.ok(error.message.includes('/index.html: href="/%zz/": Invalid percent encoding'));
    assert.ok(error.message.includes('/index.html: href="#%E0%A4": Invalid percent encoding'));
    return true;
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMetadata } from './metadata.mjs';
import { groupCategories } from './categories.mjs';

test('canonical and sharing metadata use the stable public URL', () => {
  const html = renderMetadata({title:'标题', description:'摘要', pagePath:'/notes/one/'});
  assert.match(html, /rel="canonical" href="https:\/\/pika-yalei-dots.yaleizhang.com\/notes\/one\/"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.match(renderMetadata({title:'首页', description:'说明', pagePath:'/'}), /property="og:type" content="website"/);
});
test('sharing titles and descriptions remain text, never attributes or markup', () => {
  const html = renderMetadata({title:'" <tag> &', description:"' <script>", pagePath:'/about/'});
  assert.match(html, /&quot; &lt;tag&gt; &amp;/);
  assert.match(html, /&#39; &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<tag>/);
});
test('error pages are noindex and invalid canonical paths are rejected', () => {
  assert.equal(renderMetadata({title:'404', description:'missing'}), '<meta name="robots" content="noindex">');
  for (const pagePath of ['//evil.test/', '/?tracking=1', '/about/#x', 'https://evil.test/', '/a/../']) {
    assert.throws(() => renderMetadata({title:'x', description:'x', pagePath}));
  }
});

test('built pages expose their own canonical address and 404 stays noindex', async () => {
  const { mkdtemp, cp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const temp = await mkdtemp(join(tmpdir(), 'notebook-metadata-'));
  try {
    for (const dir of ['scripts', 'public', 'content']) {
      await cp(new URL(`../${dir}`, import.meta.url), join(temp, dir), {recursive:true});
    }
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
    const posts = JSON.parse(await readFile(join(temp, 'content/posts.json'), 'utf8'));
    for (const pagePath of ['/', '/about/', '/archive/', '/categories/', ...groupCategories(posts).map(category => category.path), ...posts.map(post => `/notes/${post.slug}/`)]) {
      const html = await readFile(join(temp, 'dist', pagePath, 'index.html'), 'utf8');
      assert.ok(html.includes(`<link rel="canonical" href="https://pika-yalei-dots.yaleizhang.com${pagePath}">`));
      assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
      assert.doesNotMatch(html, /name="robots" content="noindex"/);
    }
    const missing = await readFile(join(temp, 'dist/404.html'), 'utf8');
    assert.match(missing, /name="robots" content="noindex"/);
    assert.doesNotMatch(missing, /rel="canonical"|property="og:url"/);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

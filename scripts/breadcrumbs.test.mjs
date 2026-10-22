import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBreadcrumbs } from './breadcrumbs.mjs';
import { categoryPath } from './categories.mjs';
import { validateLinks } from './validate-links.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const breadcrumb = html => html.match(/<nav class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/g) ?? [];

test('breadcrumbs use a named navigation, ordered list and one unlinked current page', () => {
  const html = renderBreadcrumbs([
    {label:'首页', href:'/'},
    {label:'分类', href:'/categories/'},
    {label:'当前页', href:'/ignored/'}
  ]);
  assert.match(html, /^<nav class="breadcrumbs" aria-label="当前位置"><ol role="list">/);
  assert.equal([...html.matchAll(/<li>/g)].length, 3);
  assert.equal([...html.matchAll(/<a /g)].length, 2);
  assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
  assert.equal([...html.matchAll(/aria-hidden="true">\//g)].length, 2);
  assert.match(html, /<span aria-current="page">当前页<\/span><\/li><\/ol><\/nav>$/);
  assert.doesNotMatch(html, /ignored/);
});

test('breadcrumb labels and link attributes are escaped; empty and single-item trails work', () => {
  assert.equal(renderBreadcrumbs([]), '');
  const html = renderBreadcrumbs([
    {label:'<img src=x> & "路径"', href:'/path/?a=1&b="x"'},
    {label:"<script>'正文'</script>"}
  ]);
  assert.match(html, /&lt;img src=x&gt; &amp; &quot;路径&quot;/);
  assert.match(html, /href="\/path\/\?a=1&amp;b=&quot;x&quot;"/);
  assert.match(html, /&lt;script&gt;&#39;正文&#39;&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img|<script/);
  const single = renderBreadcrumbs([{label:'分类'}]);
  assert.doesNotMatch(single, /<a |breadcrumb-separator/);
  assert.match(single, /aria-current="page">分类/);
});

test('built category and article trails follow the hierarchy and resolve even with hostile labels', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-breadcrumbs-'));
  try {
    for (const directory of ['scripts', 'public', 'content']) {
      await cp(path.join(root, directory), path.join(temp, directory), {recursive:true});
    }
    const post = {
      slug:'breadcrumb-example', date:'2026-10-18', title:'<标题> & "长文"'.repeat(30),
      subtitle:'公开示例', category:'../<分类> & "方法"', summary:'独立创作的示例。',
      readingMinutes:2, sections:[{heading:'方法', paragraphs:['先核对。']}], closing:'保持核对。'
    };
    const dist = path.join(temp, 'dist');
    const build = () => {
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp, stdio:'pipe'});
    };
    await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify([post]));
    build();
    const category = categoryPath(post.category);
    for (const [page, count, expectedLinks] of [
      ['categories/index.html', 2, ['/']],
      [category + 'index.html', 3, ['/', '/categories/']],
      ['notes/breadcrumb-example/index.html', 4, ['/', '/categories/', category]]
    ]) {
      const html = await readFile(path.join(dist, page), 'utf8');
      const trails = breadcrumb(html);
      assert.equal(trails.length, 1);
      const [trail] = trails;
      assert.equal([...trail.matchAll(/<li>/g)].length, count);
      assert.deepEqual([...trail.matchAll(/href="([^"]+)"/g)].map(match => match[1]), expectedLinks);
      assert.equal([...trail.matchAll(/aria-current="page"/g)].length, 1);
      assert.ok(html.indexOf(trail) < html.search(/<h1(?:\s|>)/));
      assert.doesNotMatch(trail, /<标题>|<分类>/);
      if (count > 2) assert.match(trail, /\.\.\/&lt;分类&gt; &amp; &quot;方法&quot;/);
      if (count === 4) assert.match(trail, /<span aria-current="page">(?:&lt;标题&gt; &amp; &quot;长文&quot;){30}<\/span>/);
    }
    for (const page of ['index.html', 'about/index.html', 'archive/index.html', '404.html']) {
      assert.deepEqual(breadcrumb(await readFile(path.join(dist, page), 'utf8')), []);
    }
    await validateLinks(dist);
    await writeFile(path.join(temp, 'content/posts.json'), '[]');
    build();
    assert.equal(breadcrumb(await readFile(path.join(dist, 'categories/index.html'), 'utf8')).length, 1);
    await validateLinks(dist);
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

test('breadcrumb styles wrap long labels, retain focus styles and hide in print', async () => {
  const css = await readFile(path.join(root, 'public/style.css'), 'utf8');
  assert.match(css, /\.breadcrumbs ol\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.breadcrumbs li\{[^}]*min-width:0;max-width:100%/);
  assert.match(css, /\.breadcrumbs a,\.breadcrumbs \[aria-current\]\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /a:focus-visible\{outline:2px/);
  assert.match(css, /@media print\{[\s\S]*?\.breadcrumbs[^}]*display:none/);
});

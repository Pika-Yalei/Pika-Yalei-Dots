// Dependency-free markup/CSS regressions. Run with node --test scripts/reading-layout.test.mjs.
// These checks do not replace browser checks of layout and keyboard focus.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'notebook-reading-layout-'));
after(() => rm(fixture, { recursive: true, force: true }));
for (const dir of ['scripts', 'public', 'content']) {
  await cp(path.join(root, dir), path.join(fixture, dir), { recursive: true });
}
const [base] = JSON.parse(await readFile(path.join(root, 'content/posts.json'), 'utf8'));
const longText = `URL-${'unbroken'.repeat(80)}-END`;
const post = {
  ...base, slug: 'long-reading-fixture', title: longText, subtitle: longText,
  summary: longText, category: longText, closing: longText,
  sections: [{ heading: longText, paragraphs: [longText, '中文和 English 混排。'] }],
};
await writeFile(path.join(fixture, 'content/posts.json'), JSON.stringify([post]));
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture });
const css = await readFile(path.join(fixture, 'public/style.css'), 'utf8');

test('skip link targets a focusable main on every kind of generated page', async () => {
  for (const file of ['index.html', 'archive/index.html', 'about/index.html', '404.html', `notes/${post.slug}/index.html`]) {
    const html = await readFile(path.join(fixture, 'dist', file), 'utf8');
    assert.match(html, /<body>\s*<a class="skip" href="#main">跳到正文<\/a>/);
    assert.equal([...html.matchAll(/<main\b/g)].length, 1);
    assert.match(html, /<main id="main" tabindex="-1">/);
    assert.doesNotMatch(html, /tabindex="[1-9]\d*"/);
  }
  assert.match(css, /\.skip:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
  assert.match(css, /#main:focus\s*\{[^}]*outline:\s*2px solid var\(--green\)/);
  assert.match(css, /#main\s*\{[^}]*scroll-margin-top:\s*24px/);
});

test('desktop and mobile entry columns can shrink and wrap long words', () => {
  assert.match(css, /\.entry\s*\{[^}]*grid-template-columns:\s*80px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.entry\s*\{[^}]*grid-template-columns:\s*36px minmax\(0,1fr\)/);
  assert.match(css, /\.article-shell,\.entry-content\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.entry-content\s*\{[^}]*min-width:\s*0/);
  assert.doesNotMatch(css, /(?:html|body|\.article-shell|\.entry-content)\s*\{[^}]*(?:overflow(?:-x)?:\s*(?:hidden|clip)|text-overflow:\s*ellipsis)/);
});

test('long text remains complete in home, archive and article markup', async () => {
  for (const file of ['index.html', 'archive/index.html', `notes/${post.slug}/index.html`]) {
    const html = await readFile(path.join(fixture, 'dist', file), 'utf8');
    assert.ok(html.includes(longText), `${file} must preserve the complete title`);
  }
  const article = await readFile(path.join(fixture, 'dist/notes', post.slug, 'index.html'), 'utf8');
  assert.ok(article.includes(`<p>${longText}</p>`));
  assert.ok(article.includes(`<div class="closing-note">${longText}</div>`));
  assert.doesNotMatch(article, /<script\b|style="/);
});

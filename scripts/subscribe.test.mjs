import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderSubscribe } from './subscribe.mjs';
import { siteUrl } from './feed.mjs';
import { validateLinks } from './validate-links.mjs';

async function htmlPages(directory) {
  const pages = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await htmlPages(filename));
    else if (entry.name.endsWith('.html')) pages.push(filename);
  }
  return pages;
}

test('subscription instructions explain both full-text feeds, setup, AI authorship and data boundaries', () => {
  const html = renderSubscribe();
  for (const feed of ['feed.xml', 'feed.json']) {
    assert.ok(html.includes(`<a href="${siteUrl}/${feed}">${siteUrl}/${feed}</a>`));
  }
  for (const text of ['HTML 全文', '纯文本全文', '复制', '粘贴完整地址', 'AI 助手韩立', '全文保留 AI 作者说明', '无需注册本站账号', '阅读器会按其自身规则处理', '不承诺即时更新', '托管平台']) {
    assert.ok(html.includes(text), `Missing explanation: ${text}`);
  }
  assert.equal([...html.matchAll(/<h1>/g)].length, 1);
  assert.match(html, /class="prose"/);
  assert.match(html, /<ol><li>/);
  assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b|\son\w+=/i);
});

test('build always publishes subscription help and retains both feed links in every footer', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-subscribe-'));
  try {
    for (const directory of ['scripts', 'public', 'content']) {
      await cp(new URL(`../${directory}`, import.meta.url), path.join(temp, directory), {recursive:true});
    }
    const posts = JSON.parse(await readFile(path.join(temp, 'content/posts.json'), 'utf8'));
    for (const input of [posts, []]) {
      await writeFile(path.join(temp, 'content/posts.json'), JSON.stringify(input));
      execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:temp});
      const output = path.join(temp, 'dist');
      const html = await readFile(path.join(output, 'subscribe/index.html'), 'utf8');
      assert.ok(html.includes(renderSubscribe()));
      assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}/subscribe/">`));
      const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
      assert.ok(sitemap.includes(`<loc>${siteUrl}/subscribe/</loc>`));
      for (const file of await htmlPages(output)) {
        const page = await readFile(file, 'utf8');
        const footer = page.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
        assert.ok(footer, `Missing footer in ${file}`);
        for (const href of ['/feed.xml', '/feed.json', '/subscribe/']) {
          assert.ok(footer.includes(`href="${href}"`), `Missing ${href} in ${file}`);
        }
        assert.doesNotMatch(page, /<script\b|<iframe\b|\son\w+=/i);
      }
      await validateLinks(output);
    }
  } finally {
    await rm(temp, {recursive:true, force:true});
  }
});

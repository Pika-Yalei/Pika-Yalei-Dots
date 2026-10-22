import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSources, renderSourceIndex } from './source-index.mjs';
const url='https://github.com/simonw/llm/pull/1771';
const post={slug:'example',date:'2026-10-21',title:'标题 <script>',sections:[{heading:'来源 & 证据',paragraphs:['正文'],sources:[{label:'公开 <来源>',url},{label:'重复',url}]}]};
test('source index deduplicates exact URLs and links back to stable section anchors',()=>{
  const entries=collectSources([post,{...post,slug:'second',date:'2026-10-20'}]);
  assert.equal(entries.length,1); assert.equal(entries[0].references.length,2);
  assert.match(entries[0].references[0].href,/^\/notes\/example\/#section-[a-f0-9]{16}$/);
  const html=renderSourceIndex([post]);
  assert.match(html,/公开 &lt;来源&gt;/); assert.match(html,/标题 &lt;script&gt;/);
  assert.match(html,/github.com/); assert.doesNotMatch(html,/<script>/);
});
test('source index is useful without citations and refuses unreviewed URLs',()=>{
  assert.match(renderSourceIndex([]),/尚无可列出的引用来源/);
  assert.throws(()=>collectSources([{...post,sections:[{heading:'H',sources:[{label:'bad',url:'https://unknown.example/'}]}]}]),/Unreviewed/);
});

import { paginateSources, sourcePagePath, sourcePageSize } from './source-index.mjs';
import { sourceUrls } from './article-content.mjs';
import { readFile, writeFile, cp, mkdtemp, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLinks } from './validate-links.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = count => [{...post, sections:[{heading:'Sources', paragraphs:['Public sources'], sources:[...sourceUrls].slice(0,count).map((url,index) => ({url,label:`Source ${index + 1}`}))}]}];

test('source page boundaries cover empty, single, exact and overflowing pages without padding', () => {
  for (const count of [0,1,sourcePageSize,sourcePageSize+1,sourcePageSize*2,sourcePageSize*2+1]) {
    const sources = collectSources(fixtures(count));
    assert.equal(sources.length,count);
    const pages = paginateSources(sources);
    assert.equal(pages.length,Math.max(1,Math.ceil(count/sourcePageSize)));
    assert.deepEqual(pages.flatMap(page => page.sources),sources);
    assert.equal(pages[0].path,'/sources/');
    assert.ok(pages.every(page => page.sources.length <= sourcePageSize));
    const html = renderSourceIndex(fixtures(count),pages.length);
    if (count) {
      const start = pages.at(-1).offset + 1;
      assert.ok(html.includes(`显示第 ${start}–${count} 个来源`));
      assert.ok(html.includes(`<ol start="${start}">`));
    } else assert.doesNotMatch(html,/<ol|class="pagination"/);
    if (pages.length === 1) assert.doesNotMatch(html,/class="pagination"/);
  }
});

test('pagination rejects malformed or nonexistent pages and preserves one canonical first page', () => {
  for (const number of [0,-1,1.5,NaN,Infinity,'1','2',null,{},Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(() => sourcePagePath(number),RangeError);
    assert.throws(() => renderSourceIndex([],number),RangeError);
  }
  assert.throws(() => renderSourceIndex([],2),/does not exist/);
  assert.equal(sourcePagePath(2),'/sources/page/2/');
});

test('duplicate URLs remain on one page with all distinct article references', () => {
  const [first] = fixtures(sourcePageSize+1);
  const second = {...first,slug:'older',date:'2026-10-20'};
  const sources = collectSources([second,first]);
  assert.equal(sources.length,sourcePageSize+1);
  assert.ok(sources.every(source => source.references.length === 2));
  assert.deepEqual(paginateSources(sources).flatMap(page => page.sources.map(source => source.url)),[...sourceUrls].slice(0,sourcePageSize+1));
  assert.deepEqual(collectSources([first,second]),sources);
});

test('numbered keyboard links, current page and previous/next links match source boundaries', () => {
  const posts = fixtures(sourcePageSize*2+1);
  for (const number of [1,2,3]) {
    const html = renderSourceIndex(posts,number);
    assert.equal([...html.matchAll(/aria-current="page"/g)].length,1);
    assert.ok(html.includes(`aria-label="第 ${number} 页，当前页"`));
    assert.equal(html.includes('rel="prev"'),number > 1);
    assert.equal(html.includes('rel="next"'),number < 3);
    for (const other of [1,2,3].filter(page => page !== number)) {
      assert.ok(html.includes(`<a href="${sourcePagePath(other)}" aria-label="第 ${other} 页">${other}</a>`));
    }
    assert.doesNotMatch(html,/sources\/page\/1\/|tabindex|<script|<form|onclick/);
  }
});

test('built source pages include each cited URL exactly once with canonical metadata and resolving links', async () => {
  const temp = await mkdtemp(path.join(tmpdir(),'notebook-source-pages-'));
  try {
    for (const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
    const posts = JSON.parse(await readFile(path.join(temp,'content/posts.json'),'utf8'));
    const sources = collectSources(posts);
    const found = [];
    const sitemap = await readFile(path.join(temp,'dist/sitemap.xml'),'utf8');
    for (const page of paginateSources(sources)) {
      const html = await readFile(path.join(temp,'dist',page.path,'index.html'),'utf8');
      found.push(...[...html.matchAll(/<a href="([^"]+)" rel="noreferrer">/g)].map(match => match[1].replaceAll('&amp;','&')));
      assert.ok(html.includes(`rel="canonical" href="https://pika-yalei-dots.yaleizhang.com${page.path}"`));
      assert.ok(sitemap.includes(`https://pika-yalei-dots.yaleizhang.com${page.path}</loc>`));
    }
    assert.deepEqual(found,sources.map(source => source.url));
    assert.equal(new Set(found).size,found.length);
    await assert.rejects(stat(path.join(temp,'dist/sources/page/1/index.html')), {code:'ENOENT'});
    await validateLinks(path.join(temp,'dist'));
    // Shrinking the corpus removes obsolete deep pages instead of leaving duplicates.
    await writeFile(path.join(temp,'content/posts.json'),'[]');
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
    assert.match(await readFile(path.join(temp,'dist/sources/index.html'),'utf8'),/共 0 个实际引用的公开链接/);
    await assert.rejects(stat(path.join(temp,'dist/sources/page')), {code:'ENOENT'});
    await validateLinks(path.join(temp,'dist'));
  } finally { await rm(temp,{recursive:true,force:true}); }
});

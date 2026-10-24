import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTopicFeed } from './topic-feed.mjs';
import { collectTopics } from './topics.mjs';
import { sourceUrls } from './article-content.mjs';
import { siteUrl } from './feed.mjs';

const source = [...sourceUrls][0];
const post = (overrides = {}) => ({
  slug:'example', date:'2026-10-23', title:'2026-10-23｜24 小时新闻简报',
  category:'新闻回顾', subtitle:'Unrelated subtitle', summary:'Unrelated summary', closing:'Unrelated closing',
  publishedAt:'2026-10-23T02:00:00Z', publicationKind:'original',
  sections:[{heading:'AI', paragraphs:['1. Public AI fact。影响：公开分析。'], sources:[{label:'1. 原始来源',url:source}]},
    {heading:'商业', paragraphs:['Secretly unrelated business body']}], ...overrides
});
const items = rss => [...rss.matchAll(/    <item>[\s\S]*?    <\/item>/g)].map(match => match[0]);

test('topic RSS contains only the selected sourced section and its canonical anchor', () => {
  const input = post();
  const rss = renderTopicFeed([input], 'ai');
  const entry = collectTopics([input])[0].entries[0];
  assert.equal(items(rss).length, 1);
  assert.ok(rss.includes(`<link>${siteUrl}${entry.href}</link>`));
  assert.ok(rss.includes(`<guid isPermaLink="true">${siteUrl}${entry.href}</guid>`));
  assert.match(rss, /Public AI fact/);
  assert.match(rss, /原始来源/);
  assert.ok(rss.includes(source.replaceAll('&','&amp;amp;')));
  assert.doesNotMatch(rss, /Unrelated|unrelated business|news-permalink|href=&quot;#/);
  assert.match(rss, /AI 撰写 · 基于公开来源/);
  assert.match(rss, /\/topics\/ai\/feed.xml/);
});

test('topic RSS orders actual publication timestamps, not review dates, without mutation', () => {
  const input = [post({slug:'z'}),post({slug:'older-review-later-publication',date:'2026-10-01',publishedAt:'2026-10-24T01:00:00Z',publicationKind:'backfill'}),post({slug:'a'})];
  const before = structuredClone(input);
  const rss = renderTopicFeed(input, 'ai');
  const results = items(rss);
  assert.match(results[0], /older-review-later-publication/);
  assert.match(results[0], /Sat, 24 Oct 2026 01:00:00 GMT/);
  assert.match(results[0], /补发时间/);
  assert.match(results[1], /\/notes\/a\//);
  assert.match(results[2], /\/notes\/z\//);
  assert.equal(renderTopicFeed([...input].reverse(), 'ai'), rss);
  assert.deepEqual(input, before);
});

test('all five topic IDs support empty feeds and exact historical heading aliases', () => {
  const labels = [['ai','AI'],['business','商业'],['markets','股票'],['china-policy','中国政治'],['world','国际政治']];
  for (const [id, heading] of labels) {
    assert.equal(items(renderTopicFeed([], id)).length, 0);
    const input = post({sections:[{heading:`${heading}｜历史栏目`, paragraphs:['1. 历史事实。']} ]});
    assert.equal(items(renderTopicFeed([input], id)).length, 1);
    assert.equal(items(renderTopicFeed([{...input, category:'方法'}], id)).length, 0);
    assert.equal(items(renderTopicFeed([post({sections:[{heading:`关于${heading}`,paragraphs:['其他内容']} ]})], id)).length, 0);
  }
  assert.throws(() => renderTopicFeed([], '../ai'), /Unknown news topic/);
});

test('XML and embedded HTML are independently escaped without CDATA escape hatches', () => {
  const input = post({sections:[{heading:'AI｜<img> & "title"',paragraphs:['1. <script> & ]]>\u0000\ud800 中文😀'],sources:[{label:'1. <label> & "source"',url:source}]}]});
  const rss = renderTopicFeed([input], 'ai');
  assert.match(rss, /AI｜&lt;img&gt; &amp; &quot;title&quot;/);
  assert.match(rss, /&amp;lt;script&amp;gt; &amp;amp; \]\]&amp;gt;�� 中文😀/u);
  assert.doesNotMatch(rss, /<img>|<script>|<!\[CDATA\[|\u0000|\ud800|\]\]>/u);
});

test('legacy posts use existing fallback publication time and duplicate section anchors remain distinct', () => {
  const input = post({publishedAt:undefined,sections:[{heading:'AI',paragraphs:['first']},{heading:'AI',paragraphs:['second']} ]});
  const rss = renderTopicFeed([input], 'ai');
  const results = items(rss);
  assert.equal(results.length,2);
  assert.match(results[0], /Fri, 23 Oct 2026 00:00:00 GMT/);
  const guids = [...rss.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/g)].map(match=>match[1]);
  assert.equal(new Set(guids).size,2);
  assert.match(results[0],/first/);
  assert.match(results[1],/second/);
});

test('build publishes five discoverable topic feeds including an empty archive', async () => {
  const {cp, mkdtemp, readFile, writeFile, rm} = await import('node:fs/promises');
  const {execFileSync} = await import('node:child_process');
  const {tmpdir} = await import('node:os');
  const path = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temp = await mkdtemp(path.join(tmpdir(), 'topic-rss-'));
  try {
    for (const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const input = JSON.parse(await readFile(path.join(temp,'content/posts.json'),'utf8'));
    for (const posts of [input, []]) {
      await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(posts));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
      for (const id of ['ai','business','markets','china-policy','world']) {
        const rss = await readFile(path.join(temp,'dist/topics',id,'feed.xml'),'utf8');
        assert.equal(rss, renderTopicFeed(posts,id));
        const html = await readFile(path.join(temp,'dist/topics',id,'index.html'),'utf8');
        assert.match(html,new RegExp(`rel="alternate"[^>]+href="/topics/${id}/feed.xml"`));
        assert.match(html,new RegExp(`<a href="/topics/${id}/feed.xml">订阅`));
      }
      assert.match(await readFile(path.join(temp,'dist/_headers'),'utf8'),/\/topics\/\*\/feed.xml\n  Content-Type: application\/rss\+xml; charset=utf-8/);
    }
  } finally {await rm(temp,{recursive:true,force:true});}
});

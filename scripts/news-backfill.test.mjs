import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupCategories } from './categories.mjs';
import { siteUrl } from './feed.mjs';
import { validateLinks } from './validate-links.mjs';
import { validatePosts } from './validate-posts.mjs';
const root=fileURLToPath(new URL('../', import.meta.url));
const posts=JSON.parse(await readFile(path.join(root,'content/posts.json'),'utf8'));
const retired=['leave-a-place-for-evidence','leave-a-note-for-the-next-step','make-room-for-the-task','leave-space-in-a-checklist','labels-that-help-tomorrow','make-empty-spaces-useful','the-texture-of-repair'];

test('journal titles show the full date first and body sections follow their fixed format', () => {
  for (const post of posts) {
    if (post.category==='新闻回顾' && post.date<='2026-10-20') {
      assert.equal(post.title,`${post.date}｜24 小时新闻简报`);
      assert.equal(post.sections[0].heading,'回顾范围与补发说明');
      assert.deepEqual(post.sections.slice(1).map(section=>section.heading.split('｜')[0]),['AI','商业','股票','中国政治','国际政治']);
      for (const section of post.sections.slice(1)) assert.match(section.heading,/^[^｜]+｜.+$/);
    } else if (post.category==='困难复盘') {
      assert.equal(post.title,`${post.date}｜工作困难复盘`);
      assert.match(post.sections[0].heading,/^记录范围与/);
      assert.deepEqual(post.sections.slice(1).map(section=>section.heading),['问题','处理','结果与限制','教训']);
    }
  }
  const multiProjectReview=posts.find(post=>post.slug==='work-2026-10-19');
  for (const heading of ['处理','结果与限制']) {
    const section=multiProjectReview.sections.find(section=>section.heading===heading);
    assert.match(section.paragraphs[0],/^LLM：/);
    assert.match(section.paragraphs[1],/^Druid：/);
  }
});

test('seven daily retrospectives replace all previous journal posts with dated sources', () => {
  validatePosts(posts);
  const news=posts.filter(post=>post.category==='新闻回顾' && post.date>='2026-10-14' && post.date<='2026-10-20');
  assert.equal(news.length,7);
  assert.deepEqual(news.map(post=>post.date).sort(),Array.from({length:7},(_,i)=>`2026-10-${14+i}`));
  assert.ok(posts.length>=9);
  assert.deepEqual(posts.filter(post=>post.category==='困难复盘' && post.date<='2026-10-20').map(post=>post.date).sort(),['2026-10-19','2026-10-20']);
  for (const post of posts) {
    assert.ok(!retired.includes(post.slug));
    if (post.date<='2026-10-20') assert.ok(post.publishedAt?.startsWith('2026-10-20T'));
    assert.ok(post.sections.flatMap(section=>section.paragraphs).join('').length>=500);
    assert.ok(post.sections.some(section=>section.sources?.length));
  }
  for (const post of news) {
    const headings=post.sections.map(section=>section.heading).join(' ');
    for(const category of ['AI','商业','股票','中国政治','国际政治']) assert.ok(headings.includes(category),`${post.slug}: ${category}`);
    const intro=post.sections[0].paragraphs.join('');
    assert.match(intro,/北京时间/); assert.match(intro,/12:00/);
    assert.match(intro,/24\s*小时/);
  }
});

test('complete rebuild removes old paths and publishes citations, dates and replacement feeds', async () => {
  const temp=await mkdtemp(path.join(tmpdir(),'notebook-news-backfill-'));
  try {
    for(const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const dist=path.join(temp,'dist');
    for(const slug of retired) {await mkdir(path.join(dist,'notes',slug),{recursive:true});await writeFile(path.join(dist,'notes',slug,'index.html'),'retired');}
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
    await validateLinks(dist);
    const read=file=>readFile(path.join(dist,file),'utf8');
    for(const slug of retired) await assert.rejects(read(`notes/${slug}/index.html`),{code:'ENOENT'});
    const visibleFiles=['index.html','page/2/index.html','archive/index.html','categories/index.html','feed.xml','feed.json','sitemap.xml',...groupCategories(posts).flatMap(c=>[`${c.path.slice(1)}index.html`,`${c.path.slice(1)}feed.xml`])];
    for(const file of visibleFiles){const output=await read(file);for(const slug of retired)assert.ok(!output.includes(slug),`${file}: ${slug}`);}
    const json=JSON.parse(await read('feed.json'));
    for(const post of posts){
      const html=await read(`notes/${post.slug}/index.html`);
      assert.ok(html.includes(`<h1 itemprop="headline">${post.title}</h1>`));
      if (post.publicationKind !== 'original') assert.ok(html.includes('这是事后整理，不是当日即时刊发。'));
      assert.ok(html.includes(`回顾日期：${post.date}`));
      const item=json.items.find(item=>item.id===`${siteUrl}/notes/${post.slug}/`);
      assert.equal(item.title,post.title);
      assert.equal(item.date_published,post.publishedAt);
      assert.ok((await read('feed.xml')).includes(`<title>${post.title}</title>`));
      for(const source of post.sections.flatMap(section=>section.sources??[])) {
        assert.ok(html.includes(`href="${source.url.replaceAll('&','&amp;')}" rel="noreferrer"`));
      }
    }
    assert.equal((await readdir(path.join(dist,'notes'))).length,posts.length);
  }finally{await rm(temp,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monthArchivePath, paginateMonthArchive, renderMonthArchive } from './month-archive.mjs';
import { renderArchive } from './archive.mjs';
import { validateLinks } from './validate-links.mjs';

const post=(i,date='2026-10-01')=>({slug:`post-${String(i).padStart(3,'0')}`,date,title:`Title ${i}`});
test('month pages partition all articles without mutation at empty and six-post boundaries',()=>{
  for(const count of [0,1,5,6,7,12,13]) {
    const input=Array.from({length:count},(_,i)=>post(i)).reverse();
    const before=structuredClone(input), pages=paginateMonthArchive(input);
    assert.equal(pages.length,Math.ceil(count/6));
    assert.deepEqual(input,before);
    assert.deepEqual(pages.flatMap(p=>p.posts),[...input].reverse());
    assert.deepEqual(paginateMonthArchive([...input].reverse()),pages);
    for(const [i,page] of pages.entries()) {
      assert.equal(page.count,count);
      assert.equal(page.number,i+1);
      assert.equal(page.offset,i*6);
      assert.equal(page.path,monthArchivePath('2026-10',i+1));
      assert.ok(page.posts.length<=6);
      const html=renderMonthArchive(page);
      assert.ok(html.includes(`共 ${count} 篇手记`));
      assert.ok(html.includes(`显示第 ${i*6+1}–${i*6+page.posts.length} 篇`));
      assert.equal(html.includes('rel="prev"'),i>0);
      assert.equal(html.includes('rel="next"'),i+1<pages.length);
      if(i>0) assert.ok(html.includes(`href="${monthArchivePath('2026-10',i)}" rel="prev"`));
      if(i+1<pages.length) assert.ok(html.includes(`href="${monthArchivePath('2026-10',i+2)}" rel="next"`));
      assert.match(html,/href="\/archive\/#month-2026-10"/);
    }
  }
});
test('month grouping respects cross-year order, stable article ties, and existing archive anchors',()=>{
  const input=[post(2,'2025-12-31'),post(3,'2026-02-01'),post(1,'2026-02-01'),post(4,'2026-01-31')];
  const pages=paginateMonthArchive(input);
  assert.deepEqual(pages.map(p=>p.month),['2026-02','2026-01','2025-12']);
  assert.deepEqual(pages.flatMap(p=>p.posts.map(p=>p.slug)),['post-001','post-003','post-004','post-002']);
  const html=renderArchive(input);
  for(const page of pages) {
    assert.ok(html.includes(`href="${page.path}"`));
    assert.ok(html.includes(`id="month-${page.month}"`));
    assert.ok(html.includes(`href="#month-${page.month}"`));
  }
  assert.equal([...html.matchAll(/href="\/notes\//g)].length,input.length);
});
test('month paths reject unsafe components and article labels and attributes are escaped',()=>{
  assert.equal(monthArchivePath('2026-01'),'/archive/2026-01/');
  for(const month of ['2026-00','2026-13','2026-1','../2026-01','2026-01?x',null]) assert.throws(()=>monthArchivePath(month),RangeError);
  for(const number of [0,-1,1.1,NaN,Infinity,'2']) assert.throws(()=>monthArchivePath('2026-01',number),RangeError);
  const [page]=paginateMonthArchive([{slug:'a"&b',date:'2026-10-01',title:'<img src=x> & "quoted" \'text\''}]);
  const html=renderMonthArchive(page);
  assert.match(html,/&lt;img src=x&gt; &amp; &quot;quoted&quot; &#39;text&#39;/);
  assert.match(html,/href="\/notes\/a&quot;&amp;b\/"/);
  assert.doesNotMatch(html,/<img|<script/);
});
test('build publishes only occupied months, all pagination and canonical paths, and preserves the full archive',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const temp=await mkdtemp(path.join(tmpdir(),'month-archive-'));
  try {
    for(const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const [base]=JSON.parse(await readFile(path.join(root,'content/posts.json'),'utf8'));
    const fixture=[...Array.from({length:13},(_,i)=>({...base,...post(i)})),{...base,...post(20,'2025-12-31')},{...base,...post(21,'2026-02-01')}];
    for(const input of [fixture,[]]) {
      await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(input));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
      const xml=await readFile(path.join(temp,'dist/sitemap.xml'),'utf8');
      const paths=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
      const pages=paginateMonthArchive(input);
      const archive=await readFile(path.join(temp,'dist/archive/index.html'),'utf8');
      assert.ok(archive.includes(renderArchive(input)));
      assert.equal(paths.filter(p=>/^\/archive\/\d/.test(p)).length,pages.length);
      for(const page of pages) {
        assert.equal(paths.filter(p=>p===page.path).length,1);
        const file=path.join(temp,'dist',page.path,'index.html');
        assert.ok((await stat(file)).isFile());
        const html=await readFile(file,'utf8');
        assert.ok(html.includes(renderMonthArchive(page)));
        assert.match(html,new RegExp('rel="canonical" href="[^"]+'+page.path+'"'));
        assert.doesNotMatch(html,/href="\/archive\/" aria-current="page"/);
      }
      assert.ok(!paths.includes('/archive/2026-10/page/1/'));
      assert.ok(!paths.includes('/archive/2026-09/'));
      await validateLinks(path.join(temp,'dist'));
    }
  } finally {await rm(temp,{recursive:true,force:true});}
});

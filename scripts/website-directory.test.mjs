import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { websitePath, paginateWebsiteDirectory, websiteDirectoryPath, renderWebsiteDirectory } from './source-websites.mjs';

test('directory pagination preserves each website once, stable ordering, counts and boundaries', () => {
  for (const count of [0, 1, 29, 30, 31, 60, 61]) {
    const input = Array.from({length:count}, (_,i) => ({
      host:`site-${String(i).padStart(3,'0')}.example.com`, number:1, count:31,
      path:websitePath(`site-${String(i).padStart(3,'0')}.example.com`)
    })).reverse();
    const expanded = input.flatMap(site => [site, {...site,number:2,path:site.path+'page/2/'}]);
    const before = structuredClone(expanded);
    const pages = paginateWebsiteDirectory(expanded);
    assert.deepEqual(expanded,before);
    assert.equal(pages.length,Math.max(1,Math.ceil(count/30)));
    assert.deepEqual(pages.flatMap(p=>p.websites),[...input].reverse());
    for (const [i,page] of pages.entries()) {
      assert.equal(page.count,count);
      assert.equal(page.offset,i*30);
      assert.equal(page.number,i+1);
      assert.equal(page.path,websiteDirectoryPath(i+1));
      const html=renderWebsiteDirectory(page);
      assert.equal([...html.matchAll(/class="category-count"/g)].length,page.websites.length);
      assert.equal(html.includes('rel="prev"'),i>0);
      assert.equal(html.includes('rel="next"'),i+1<pages.length);
      if(i>0) assert.ok(html.includes(`href="${websiteDirectoryPath(i)}" rel="prev"`));
      if(i+1<pages.length) assert.ok(html.includes(`href="${websiteDirectoryPath(i+2)}" rel="next"`));
      assert.ok(html.includes(`共 ${count} 个网站 · 显示第 ${count ? i*30+1 : 0}–${i*30+page.websites.length} 个`));
      if(!count) assert.match(html,/尚无引用来源/);
    }
    assert.deepEqual(paginateWebsiteDirectory([...expanded].reverse()),pages);
  }
  assert.equal(websiteDirectoryPath(1),'/sources/websites/');
  for(const invalid of [0,-1,1.5,NaN,Infinity,'2',Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>websiteDirectoryPath(invalid),RangeError);
  }
});

test('directory escapes host labels and link attributes', () => {
  const [page]=paginateWebsiteDirectory([{number:1,host:'<b> & "quoted" \'text\'',path:'/safe/?a=1&b="bad"',count:1}]);
  const html=renderWebsiteDirectory(page);
  assert.match(html,/&lt;b&gt; &amp; &quot;quoted&quot; &#39;text&#39;/);
  assert.match(html,/href="\/safe\/\?a=1&amp;b=&quot;bad&quot;"/);
  assert.doesNotMatch(html,/<b>|<script/);
});

test('build and sitemap publish all directory pages with canonical URLs and preserve per-site pages', async () => {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const temp=await mkdtemp(path.join(tmpdir(),'website-directory-'));
  try {
    for(const dir of ['scripts','public','content']) await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    const [base]=JSON.parse(await readFile(path.join(root,'content/posts.json'),'utf8'));
    const sources=Array.from({length:61},(_,i)=>({label:`Public source ${i}`,url:`https://site-${String(i).padStart(3,'0')}.example.com/article`}));
    // One host also has a second material page; directory counts hosts, not pages.
    sources.push(...Array.from({length:30},(_,i)=>({label:`Extra ${i}`,url:`https://site-000.example.com/extra-${i}`})));
    // Only the isolated test build receives the synthetic reviewed URLs.
    await writeFile(path.join(temp,'scripts/source-links.json'),JSON.stringify(sources.map(source=>source.url)));
    const {websitePages:fixtureWebsitePages}=await import(pathToFileURL(path.join(temp,'scripts/source-websites.mjs')));
    const {validateLinks}=await import(pathToFileURL(path.join(temp,'scripts/validate-links.mjs')));
    const fixture={...base,category:'测试',sections:[{heading:'Public references',paragraphs:['Synthetic public test content.'],sources}]};
    for(const posts of [[fixture],[]]) {
      await writeFile(path.join(temp,'content/posts.json'),JSON.stringify(posts));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp});
      const xml=await readFile(path.join(temp,'dist/sitemap.xml'),'utf8');
      const locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
      const websites=fixtureWebsitePages(posts);
      const pages=paginateWebsiteDirectory(websites);
      for(const page of [...pages,...websites]) {
        assert.equal(locations.filter(p=>p===page.path).length,1);
        assert.ok((await stat(path.join(temp,'dist',page.path,'index.html'))).isFile());
      }
      for(const page of pages) {
        const html=await readFile(path.join(temp,'dist',page.path,'index.html'),'utf8');
        assert.match(html,new RegExp('rel="canonical" href="[^"]+'+page.path+'"'));
        assert.ok(html.includes(renderWebsiteDirectory(page)));
      }
      assert.equal(locations.filter(p=>/^\/sources\/websites\/(?:page\/\d+\/)?$/.test(p)).length,pages.length);
      assert.ok(!locations.includes('/sources/websites/page/1/'));
      await validateLinks(path.join(temp,'dist'));
    }
  } finally { await rm(temp,{recursive:true,force:true}); }
});

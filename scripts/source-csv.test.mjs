import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { csvCell,renderSourceCsv } from './source-csv.mjs';
import { collectSources } from './source-index.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url),'utf8'));
test('CSV quotes commas, quotes and multiline values and neutralizes formulas',()=>{
 assert.equal(csvCell('a,"b"\nnext'),'"a,""b""\nnext"');
 for(const value of ['=1+1','+SUM(A1)','-1','@cmd',' \t=1','\r\n+2','\uFEFF=3'])assert.equal(csvCell(value),`"'${value}"`);
 assert.equal(csvCell('https://example.org/?x=-1'),'"https://example.org/?x=-1"');
 assert.equal(csvCell('普通标题'),'"普通标题"');
});
test('source catalogue preserves all unique citation pairs and canonical return links',()=>{
 const before=structuredClone(posts),sources=collectSources(posts),csv=renderSourceCsv(posts);
 assert.ok(csv.startsWith('\uFEFF"source_label"'));assert.ok(csv.endsWith('\r\n'));
 const pairs=sources.flatMap(s=>s.references.map(r=>[s.url,r.href]));
 assert.equal(csv.split('\r\n').length,pairs.length+2);
 for(const [url,href] of pairs){assert.ok(csv.includes(csvCell(url)));assert.ok(csv.includes(href));}
 assert.deepEqual(posts,before);assert.equal(csv,renderSourceCsv([...posts].reverse()));
 assert.equal(readFileSync(new URL('../dist/sources/catalogue.csv',import.meta.url),'utf8'),csv);
 assert.equal(renderSourceCsv([]).split('\r\n').length,2);
});
test('generated source index exposes download and explicit CSV response headers',()=>{
 const html=readFileSync(new URL('../dist/sources/index.html',import.meta.url),'utf8');
 assert.match(html,/href="\/sources\/catalogue.csv" download="pika-dots-sources.csv"/);
 assert.match(readFileSync(new URL('../dist/_headers',import.meta.url),'utf8'),/\/sources\/catalogue.csv\n  Content-Type: text\/csv; charset=utf-8/);
});

test('CSV appends exact item title and mapping scope after the unchanged six columns',()=>{
 const headers=['source_label','source_url','source_website','article_title','section','article_url','news_item_title','mapping_scope'];
 assert.equal(renderSourceCsv([]),'\uFEFF'+headers.map(csvCell).join(',')+'\r\n');
 const url='https://github.com/simonw/llm/pull/1771';
 const fixture={slug:'csv-context',date:'2026-10-30',title:'文章',category:'新闻回顾',sections:[{heading:'AI',paragraphs:['1. =SUM(A1), "标题"。事实。','延续。','2. 第二标题。'],sources:[{url,label:'1. 引用'},{url,label:'2. 引用'},{url,label:'补充来源'}]}]};
 const csv=renderSourceCsv([fixture]),refs=collectSources([fixture])[0].references;
 assert.equal(refs.length,3);
 assert.ok(csv.includes(',"\'=SUM(A1), ""标题""","news-item"\r\n'));
 assert.ok(csv.includes(',"第二标题","news-item"\r\n'));
 assert.ok(csv.includes(',"","section"\r\n'));
 for(const ref of refs) assert.ok(csv.includes([ref.title,ref.heading,'https://pika-yalei-dots.yaleizhang.com'+ref.href,ref.itemTitle,ref.scope].map(csvCell).join(',')));
});

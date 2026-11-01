import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectSearchEntries,renderSearch} from './search.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
const decode=text=>text.replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[name]));
const payload=items=>renderSearch(items).match(/<template id="search-data">([\s\S]*?)<\/template>/)[1];
test('embedded search JSON protects versioned at-sign URLs without changing records',()=>{
 const raw=payload(posts);assert.equal(raw.includes('@'),false);assert.ok(raw.includes('\\u0040'));
 const records=JSON.parse(decode(raw));assert.deepEqual(records,collectSearchEntries(posts));
 const url='https://github.com/MoonshotAI/kimi-code/releases/tag/@moonshot-ai/kimi-code@2.3.2';
 assert.ok(records.some(record=>record.href===url));
 assert.equal(/<a\b|email-protection|__cf_email__/.test(raw),false);
});
test('at-sign escaping retains Unicode and HTML-sensitive text without adding markup',()=>{
 const sample=[{...posts[0],title:'Mail user@example.test <tag> & "中文"',summary:'Literal \\u0040 and @ remain distinct',sections:[]}];
 const raw=payload(sample);assert.deepEqual(JSON.parse(decode(raw)),collectSearchEntries(sample));
 assert.equal(raw.includes('<tag>'),false);assert.equal(raw.includes('@'),false);
});

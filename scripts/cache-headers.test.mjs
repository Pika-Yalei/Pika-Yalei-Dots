import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderCacheHeaders } from './cache-headers.mjs';
const base = '/*\n  Referrer-Policy: no-referrer\n';
const name = 'style.0123456789abcdef.css';
test('only an exact fingerprinted asset receives immutable caching',()=>{
 const headers=renderCacheHeaders(base,name);
 assert.ok(headers.startsWith(base.trimEnd()));
 assert.equal((headers.match(/immutable/g)||[]).length,1);
 assert.ok(headers.endsWith(`/${name}\n  Cache-Control: public, max-age=31536000, immutable\n`));
 assert.doesNotMatch(headers,/\/style\.\*/);
 for(const bad of ['style.css','style.bad.css','../style.0123456789abcdef.css','style.0123456789abcdef.css\n/*']) assert.throws(()=>renderCacheHeaders(base,bad),/fingerprinted/);
});
test('canonical article, directory and feed URLs revalidate without disabling storage',()=>{
 const headers=renderCacheHeaders(base,name);
 for(const route of ['/','/notes/*','/sources/*','/topics/*','/headlines/*','/feed.xml','/feed.json','/style.css']) assert.ok(headers.includes(`${route}\n  Cache-Control: public, max-age=0, must-revalidate`));
 assert.doesNotMatch(headers,/no-store/);
 assert.ok(headers.split('\n').filter(line=>line.startsWith('/')).length<100);
});
test('built caching matches actual CSS bytes and preserves every original security and MIME directive',()=>{
 const css=readFileSync(new URL('../public/style.css',import.meta.url));
 const expected=`style.${createHash('sha256').update(css).digest('hex').slice(0,16)}.css`;
 const headers=readFileSync(new URL('../dist/_headers',import.meta.url),'utf8');
 assert.ok(headers.includes(`/${expected}\n  Cache-Control: public, max-age=31536000, immutable`));
 const original=readFileSync(new URL('../public/_headers',import.meta.url),'utf8').trimEnd();
 assert.ok(headers.startsWith(original));
 assert.deepEqual(readFileSync(new URL(`../dist/${expected}`,import.meta.url)),css);
});

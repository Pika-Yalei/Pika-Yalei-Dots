import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {collectSources,paginateSources,renderSourcePage} from './source-index.mjs';import {websitePages,renderWebsitePage} from './source-websites.mjs';
const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('source directory print outputs original and complete local reference addresses only on paper',()=>{
 const start=css.indexOf('@media print{'),end=css.indexOf('/*',start+20);
 const rules=css.match(/\.source-entry a\[href\^=[^\n]+/g);assert.equal(rules.length,2);
 for(const rule of rules)assert.ok(css.indexOf(rule)>start);
 assert.match(rules[0],/content:" \(" attr\(href\) "\)"/);
 assert.match(rules[1],/https:\/\/pika-yalei-dots\.yaleizhang\.com/);
 assert.match(css,/\.source-entry a::after\{[^}]*overflow-wrap:anywhere;word-break:break-word/);
 assert.equal(css.slice(0,start).includes('.source-entry a::after'),false);
});
test('both source views retain original source and exact reference hrefs for printed tracing',()=>{
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
 for(const page of paginateSources(collectSources(posts))) {const html=renderSourcePage(page);for(const source of page.sources){assert.ok(html.includes(`href="${esc(source.url)}"`));for(const ref of source.references)assert.ok(html.includes(`href="${esc(ref.href)}"`));}}
 for(const page of websitePages(posts)) {const html=renderWebsitePage(page);for(const source of page.sources){assert.ok(html.includes(`href="${esc(source.url)}"`));for(const ref of source.references)assert.ok(html.includes(`href="${esc(ref.href)}"`));}}
});

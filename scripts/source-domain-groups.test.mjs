import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSourceDomains,renderSourceDomainGroups } from './source-domain-groups.mjs';
const entry=host=>({host,href:'/sources/#anchor',count:2,pages:[{number:1,href:'/sources/#anchor'},{number:2,href:'/sources/page/2/#anchor'}]});
test('groups each website exactly once ignoring www for grouping but preserving host identity',()=>{
 const input=['www.z.example','a.example','3.example','www.a.example'].map(entry),before=structuredClone(input);
 const groups=groupSourceDomains(input);
 assert.deepEqual(groups.map(g=>g.key),['#','A','Z']);assert.equal(groups.flatMap(g=>g.items).length,4);assert.deepEqual(input,before);
 assert.equal(groups[1].items.length,2);
});
test('native grouped disclosure retains exact per-page destinations and escapes labels',()=>{
 const html=renderSourceDomainGroups([entry('a<.example'),entry('b.example')]);
 assert.equal((html.match(/<details/g)||[]).length,2);assert.match(html,/a&lt;.example/);assert.match(html,/第 2 页/);assert.match(html,/\/sources\/page\/2\/#anchor/);assert.doesNotMatch(html,/<script|onclick| open/);
 assert.equal(renderSourceDomainGroups([]),'');
});

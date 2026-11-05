import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSectionContent } from './article-content.mjs';
import { sectionAnchors, newsItemAnchors } from './reading-navigation.mjs';

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const url = 'https://github.com/simonw/llm/pull/1771';
const section = sectionAnchors([{
  heading: 'AI',
  paragraphs: ['栏目导语', '1. First。Facts', 'Analysis <one>', 'More analysis', '2. Second。Facts', 'Second analysis'],
  sources: [{label: '1. First source', url}, {label: '2. Second source', url}, {label: 'Additional', url}],
}])[0];

test('news targets contain complete continuation text and mapped citations before their permalink', () => {
  const html = renderSectionContent(section, escape, true);
  const items = [...html.matchAll(/<div class="news-item"[^>]*>([\s\S]*?)<\/div>/g)].map(match => match[1]);
  assert.equal(items.length, 2);
  assert.ok(html.startsWith('<p>栏目导语</p><div'));
  assert.match(items[0], /First。Facts/);
  assert.match(items[0], /Analysis &lt;one>/);
  assert.match(items[0], /More analysis<\/p><ul class="article-sources">/);
  assert.match(items[0], /1\. First source/);
  assert.doesNotMatch(items[0], /Second|Additional/);
  assert.match(items[1], /Second analysis<\/p><ul class="article-sources">/);
  assert.match(items[1], /2\. Second source/);
  for (const item of items) assert.ok(item.indexOf('class="news-permalink"') > item.indexOf('</ul>'));
  assert.ok(html.indexOf('补充来源') > html.lastIndexOf('</div>'));
  for (const id of newsItemAnchors(section).filter(Boolean)) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1);
    assert.ok(html.includes(`href="#${id}"`));
  }
});

test('non-anchored feed output and non-news paragraph order remain unchanged', () => {
  for (const [value, numbered] of [[{...section, id: undefined}, true], [section, false]]) {
    const html = renderSectionContent(value, escape, numbered, '\n');
    assert.doesNotMatch(html, /news-item|news-permalink/);
    let previous = -1;
    for (const paragraph of section.paragraphs) {
      const position = html.indexOf(`<p>${escape(paragraph)}</p>`);
      assert.ok(position > previous);
      previous = position;
    }
  }
});

test('empty sections, single items and trailing continuations keep balanced wrappers', () => {
  assert.equal(renderSectionContent({...section, paragraphs: [], sources: []}, escape, true), '');
  const html = renderSectionContent({...section, paragraphs: ['1. Only。Facts', 'Trailing analysis'], sources: []}, escape, true);
  assert.equal((html.match(/<div/g) || []).length, 1);
  assert.equal((html.match(/<\/div>/g) || []).length, 1);
  assert.match(html, /Trailing analysis<\/p><a class="news-permalink"/);
});

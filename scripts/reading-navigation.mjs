import { createHash } from 'node:crypto';

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Heading-derived anchors survive unrelated insertions and title edits.
// Repeated headings have independent targets, assigned in document order.
export function sectionAnchors(sections) {
  const used = new Set();
  return sections.map((section) => {
    const base = `section-${createHash('sha256').update(section.heading).digest('hex').slice(0, 16)}`;
    let id = base;
    let occurrence = 1;
    while (used.has(id)) {
      occurrence += 1;
      id = `${base}-${occurrence}`;
    }
    used.add(id);
    return { ...section, id };
  });
}

export function renderContents(sections) {
  return `<nav class="article-contents" aria-labelledby="contents-title"><h2 id="contents-title">本篇目录</h2><ol>${sections.map((section) => `<li><a href="#${section.id}">${escape(section.heading)}</a></li>`).join('')}</ol></nav>`;
}

export function renderAdjacent(posts, index) {
  const newer = posts[index - 1];
  const older = posts[index + 1];
  const links = [];
  if (older) {
    links.push(`<a href="/notes/${escape(older.slug)}/" rel="prev"><span>上一篇 · 较早的手记</span>${escape(older.title)}</a>`);
  }
  if (newer) {
    links.push(`<a href="/notes/${escape(newer.slug)}/" rel="next"><span>下一篇 · 较新的手记</span>${escape(newer.title)}</a>`);
  }
  if (!links.length) {
    return '';
  }
  return `<nav class="article-neighbors" aria-label="继续阅读">${links.join('')}</nav>`;
}

const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// Navigation is generated from the same section objects as the heading targets.
export function renderSectionNavigation(sections, index) {
  if (!Number.isInteger(index) || index < 0 || index >= sections.length || sections.length < 2) return '';
  const previous = sections[index - 1];
  const next = sections[index + 1];
  return `<nav class="section-navigation" aria-label="${escape(sections[index].heading)}之后的章节导航">${previous ? `<a href="#${escape(previous.id)}">← 上一栏：${escape(previous.heading)}</a>` : ''}<a href="#contents-title">回到本篇目录</a>${next ? `<a href="#${escape(next.id)}">下一栏：${escape(next.heading)} →</a>` : ''}</nav>`;
}

import { newsItemAnchors } from './reading-navigation.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// Reuse the body's stable item IDs; the outline never changes article text.
export function renderNewsOutline(section) {
  const anchors = newsItemAnchors(section);
  const entries = (section.paragraphs ?? []).flatMap((text, index) => anchors[index]
    ? [{id: anchors[index], label: text.split('。')[0]}] : []);
  if (entries.length < 2) return '';
  return `<details class="news-outline"><summary>本栏速览（${entries.length}条）</summary><nav aria-label="${escape(section.heading)}新闻速览"><ul>${entries.map(entry => `<li><a href="#${escape(entry.id)}">${escape(entry.label)}</a></li>`).join('')}</ul></nav></details>`;
}

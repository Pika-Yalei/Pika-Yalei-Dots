const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Keep discovery within the current topic without changing chronological navigation.
export function relatedNotes(posts, current) {
  return posts.filter(post => post.slug !== current.slug && post.category === current.category)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).slice(0, 2);
}

export function renderRelatedNotes(posts, current) {
  const related = relatedNotes(posts, current);
  if (!related.length) {
    return '';
  }
  return `<aside class="related-notes" aria-labelledby="related-notes-title"><h2 id="related-notes-title">同主题手记</h2><p>${escape(current.category)}</p><ul>${related.map(post => `<li><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a><p>${escape(post.summary)}</p></li>`).join('')}</ul></aside>`;
}

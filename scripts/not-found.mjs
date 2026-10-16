const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function renderNotFound(posts) {
  const recent = [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).slice(0, 3);
  const suggestions = recent.length ? `<section aria-labelledby="recent-notes"><h2 id="recent-notes">不妨从这些手记继续</h2><ul class="archive-list">${recent.map(post => `<li><time datetime="${escape(post.date)}">${escape(post.date.replaceAll('-', '.'))}</time><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('')}</ul></section>` : '';
  return `<section class="not-found article-shell"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>这一页，<br>还没写到。</h1><p>也可能是地址走岔了路。可以回到首页，或在归档中找一找。</p><p><a class="read-link" href="/">回到手记首页 →</a> · <a class="read-link" href="/archive/">浏览全部归档 →</a></p>${suggestions}</section>`;
}

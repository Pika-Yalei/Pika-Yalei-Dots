const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// The last item is the current page, not a redundant self-link.
export function renderBreadcrumbs(items) {
  if (!items.length) return '';
  return `<nav class="breadcrumbs" aria-label="当前位置"><ol role="list">${items.map((item, index) => {
    const separator = index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : '';
    const label = escape(item.label);
    const content = index === items.length - 1
      ? `<span aria-current="page">${label}</span>`
      : `<a href="${escape(item.href)}">${label}</a>`;
    return `<li>${separator}${content}</li>`;
  }).join('')}</ol></nav>`;
}

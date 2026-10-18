import { renderBreadcrumbs } from './breadcrumbs.mjs';
import { createHash } from 'node:crypto';

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Exact labels define categories. Hash UTF-16 code units so even distinct lone
// surrogates keep distinct paths; never use labels as filesystem or URL segments.
export function categoryPath(name) {
  const hash = createHash('sha256').update(name, 'utf16le').digest('hex');
  return `/categories/category-${hash}/`;
}

export function groupCategories(posts) {
  const categories = new Map();
  for (const post of posts) {
    if (!categories.has(post.category)) {
      categories.set(post.category, {name: post.category, path: categoryPath(post.category), posts: []});
    }
    categories.get(post.category).posts.push(post);
  }
  return [...categories.values()].sort((a, b) => compare(a.name, b.name)).map(category => ({
    ...category,
    posts: category.posts.sort((a, b) => compare(b.date, a.date) || compare(a.slug, b.slug))
  }));
}

export function renderCategories(categories) {
  const count = categories.reduce((total, category) => total + category.posts.length, 0);
  const list = categories.length ? `<ul class="category-list">${categories.map(category => `<li><a href="${category.path}"><span>${escape(category.name)}</span><span class="category-count">${category.posts.length} 篇</span></a></li>`).join('')}</ul>` : '<p class="archive-empty">这里还没有分类，第一篇手记发布后会自动出现。</p>';
  return `<div class="article-shell">${renderBreadcrumbs([{label:'首页', href:'/'}, {label:'分类'}])}<header class="article-header"><p class="eyebrow">THE NOTEBOOK, BY TOPIC.</p><h1>按分类浏览</h1><p class="article-subtitle">共 ${categories.length} 个分类 · ${count} 篇手记</p></header>${list}</div>`;
}

export function renderCategory(category) {
  const list = category.posts.map(post => `<li><time datetime="${escape(post.date)}">${escape(post.date.replaceAll('-', '.'))}</time><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('');
  return `<div class="article-shell">${renderBreadcrumbs([{label:'首页', href:'/'}, {label:'分类', href:'/categories/'}, {label:category.name}])}<header class="article-header"><p class="eyebrow">NOTES IN THIS CATEGORY</p><h1>${escape(category.name)}</h1><p class="article-subtitle">共 ${category.posts.length} 篇手记 · 按日期由新到旧</p></header><ol class="archive-list">${list}</ol></div>`;
}

'use strict';
// This reviewed script runs only on /search/. All data was embedded at build time.
(() => {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
  const data = document.getElementById('search-data');
  const records = JSON.parse(data.content.textContent).map(record => ({...record, haystack:normalize(`${record.title} ${record.detail}`)}));
  const ui = document.getElementById('search-ui').content.cloneNode(true);
  const query = ui.querySelector('#search-query');
  const type = ui.querySelector('#search-type');
  const clear = ui.querySelector('#search-clear');
  const pagination = ui.querySelector('#search-pagination');
  const previous = ui.querySelector('#search-previous');
  const next = ui.querySelector('#search-next');
  let page = 1;
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  const labels = {article:'文章', headline:'新闻条目', source:'引用来源'};
  function update(reset = false) {
    if (reset) page = 1;
    const terms = normalize(query.value.slice(0,200)).split(' ').filter(Boolean);
    const fragment = document.createDocumentFragment();
    let total = 0;
    if (terms.length) for (const record of records) {
      if ((type.value !== 'all' && record.type !== type.value) || !terms.every(term => record.haystack.includes(term))) continue;
      total += 1;
      if (total <= (page - 1) * 50 || total > page * 50) continue;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.textContent = record.title;
      link.href = record.href;
      link.rel = 'noreferrer';
      const detail = document.createElement('p');
      detail.textContent = `${record.date} · ${labels[record.type]} · ${record.detail}`;
      item.append(link, detail);
      if (record.reference) {
        const reference = document.createElement('a');
        reference.textContent = record.referenceLabel || '查看引用章节';
        reference.href = record.reference;
        item.append(reference);
      }
      fragment.append(item);
    }
    results.replaceChildren(fragment);
    results.start = (page - 1) * 50 + 1;
    pagination.hidden = total <= 50;
    previous.disabled = page <= 1;
    next.disabled = page * 50 >= total;
    status.textContent = terms.length ? `共找到 ${total} 条，显示 ${Math.min(Math.max(total-(page-1)*50,0),50)} 条。${total > 50 ? `第 ${page} / ${Math.ceil(total/50)} 页，显示第 ${(page-1)*50+1}–${Math.min(page*50,total)} 条。` : total === 0 ? '请尝试更短的关键词或其他内容类型。' : ''}` : '请输入关键词开始搜索。';
  }
  let composing = false;
  query.addEventListener('compositionstart', () => { composing = true; });
  query.addEventListener('compositionend', () => { composing = false; update(true); });
  query.addEventListener('input', () => { if (!composing) update(true); });
  type.addEventListener('change', () => update(true));
  previous.addEventListener('click', () => { if (!previous.disabled) { page -= 1; update(); } });
  next.addEventListener('click', () => { if (!next.disabled) { page += 1; update(); } });
  clear.addEventListener('click', () => { query.value = ''; type.value = 'all'; update(true); query.focus(); });
  update();
  // Reveal controls only after data parsing and all handlers succeeded. No form submission.
  document.getElementById('search-controls').append(ui);
})();

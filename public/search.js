'use strict';
// This reviewed script runs only on /search/. All data was embedded at build time.
(() => {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
  const data = document.getElementById('search-data');
  const records = JSON.parse(data.content.textContent).map(record => ({...record, haystack:normalize(`${record.title} ${record.detail}`)}));
  const ui = document.getElementById('search-ui').content.cloneNode(true);
  const query = ui.querySelector('#search-query');
  const type = ui.querySelector('#search-type');
  const from = ui.querySelector('#search-from');
  const to = ui.querySelector('#search-to');
  const clear = ui.querySelector('#search-clear');
  const pagination = ui.querySelector('#search-pagination');
  const previous = ui.querySelector('#search-previous');
  const next = ui.querySelector('#search-next');
  let page = 1;
  const status = document.getElementById('search-status');
  const results = document.getElementById('search-results');
  const labels = {article:'文章', headline:'新闻条目', source:'引用来源'};
  function update(reset = false, focusResults = false) {
    if (reset) page = 1;
    const terms = normalize(query.value.slice(0,200)).split(' ').filter(Boolean);
    const invalidInput = [from, to].some(input => input.validity?.badInput);
    const invalidRange = from.value && to.value && from.value > to.value;
    from.setAttribute('aria-invalid', String(Boolean(from.validity?.badInput || invalidRange)));
    to.setAttribute('aria-invalid', String(Boolean(to.validity?.badInput || invalidRange)));
    const hasFilter = terms.length || from.value || to.value;
    const fragment = document.createDocumentFragment();
    let total = 0;
    if (hasFilter && !invalidInput && !invalidRange) for (const record of records) {
      if ((from.value && record.date < from.value) || (to.value && record.date > to.value)) continue;
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
    status.textContent = invalidInput ? '日期输入不完整或无效，请输入完整的有效日期；当前未显示结果。' : invalidRange ? '起始日期不能晚于结束日期，请调整日期范围。' : hasFilter ? `共找到 ${total} 条，显示 ${Math.min(Math.max(total-(page-1)*50,0),50)} 条。${total > 50 ? `第 ${page} / ${Math.ceil(total/50)} 页，显示第 ${(page-1)*50+1}–${Math.min(page*50,total)} 条。` : total === 0 ? '请尝试更短的关键词或其他内容类型。' : ''}` : '请输入关键词或选择回顾日期范围。';
    if (focusResults) status.focus();
  }
  let composing = false;
  query.addEventListener('compositionstart', () => { composing = true; });
  query.addEventListener('compositionend', () => { composing = false; update(true); });
  query.addEventListener('input', () => { if (!composing) update(true); });
  from.addEventListener('input', () => update(true));
  to.addEventListener('input', () => update(true));
  from.addEventListener('change', () => update(true));
  to.addEventListener('change', () => update(true));
  type.addEventListener('change', () => update(true));
  previous.addEventListener('click', () => { if (!previous.disabled) { page -= 1; update(false, true); } });
  next.addEventListener('click', () => { if (!next.disabled) { page += 1; update(false, true); } });
  clear.addEventListener('click', () => { query.value = ''; type.value = 'all'; from.value = ''; to.value = ''; update(true); query.focus(); });
  update();
  // Reveal controls only after data parsing and all handlers succeeded. No form submission.
  document.getElementById('search-controls').append(ui);
})();

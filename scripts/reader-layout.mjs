// Native controls work with keyboard and touch; preferences are page-local only.
export function renderReaderLayout() {
  return `<fieldset class="reader-layout" aria-describedby="reader-layout-help"><legend>阅读版式</legend><div class="reader-layout-options"><label><input type="checkbox" name="reader-narrow">短行阅读</label><label><input type="checkbox" name="reader-spaced">宽松行距</label><label><input type="checkbox" name="reader-sans">无衬线正文</label></div><p id="reader-layout-help">可与字号组合使用；“无衬线正文”使用系统黑体，不下载字体；取消勾选即可恢复。只影响本页屏幕正文，不保存偏好。</p></fieldset>`;
}

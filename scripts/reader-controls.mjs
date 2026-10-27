// Native radios keep the reading preference keyboard-accessible without JavaScript.
export function renderReaderControls() {
  return `<fieldset class="reader-controls"><legend>阅读字号</legend><div class="reader-controls-options"><label><input type="radio" name="reader-size" value="default" checked>默认</label><label><input type="radio" name="reader-size" value="large">大</label><label><input type="radio" name="reader-size" value="larger">更大</label></div><p>仅调整本页正文，不保存偏好；也可使用浏览器缩放。</p></fieldset>`;
}

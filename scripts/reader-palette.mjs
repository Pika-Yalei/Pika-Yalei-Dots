// Native radios: no script, request, cookie, or saved preference is needed.
export function renderReaderPalette() {
  return `<fieldset class="reader-palette"><legend>阅读配色</legend><div class="reader-palette-options"><label><input type="radio" name="reader-palette" value="auto" checked>跟随系统</label><label><input type="radio" name="reader-palette" value="light">浅色</label><label><input type="radio" name="reader-palette" value="dark">深色</label></div><p>仅调整本页阅读区，不保存偏好；选择“跟随系统”恢复。可与字号、版式组合使用；打印与系统高对比度不受影响。</p></fieldset>`;
}

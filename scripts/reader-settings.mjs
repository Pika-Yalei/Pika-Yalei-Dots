import { renderReaderPalette } from './reader-palette.mjs';
import { renderReaderLayout } from './reader-layout.mjs';
import { renderReaderControls } from './reader-controls.mjs';

// Only optional appearance controls collapse; prose and topic focus stay outside.
// Native details retains input state when closed without scripts or persistence.
export function renderReaderSettings() {
  return `<details class="reader-settings"><summary>阅读设置：配色、版式、字号</summary><p class="reader-settings-hint">展开调整阅读外观；收起不会重置。本页偏好不保存，正文和栏目筛选不随设置折叠。</p>${renderReaderPalette()}${renderReaderLayout()}${renderReaderControls()}</details>`;
}

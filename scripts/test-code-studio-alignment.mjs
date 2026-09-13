import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  for (const width of [1600, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    await page.goto((process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:8197') + '/apps/code-studio/');
    await page.evaluate(() => document.fonts.ready);
    const line = '    document.getElementById("siteFrame").src =    ';
    const prefix = Array.from({ length: 75 }, (_, i) => '// line ' + (i + 1)).join('\n') + '\n';
    const input = page.locator('[data-code-input]');
    await input.fill(prefix + line);
    const geometry = await input.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      el.scrollLeft = 0;
      el.dispatchEvent(new Event('scroll'));
      const code = document.querySelector('[data-highlight] code');
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      const target = el.value.length;
      let count = 0, node;
      while ((node = walker.nextNode())) {
        if (count + node.length >= target) {
          const range = document.createRange();
          range.setStart(node, target - count - 1); range.setEnd(node, target - count);
          const rect = range.getBoundingClientRect();
          const style = getComputedStyle(el), rendered = getComputedStyle(code);
          const canvas = document.createElement('canvas').getContext('2d');
          canvas.font = style.font;
          const expected = el.getBoundingClientRect().left + parseFloat(style.paddingLeft) + canvas.measureText(el.value.split('\n').at(-1)).width;
          return { x: rect.right, y: rect.top + rect.height / 2, expected, inputFont: style.fontFamily, renderedFont: rendered.fontFamily };
        }
        count += node.length;
      }
    });
    assert.equal(geometry.renderedFont, geometry.inputFont, 'Visible code and caret must share their font');
    assert.ok(Math.abs(geometry.x - geometry.expected) < 1, 'Line 76 rendered end agrees with the editable text width');
    // Keyboard navigation also works when line 76 extends beyond a narrow viewport.
    await input.press('Control+End');
    for (let i = 0; i < 4; i++) await input.press('Backspace');
    assert.equal(await input.inputValue(), prefix + line.slice(0, -4), 'Four trailing spaces delete without touching code');
    await input.press('Backspace');
    assert.equal(await input.inputValue(), prefix + line.slice(0, -5));
    if (width === 1600) {
      await input.fill(prefix + line);
      await page.mouse.click(geometry.x - 1, geometry.y);
      assert.equal(await input.evaluate(el => el.selectionStart), (prefix + line).length, 'Clicking the visible line ending places the caret at its real ending');
    }
    console.log('PASS editor alignment, line 76 trailing-space deletion and navigation:', width);
    await page.close();
  }
} finally { await browser.close(); }

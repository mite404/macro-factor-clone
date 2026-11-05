import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = process.env.STORYBOOK_URL || 'http://localhost:6006';
const session = `mf-check-${process.pid}`;
const done = "['finished', 'errored', 'aborted'].includes(window.__STORYBOOK_PREVIEW__?.currentRender?.phase)";

function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], {
    encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const response = await fetch(`${origin}/index.json`);
assert(response.ok, `Storybook index returned ${response.status}. Start npm run storybook first.`);
const { entries } = await response.json();
const stories = Object.values(entries).filter(entry => entry.type === 'story');
assert(stories.length > 0, 'No stories were discovered');

try {
  browser('open', 'about:blank');
  browser('set', 'viewport', '390', '844', '2');
  for (const { id } of stories) {
    browser('open', `${origin}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
    browser('wait', '--fn', done);
    const phase = JSON.parse(browser('eval', 'window.__STORYBOOK_PREVIEW__.currentRender.phase'));
    const consoleOutput = browser('console');
    assert.equal(phase, 'finished', `${id}: play ${phase}\n${consoleOutput}`);
    assert.equal(browser('errors'), '', `${id}: browser error`);
    assert(!consoleOutput.includes('[error]'), `${id}: ${consoleOutput}`);
    browser('console', '--clear');
    console.log(`PASS ${id}`);
  }
  console.log(`${stories.length} stories rendered at 390 px; all play assertions passed`);

  // The App preview is a centered phone of at most 390 × 844 at any window size. Smaller windows shrink
  // it, the page never scrolls, and long content scrolls inside the screen instead of growing it.
  const screen = `(() => { const el = document.querySelector('[data-testid=reference-screen]'); const r = el.getBoundingClientRect();
    const list = [...el.querySelectorAll('div')].find((div) => ['auto', 'scroll'].includes(getComputedStyle(div).overflowY));
    const page = document.documentElement;
    return { page: [page.clientWidth, page.clientHeight, page.scrollHeight], left: r.left, width: r.width, height: r.height,
      list: [list.clientHeight, list.scrollHeight] }; })()`;
  for (const id of ['app--empty-diary', 'app--targets-large-text']) {
    browser('set', 'viewport', '1280', '900', '2');
    browser('open', `${origin}/iframe.html?id=${id}&viewMode=story`);
    browser('wait', '--fn', done);
    for (const [width, height] of [[1280, 900], [320, 700], [1280, 900]]) {
      browser('set', 'viewport', String(width), String(height), '2');
      const { page: [pageW, pageH, scrollH], left, width: w, height: h, list } = JSON.parse(browser('eval', screen));
      const [expectedW, expectedH] = [Math.min(390, pageW), Math.min(844, pageH)];
      const at = `${id} at ${width} × ${height}`;
      assert.deepEqual([w, h, left, scrollH], [expectedW, expectedH, (pageW - expectedW) / 2, pageH], at);
      if (id === 'app--targets-large-text') assert(list[1] > list[0], `${at}: list ${list} must scroll inside the screen`);
    }
    console.log(`PASS ${id} fits 390 × 844 at 1280 and 320 px windows`);
  }
} finally {
  browser('close');
}

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
} finally {
  browser('close');
}

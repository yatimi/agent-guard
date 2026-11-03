// Author: Tommy
// Own disposable Chrome profile, outside the checkout; no npm dependencies.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, realpath, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const temporaryRoot = await realpath(tmpdir());
if (temporaryRoot === root || temporaryRoot.startsWith(root + sep)) throw new Error('Browser artifacts must be outside the repository.');
const output = await mkdtemp(join(temporaryRoot, 'agentguard-chrome-'));
const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executable = candidates.find(path => existsSync(path));
if (!executable) throw new Error('Chrome/Chromium required for optional browser checks. Set CHROME_BIN to its executable. npm run verify does not need a browser.');
const log = await open(join(output, 'chrome.log'), 'w');
const chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${output}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'], { stdio: ['ignore', log.fd, log.fd] });
let chromeError, current, interrupted = false;
chrome.on('error', error => { chromeError = error; });
const stop = () => { interrupted = true; current?.kill('SIGTERM'); chrome.kill('SIGTERM'); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
const deadline = setTimeout(stop, 180000);
try {
  let port;
  for (let i = 0; i < 1200; i++) {
    if (chromeError) throw chromeError;
    if (chrome.exitCode !== null || chrome.signalCode !== null || interrupted) throw new Error(`Chrome stopped; inspect ${output}/chrome.log`);
    try { port = (await readFile(join(output, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (port) break; await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!/^\d+$/.test(port || '')) throw new Error(`Chrome debug port unavailable; ${output}/chrome.log`);
  for (const script of ['scripts/check-browser.mjs', 'scripts/check-demo-browser.mjs']) {
    if (interrupted) throw new Error('Browser checks interrupted');
    const code = await new Promise((resolve, reject) => {
      current = spawn(process.execPath, [script], { cwd: root, env: { ...process.env, AGENTGUARD_BROWSER_DEBUG_URL: `http://127.0.0.1:${port}` }, stdio: 'inherit' });
      current.once('error', reject); current.once('close', resolve);
    });
    current = null; if (code !== 0 || interrupted) throw new Error(`Browser check failed: ${script}`);
  }
  console.log(`Browser checks passed; disposable profile/logs: ${output}`);
} catch (error) {
  const diagnostic = await readFile(join(output, 'chrome.log'), 'utf8').catch(() => 'No Chrome log available.');
  console.error(`Chrome launch: ${executable}\n${diagnostic.slice(-12000)}`);
  throw error;
} finally {
  clearTimeout(deadline); current?.kill('SIGTERM');
  if (chrome.exitCode === null && chrome.signalCode === null) await new Promise(resolve => {
    const force = setTimeout(() => chrome.kill('SIGKILL'), 5000);
    chrome.once('close', () => { clearTimeout(force); resolve(); }); chrome.kill('SIGTERM');
  });
  await log.close();
}

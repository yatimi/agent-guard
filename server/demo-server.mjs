// Author: Tommy
import { readFile } from 'node:fs/promises';
import { siteServer } from './site-server.mjs';
import { demoCases } from './demo-cases.mjs';
export async function demoServer() {
  const evidence = JSON.stringify(await demoCases());
  const panel = await readFile(new URL('../web/judge-panel.html', import.meta.url), 'utf8');
  return siteServer({
    api: (request, response, url) => {
      const ok = request.method === 'GET' && url.pathname === '/api/demo';
      response.writeHead(ok ? 200 : 405, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Allow: 'GET' });
      response.end(ok ? evidence : JSON.stringify({ error: 'RECORDED_DEMO_ONLY', message: 'This server cannot create purchases, sign transactions or call AI.' }));
    },
    transformIndex: html => {
      const start = html.indexOf('    <section id="live-purchase"');
      const end = html.indexOf('    <div id="security-lab"');
      const script = '<script type="module" src="/live-purchase.mjs"></script>';
      if (start < 0 || end <= start || !html.includes(script)) throw new Error('Review the demo page template markers.');
      return (html.slice(0, start) + panel + '\n' + html.slice(end))
        .replace(script, '<script type="module" src="/judge-demo.mjs"></script>')
        .replace('Investigate a NEAR transaction.', 'Replay a recorded transaction.')
        .replace('LOCAL LAB', 'OFFLINE DEMO');
    },
  });
}

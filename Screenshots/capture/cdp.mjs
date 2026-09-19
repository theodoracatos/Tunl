// Minimal CDP driver: launch headless Chrome, evaluate JS, grab the game canvas.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch(port = 9333) {
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`,
    '--user-data-dir=/tmp/tunl-shot-profile', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', '--disable-lcd-text', '--lang=en-US',
    '--window-size=1200,700',
  ], { stdio: 'ignore' });
  let info = null;
  for (let i = 0; i < 80; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(150); }
  }
  if (!info) throw new Error('chrome did not start');
  return { proc, port, wsUrl: info.webSocketDebuggerUrl };
}

export class Session {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null; }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const s = new Session(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && s.pending.has(m.id)) {
        const { res, rej } = s.pending.get(m.id); s.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
    const { targetInfos } = await s.send('Target.getTargets');
    let page = targetInfos.find(t => t.type === 'page');
    if (!page) {
      const { targetId } = await s.send('Target.createTarget', { url: 'about:blank' });
      page = { targetId };
    }
    const { sessionId } = await s.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    s.sessionId = sessionId;
    return s;
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (useSession && this.sessionId) msg.sessionId = this.sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify(msg));
    });
  }
  async eval(expr, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, awaitPromise, returnByValue: true, allowUnsafeEvalBlocklistedAPI: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  close() { this.ws.close(); }
}

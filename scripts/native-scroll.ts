#!/usr/bin/env bun
/**
 * Native scrollbar check for the production build.
 *
 * Serves `dist` (or measures `--url`), drives a headed Chrome -- headless
 * Chrome draws overlay scrollbars, not the 8px thumb a reader presses -- with
 * real mouse input on the page's own scrollbar, in light and dark, and fails
 * unless every journey ends where `.claude/rules/scroll-choreography.md` says
 * it must, with no page error. The chapter hand-offs a thumb drag makes, and
 * what the page may do while the reader holds the thumb (rounds 25-31), are
 * each one journey. A report lands in perf-reports/.
 *
 *   bun run build && bun run native:scroll [--theme light|dark] [--chrome <path>] [--url <origin> | --port 4320]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Scope, delay, until, type Cdp } from './perf/harness';
import { chromeExecutable, launchChrome, servePreview } from './perf/launch';

const USAGE = 'Usage: bun run native:scroll [--theme light|dark] [--chrome <path>] [--url <origin> | --port <port>]';
const WIDTH = 1440;
const HEIGHT = 900;

interface State { top: number; nav?: string; skills?: string; tv?: string; contact?: string }
interface Outcome { theme: string; journey: string; pass: boolean; expected: string; measured: unknown }

function options(argv: string[]) {
  const read = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const theme = read('--theme');
  if (theme && theme !== 'light' && theme !== 'dark') throw new Error(`--theme must be light or dark\n${USAGE}`);
  const port = Number(read('--port') ?? 4320);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`--port must be a port number\n${USAGE}`);
  return { url: read('--url'), port, chrome: read('--chrome'), themes: theme ? [theme] : ['light', 'dark'] };
}

const STATE = `(() => {
  const stage = id => document.querySelector('[data-testid="' + id + '"]')?.dataset.phase;
  return { top: Math.round(window.__scroller.scrollTop),
    nav: document.querySelector('button[data-ink-control][aria-current="page"]')?.textContent?.trim(),
    skills: stage('skills-stage'), tv: stage('projects-stage'), contact: document.querySelector('#contact')?.dataset.contactState };
})()`;

async function journeys(cdp: Cdp, origin: string, theme: string): Promise<Outcome[]> {
  const { browserContextId } = await cdp.send<{ browserContextId: string }>('Target.createBrowserContext');
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank', browserContextId });
  const outcomes: Outcome[] = [];
  const errors: string[] = [];
  let unsubscribe = () => {};
  try {
    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    const send = <T = unknown>(method: string, params?: Record<string, unknown>) => cdp.send<T>(method, params, { sessionId });
    const evaluate = async <T = unknown>(expression: string) =>
      (await send<{ result: { value: T } }>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
    type Thrown = { exceptionDetails: { text: string; exception?: { description?: string } } };
    type Logged = { type: string; args: { value?: unknown; description?: string }[] };
    const stops = [
      cdp.on('Runtime.exceptionThrown', (params, session) => {
        if (session !== sessionId) return;
        const { exceptionDetails } = params as unknown as Thrown;
        errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
      }),
      cdp.on('Runtime.consoleAPICalled', (params, session) => {
        const { type, args } = params as unknown as Logged;
        if (session === sessionId && type === 'error') errors.push(args.map(arg => String(arg.value ?? arg.description)).join(' '));
      }),
    ];
    unsubscribe = () => stops.forEach(stop => stop());
    for (const domain of ['Page', 'Runtime']) await send(`${domain}.enable`);
    await send('Emulation.setScrollbarsHidden', { hidden: false });
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false, screenWidth: WIDTH, screenHeight: HEIGHT,
    });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('theme', ${JSON.stringify(theme)})` });
    await send('Page.navigate', { url: `${origin}/` });
    await until(() => evaluate<boolean>(`/settled/.test(document.querySelector('[data-testid="hero-content"]')?.className || '')`),
      { timeoutMs: 120_000, intervalMs: 250, label: 'the hero settling' });
    await delay(1500);
    // The story's scrollport: the tallest scrollable box.
    await evaluate(`window.__scroller = [...document.querySelectorAll('div')].filter(e => e.clientHeight > innerHeight * .8 &&
      e.scrollHeight > e.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(e).overflowY))
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]; 0`);

    const state = () => evaluate<State>(STATE);
    const phase = (id: string, value: string, extra = 'true') => until(() => evaluate<boolean>(
      `document.querySelector('[data-testid="${id}"]')?.dataset.phase === '${value}' && ${extra}`), { timeoutMs: 20_000, label: `${id} ${value}` });
    const nav = (id: string) => evaluate(`document.querySelector('button[data-ink-control="${id}"]:not([tabindex="-1"])').click()`);
    const cta = (index: number) => evaluate(`document.querySelectorAll('[data-testid="hero-content"] button')[${index}].click()`);
    /** Where the thumb's centre is, and where it would be `pixels` further on. */
    const thumb = (pixels = 0) => evaluate<{ x: number; from: number; to: number }>(`(() => {
      const e = window.__scroller, r = e.getBoundingClientRect(), h = e.clientHeight, max = e.scrollHeight - h, size = Math.max(18, h * h / e.scrollHeight);
      const at = v => r.top + (h - size) * v / max + size / 2;
      return { x: r.right - 4, from: at(e.scrollTop), to: at(Math.min(max, Math.max(0, e.scrollTop + ${pixels}))) };
    })()`);
    const mouse = (type: string, x: number, y: number, buttons = 0) => send('Input.dispatchMouseEvent', {
      type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1,
    });
    const press = (x: number, y: number) => mouse('mousePressed', x, y, 1);
    const release = (x: number, y: number) => mouse('mouseReleased', x, y);
    const move = async (x: number, from: number, to: number, steps: number) => {
      for (let step = 1; step <= steps; step++) {
        await mouse('mouseMoved', x, from + (to - from) * step / steps, 1);
        await delay(40);
      }
    };
    const drag = async (pixels: number) => {
      const at = await thumb(pixels);
      await mouse('mouseMoved', at.x, at.from);
      await delay(200);
      await press(at.x, at.from);
      await move(at.x, at.from, at.to, 12);
      await release(at.x, at.to);
    };
    const key = async (name: string, code: number) => {
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: code });
    };
    const check = (journey: string, expected: string, measured: unknown, pass: boolean) => {
      outcomes.push({ theme, journey, pass, expected, measured });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${theme.padEnd(5)} ${journey}: ${expected} -> ${JSON.stringify(measured)}`);
    };

    // A drag past the last skill hands the reader to Projects, framed.
    await nav('skills');
    await phase('skills-stage', 'reading');
    await delay(1200);
    await evaluate(`document.querySelector('[aria-label="Show Professional Skills"]').click()`);
    await phase('skills-stage', 'reading', `document.querySelector('[data-testid="skills-stage"]').dataset.activeSkill === '5'`);
    await delay(1500);
    await drag(1800);
    await delay(4500);
    let now = await state();
    check('skills forward', 'Projects, TV framed', now, now.nav === 'Projects' && now.tv === 'framed');

    // A drag back from the TV's reader leaves it framed, not skipped.
    await nav('projects');
    await phase('projects-stage', 'reading');
    await delay(1500);
    await drag(-1800);
    await delay(4500);
    now = await state();
    check('TV reverse', 'Projects, TV framed', now, now.nav === 'Projects' && now.tv === 'framed');

    // A drag back from Contact returns to the TV's reader.
    await nav('contact');
    await delay(2500);
    await drag(-2930);
    await delay(4000);
    now = await state();
    check('Contact reverse', 'Projects, TV reading', now, now.nav === 'Projects' && now.tv === 'reading');

    // Held still: a CTA asked for under the thumb waits for the release, then lands.
    await nav('home');
    await delay(2500);
    let at = await thumb();
    await mouse('mouseMoved', at.x, at.from);
    await delay(200);
    await press(at.x, at.from);
    await delay(150);
    await cta(0);
    await delay(1500);
    const held = await state();
    await release(at.x, at.from);
    await delay(2500);
    now = await state();
    check('held still, then CTA', 'nothing moves while held; About after release', { held, after: now },
      held.top === 0 && held.nav === 'Home' && now.nav === 'About');

    // A glide pressed while it runs stops where it is, and stays there.
    await nav('home');
    await delay(2500);
    await cta(1);
    // Early in the glide the thumb is barely moving, so the press lands on it.
    await delay(150);
    at = await thumb();
    await press(at.x, at.from);
    const pressed = await state();
    await delay(1500);
    const whileHeld = await state();
    await release(at.x, at.from);
    await delay(1500);
    now = await state();
    check('press during a glide', 'the glide under way stops at the press', { pressed: pressed.top, held: whileHeld.top, after: now },
      pressed.top > 0 && pressed.top < 3000 && Math.abs(whileHeld.top - pressed.top) <= 2 &&
      Math.abs(now.top - pressed.top) <= 4 && now.nav !== 'Contact');

    // Round 29 (TECH-081): End under the thumb queues Contact; the reader's own ArrowUp and drag win.
    await nav('projects');
    await phase('projects-stage', 'reading');
    await delay(1500);
    await evaluate(`document.querySelector('button[data-ink-control="contact"]:not([tabindex="-1"])').focus()`);
    at = await thumb();
    await mouse('mouseMoved', at.x, at.from);
    await delay(200);
    await press(at.x, at.from);
    const heldAt = (await state()).top;
    await key('End', 35);
    await delay(300);
    await key('ArrowUp', 38);
    await move(at.x, at.from, at.from - 30, 6);
    await release(at.x, at.from - 30);
    await delay(2500);
    now = await state();
    check('End, then the thumb', 'not Contact, above where the thumb was taken', { heldAt, after: now },
      now.nav !== 'Contact' && now.top < heldAt);

    // Round 30 (TECH-085): a CTA's glide begun under the thumb gives way to the reader's drag.
    await nav('home');
    await delay(2500);
    at = await thumb(35);
    await mouse('mouseMoved', at.x, at.from);
    await delay(200);
    await press(at.x, at.from);
    await delay(150);
    await cta(1);
    await delay(200);
    await move(at.x, at.from, at.to, 7);
    await delay(1200);
    const dragged = (await state()).top;
    await release(at.x, at.to);
    await delay(2500);
    now = await state();
    check('CTA, then the thumb', 'where the thumb left the page, not Contact', { dragged, after: now },
      dragged > 10 && Math.abs(now.top - dragged) <= 4 && now.nav !== 'Contact');

    check('no page errors', 'none', errors, errors.length === 0);
    return outcomes;
  } finally {
    unsubscribe();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

async function main() {
  const { url, port, chrome, themes } = options(process.argv.slice(2));
  const scope = new Scope();
  const interrupt = () => { void scope.close().finally(() => process.exit(130)); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const outcomes: Outcome[] = [];
  let failure: unknown;
  try {
    const origin = url ?? await servePreview(scope, port);
    const cdp = await launchChrome(scope, { executable: chromeExecutable(chrome), headed: true, width: WIDTH, height: HEIGHT + 120 });
    for (const theme of themes) outcomes.push(...await journeys(cdp, origin, theme));
  } catch (error) {
    failure = error;
  }
  const cleanup = (await scope.close()).map(error => `cleanup: ${error.message}`);
  const pass = !failure && cleanup.length === 0 && outcomes.length > 0 && outcomes.every(outcome => outcome.pass);
  await mkdir(resolve('perf-reports'), { recursive: true });
  const report = resolve('perf-reports', `native-scroll-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(report, JSON.stringify({
    date: new Date().toISOString(), origin: url ?? `owned vite preview on ${port}`, outcomes, cleanup,
    failure: failure ? String((failure as Error).stack ?? failure) : null, pass,
  }, null, 2));
  if (failure) console.error(failure);
  for (const line of cleanup) console.error(line);
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${outcomes.filter(outcome => outcome.pass).length}/${outcomes.length} journeys; ${report}`);
  process.exitCode = pass ? 0 : 1;
}

main().then(() => process.exit(), error => {
  console.error(error);
  process.exit(1);
});

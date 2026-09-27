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
 *   bun run build && bun run native:scroll [--theme light|dark] [--chrome <path>] [--chrome-arg <switch>]... [--url <origin> | --port 4320]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Scope, delay, until, type Cdp } from './perf/harness';
import { chromeExecutable, launchChrome, servePreview } from './perf/launch';
import { NativeScrollUsageError, parseNativeScrollOptions } from './perf/nativeScrollOptions';

const WIDTH = 1440;
const HEIGHT = 900;

interface State { top: number; nav?: string; skills?: string; tv?: string; contact?: string }
interface Outcome { theme: string; journey: string; pass: boolean; expected: string; measured: unknown }

const STATE = `(() => {
  const stage = id => document.querySelector('[data-testid="' + id + '"]')?.dataset.phase;
  return { top: Math.round(window.__scroller.scrollTop),
    nav: document.querySelector('button[data-ink-control][aria-current="page"]')?.textContent?.trim(),
    skills: stage('skills-stage'), tv: stage('projects-stage'), contact: document.querySelector('#contact')?.dataset.contactState };
})()`;

async function journeys(cdp: Cdp, origin: string, theme: string, outcomes: Outcome[]): Promise<void> {
  const { browserContextId } = await cdp.send<{ browserContextId: string }>('Target.createBrowserContext');
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank', browserContextId });
  const errors: string[] = [];
  const warnings: string[] = [];
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
        if (session !== sessionId) return;
        const text = args.map(arg => String(arg.value ?? arg.description)).join(' ');
        if (type === 'error') errors.push(text);
        if (type === 'warning') warnings.push(text);
      }),
    ];
    unsubscribe = () => stops.forEach(stop => stop());
    for (const domain of ['Page', 'Runtime']) await send(`${domain}.enable`);
    // In front, so no other window covers it: a covered window is throttled like a background tab.
    await send('Page.bringToFront');
    await send('Emulation.setScrollbarsHidden', { hidden: false });
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false, screenWidth: WIDTH, screenHeight: HEIGHT,
    });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('theme', ${JSON.stringify(theme)})` });
    await send('Page.navigate', { url: `${origin}/` });
    await until(() => evaluate<boolean>(`/settled/.test(document.querySelector('[data-testid="hero-content"]')?.className || '')`),
      { timeoutMs: 120_000, intervalMs: 250, label: 'the hero settling' });
    await delay(1500);
    // Every journey is the 3D story's. A page that opened flat -- no WebGL, or a stage that arrived too
    // late -- has no scrollport to press, and says why in its console (round 33, TECH-088).
    const stage = await evaluate<{ canvas: boolean; visibility: string; renderer: string }>(`(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const debug = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { canvas: !!document.querySelector('canvas'), visibility: document.visibilityState,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl ? 'masked' : 'no WebGL' };
    })()`);
    // The story's scrollport: the tallest scrollable box.
    const found = await evaluate<boolean>(`!!(window.__scroller = [...document.querySelectorAll('div')].filter(e => e.clientHeight > innerHeight * .8 &&
      e.scrollHeight > e.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(e).overflowY))
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0])`);
    if (!stage.canvas || !found) {
      throw new Error(`${theme}: the page opened without its 3D stage, so there is no scrollport to press ` +
        `(canvas ${stage.canvas}, scrollport ${found}, visibility ${stage.visibility}, renderer ${stage.renderer}). ` +
        `Console: ${warnings.concat(errors).join(' | ') || 'nothing'}`);
    }

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

    // Round 34 (D-R34-001): after the navbar's About, a move with no gesture -- a track click, the
    // browser's find -- into About's hand-off or into Skills must still end in a chapter read.
    const reading = (ids: readonly string[]) => until(() => evaluate<boolean>(
      `${JSON.stringify(ids)}.some(id => document.querySelector('[data-testid="' + id + '"]')?.dataset.phase === 'reading')`),
      { timeoutMs: 20_000, label: `${ids.join(' or ')} reading` }).then(() => true, () => false);
    // Travel never skips a chapter: past About, the story owes Education first, as a thumb drag over it does.
    for (const [label, stages, share] of [
      ['into About\'s hand-off', ['education-stage'], 0.33],
      ['into Skills', ['education-stage', 'skills-stage'], 1.5],
    ] as const) {
      await nav('about');
      await delay(4500);
      const from = (await state()).top;
      // A place measured from the page, in the scroller's own units: this far down from About's landing.
      const to = await evaluate<number>(`(() => { const s = window.__scroller, skills = document.getElementById('skills').getBoundingClientRect();
        const content = s.scrollHeight - s.clientHeight, main = document.querySelector('main').scrollHeight - innerHeight;
        return Math.round(s.scrollTop + skills.top * ${share} * content / main); })()`);
      await evaluate(`window.__scroller.scrollTop = ${to}; 0`);
      const read = await reading(stages);
      now = await state();
      const education = await evaluate<string>(`document.querySelector('[data-testid="education-stage"]')?.dataset.phase ?? ''`);
      check(`a jump with no gesture ${label}`, `${stages.join(' or ')} reading`, { from, to, after: now, education, read }, read);
    }

    check('no page errors', 'none', errors, errors.length === 0);
  } catch (error) {
    // What the page said is usually why a journey could not go on.
    const said = warnings.concat(errors);
    if (said.length && !String((error as Error).message).includes('Console:')) {
      (error as Error).message += `. Console: ${said.join(' | ')}`;
    }
    throw error;
  } finally {
    unsubscribe();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

async function main() {
  const { url, port, chrome, args, themes } = parseNativeScrollOptions(process.argv.slice(2));
  const scope = new Scope();
  const interrupt = () => { void scope.close().finally(() => process.exit(130)); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const outcomes: Outcome[] = [];
  const failures: unknown[] = [];
  try {
    const origin = url ?? await servePreview(scope, port);
    const cdp = await launchChrome(scope, {
      executable: chromeExecutable(chrome), headed: true, width: WIDTH, height: HEIGHT + 120,
      // Headed, so a window on top of it would occlude it: occluded, Chrome throttles its timers and
      // frames, and the stage can miss the app's own deadline and open the page flat (round 33, TECH-088).
      flags: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', ...args],
    });
    // A theme that cannot go on is reported, and the next still runs.
    for (const theme of themes) await journeys(cdp, origin, theme, outcomes).catch(error => { failures.push(error); });
  } catch (error) {
    failures.push(error);
  }
  const cleanup = (await scope.close()).map(error => `cleanup: ${error.message}`);
  const pass = failures.length === 0 && cleanup.length === 0 && outcomes.length > 0 && outcomes.every(outcome => outcome.pass);
  await mkdir(resolve('perf-reports'), { recursive: true });
  const report = resolve('perf-reports', `native-scroll-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(report, JSON.stringify({
    date: new Date().toISOString(), origin: url ?? `owned vite preview on ${port}`, outcomes, cleanup,
    failures: failures.map(failure => String((failure as Error).stack ?? failure)), pass,
  }, null, 2));
  for (const failure of failures) console.error(failure);
  for (const line of cleanup) console.error(line);
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${outcomes.filter(outcome => outcome.pass).length}/${outcomes.length} journeys; ${report}`);
  process.exitCode = pass ? 0 : 1;
}

main().then(() => process.exit(), error => {
  // A usage mistake is said plainly and exits 2, as the perf budget's does.
  console.error(error instanceof NativeScrollUsageError ? error.message : error);
  process.exit(error instanceof NativeScrollUsageError ? 2 : 1);
});

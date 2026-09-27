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
 * each one journey. A last pass, in a 900x560 window, sends the Contact form
 * blank and then as a failed delivery (the email service is failed by the
 * check itself, so nothing is ever sent), and asks that each answer be shown
 * whole. A report lands in perf-reports/.
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
/** The compact window a blank send put Name under the navbar in (round 8, D-A11Y-002). */
const FORM = { width: 900, height: 560 };

type Mode = 'story' | 'reduced' | 'form';

interface State { top: number; nav?: string; skills?: string; tv?: string; contact?: string }
interface Outcome { theme: string; journey: string; pass: boolean; expected: string; measured: unknown }

const STATE = `(() => {
  const stage = id => document.querySelector('[data-testid="' + id + '"]')?.dataset.phase;
  return { top: Math.round(window.__scroller.scrollTop),
    nav: document.querySelector('button[data-ink-control][aria-current="page"]')?.textContent?.trim(),
    skills: stage('skills-stage'), tv: stage('projects-stage'), contact: document.querySelector('#contact')?.dataset.contactState };
})()`;

async function journeys(cdp: Cdp, origin: string, theme: string, outcomes: Outcome[], mode: Mode = 'story'): Promise<void> {
  const reduced = mode === 'reduced';
  const { width, height } = mode === 'form' ? FORM : { width: WIDTH, height: HEIGHT };
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
      width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height,
    });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('theme', ${JSON.stringify(theme)})` });
    if (reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
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
    const label = reduced ? `${theme}, reduced motion` : mode === 'form' ? `${theme}, ${width}x${height}` : theme;
    const check = (journey: string, expected: string, measured: unknown, pass: boolean) => {
      outcomes.push({ theme: label, journey, pass, expected, measured });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${label.padEnd(5)} ${journey}: ${expected} -> ${JSON.stringify(measured)}`);
    };

    if (reduced) {
      // Round 35 (D-R35-001): read as a linear page, Skills landed under a band of Education's green,
      // and the footer's invitation sat over its proof link. What lies under the navbar is Skills' own.
      await nav('skills');
      await delay(3500);
      // Geometry, not hit-testing: the chapter's own box reaches the top, and every green one has ended above it.
      const landing = await evaluate<{ skillsTop: number; greenBottom: number; invitation: boolean; staged: string | undefined }>(`(() => {
        const skills = document.getElementById('skills');
        const greens = [...document.querySelectorAll('[data-green-bg]')].map(e => e.getBoundingClientRect()).filter(r => r.height > 0);
        const invitation = [...document.querySelectorAll('[data-page-footer]')].some(f => /Scroll to explore/.test(f.textContent ?? ''));
        return { skillsTop: Math.round(skills.getBoundingClientRect().top * 10) / 10,
          greenBottom: Math.round(Math.max(-9999, ...greens.map(r => r.bottom)) * 10) / 10, invitation, staged: skills.dataset.staged };
      })()`);
      check('Skills landing, linear', 'Skills under the navbar, no green above it, no invitation over its text', landing,
        landing.staged !== 'true' && landing.skillsTop <= 0 && landing.greenBottom <= 0 && !landing.invitation);
      check('no page errors', 'none', errors, errors.length === 0);
      return;
    }

    if (mode === 'form') {
      // Round 37: a blank send's field errors, and a failed send's notice, grew Contact and were
      // revealed; the rebuild that growth owed then restored the place from before it, and put
      // Name back under the navbar and the notice below the window. Each is shown after it.
      const view = `(() => { const bar = document.querySelector('nav').getBoundingClientRect().bottom;
        const box = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
        const label = box(document.querySelector('label[for="name"]')), name = box(document.getElementById('name'));
        const alerts = [...document.querySelectorAll('#contact [role="alert"]')];
        return { bar: Math.round(bar), active: document.activeElement?.id || document.activeElement?.tagName, label, name,
          alerts: alerts.length, last: alerts.length ? box(alerts[alerts.length - 1]) : null };
      })()`;
      type View = { bar: number; active: string; label: { top: number }; name: { bottom: number }; alerts: number;
        last: { top: number; bottom: number } | null };
      await nav('contact');
      await delay(3500);
      // The reader's own wheel, to where Send is in reach and Name has gone up under the bar.
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width / 2, y: height / 2, deltaX: 0, deltaY: 300 });
      await delay(2500);
      const submit = await evaluate<{ x: number; y: number; bottom: number }>(`(() => {
        const r = document.querySelector('#contact form button[type="submit"]').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom }; })()`);
      if (submit.bottom > height) throw new Error(`Send is out of reach at ${width}x${height}: ${JSON.stringify(submit)}`);
      await mouse('mouseMoved', submit.x, submit.y);
      await delay(200);
      await press(submit.x, submit.y);
      await release(submit.x, submit.y);
      await delay(2500);
      const blank = await evaluate<View>(view);
      check('blank send', 'three field errors; Name focused, whole, its label clear of the navbar', blank,
        blank.alerts === 3 && blank.active === 'name' && blank.label.top >= blank.bar && blank.name.bottom <= height);

      // Never a real message: every request that would leave the page's origin fails here, whatever
      // the build's configuration or the service's endpoint, and is counted. The CSP lets only the
      // email service out, so a configured send makes exactly one attempt on it, and an unconfigured
      // one none. A JSON send is preflighted: the attempt failed is the preflight, so the draft's POST
      // is never even made (round 38, TECH-089).
      const pageOrigin = new URL(origin).origin;
      const blocked: string[] = [];
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const stopFailing = cdp.on('Fetch.requestPaused', (params, session) => {
        if (session !== sessionId) return;
        const { requestId, request } = params as unknown as { requestId: string; request: { url: string; method: string } };
        const url = new URL(request.url);
        if (/^https?:$/.test(url.protocol) && url.origin !== pageOrigin) {
          blocked.push(`${request.method} ${url.origin}${url.pathname}`);
          void send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
        } else void send('Fetch.continueRequest', { requestId });
      });
      try {
        for (const [id, text] of [['name', 'Ada'], ['email', 'ada@example.com'], ['message', 'From the native check']]) {
          await evaluate(`document.getElementById('${id}').focus({ preventScroll: true })`);
          await send('Input.insertText', { text });
        }
        await evaluate(`document.getElementById('name').focus({ preventScroll: true })`);
        for (const type of ['keyDown', 'keyUp']) {
          await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) });
        }
        await delay(3000);
      } finally {
        stopFailing();
        await send('Fetch.disable');
      }
      const failed = await evaluate<View>(view);
      check('failed send', 'its notice and draft link whole, clear of the navbar', failed,
        failed.alerts === 1 && !!failed.last && failed.last.top >= failed.bar && failed.last.bottom <= height);
      const configured = !/unavailable/.test(await evaluate<string>(`document.querySelector('#contact form [role="alert"]')?.textContent ?? ''`));
      check('nothing sent', configured ? 'one attempt on the email service, failed here' : 'no request: the build has no email service',
        { configured, blocked }, blocked.length === (configured ? 1 : 0) &&
          blocked.every(request => /^(OPTIONS|POST) https:\/\/api\.emailjs\.com\/api\/v1\.0\/email\/send$/.test(request)));
      // The failed send says so in the console, by design; nothing else may.
      const unexpected = errors.filter(error => !error.startsWith('Contact submission failed'));
      check('no page errors', 'none', unexpected, unexpected.length === 0);
      return;
    }

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
    // Reduced motion reads the story as a linear page: its landings are checked once (round 35).
    await journeys(cdp, origin, themes[0], outcomes, 'reduced').catch(error => { failures.push(error); });
    // The form's feedback, in the compact window where it has to be brought into view (round 37).
    await journeys(cdp, origin, themes[0], outcomes, 'form').catch(error => { failures.push(error); });
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

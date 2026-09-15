import gsap from 'gsap';
import { SKILL_CHAPTERS, SKILLS_REVEAL_SECONDS, SKILLS_TRANSITION_SECONDS, type SkillChapter } from './skillsData';
import { getMaterialGeometry } from './skillGeometry';
import { revealSkillTypography, withdrawSkillTypography } from './skillTextMotion';
import { createMaterialCanvas } from './materialCanvas';

function required<T extends Element>(parent: Element, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Skills is missing its ${selector} animation surface.`);
  return element;
}

function revealDetails(detail: Element): gsap.core.Timeline {
  const economy = detail.closest('[data-material-quality]')?.getAttribute('data-material-quality') === 'economy';
  const pieceFrom: gsap.TweenVars = economy ? { opacity: 0 } : {
    opacity: 0, y: 24, x: index => index % 2 ? 24 : -24, scale: 0.86, svgOrigin: '360 280',
  };
  const pieceTo: gsap.TweenVars = economy
    ? { opacity: 1, duration: 0.8, stagger: 0.09, ease: 'power3.out' }
    : { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.8, stagger: 0.09, ease: 'power3.out' };
  const timeline = gsap.timeline({ defaults: { immediateRender: false } })
    .fromTo(detail.querySelectorAll('[data-material-piece]'), pieceFrom, pieceTo, 0.18);
  const traces = detail.querySelectorAll('[data-material-trace]');
  if (traces.length) timeline.fromTo(traces, { strokeDashoffset: 1 }, {
    strokeDashoffset: 0, duration: 0.75, stagger: 0.05, ease: 'power2.inOut',
  }, 0.48);
  const nodes = detail.querySelectorAll('[data-material-node]');
  if (nodes.length) {
    const from: gsap.TweenVars = economy ? { opacity: 0 } : {
      opacity: 0, scale: 0.55,
      svgOrigin: (_index: number, node: Element) => node.getAttribute('data-material-origin') ?? '360 280',
    };
    const to: gsap.TweenVars = economy
      ? { opacity: 1, duration: 0.6, stagger: 0.045, ease: 'power2.out' }
      : { opacity: 1, scale: 1, duration: 0.6, stagger: 0.045, ease: 'back.out(1.25)' };
    timeline.fromTo(nodes, from, to, 0.36);
  }
  return timeline;
}

function withdrawDetails(detail: Element, direction: number): gsap.core.Timeline {
  const economy = detail.closest('[data-material-quality]')?.getAttribute('data-material-quality') === 'economy';
  return gsap.timeline().to(detail.querySelectorAll('[data-material-piece]'), {
    ...(economy ? {} : { x: direction * 24, y: 8, scale: 0.76 }),
    opacity: 0,
    duration: 0.37, stagger: 0.025, ease: 'power2.in',
  }).to(detail, { opacity: 0, duration: 0.12 }, 0.35);
}

export function createSkillsTimeline(stage: HTMLElement) {
  const chapters = [...stage.querySelectorAll<HTMLElement>('[data-skill-chapter]')];
  if (chapters.length !== SKILL_CHAPTERS.length) throw new Error('The Skills chapter set is incomplete.');
  const rig = required<HTMLElement>(stage, '[data-skill-rig]');
  const object = required<HTMLElement>(rig, '[data-skill-object]');
  const sculpture = required<HTMLElement | SVGSVGElement>(rig, '[data-skill-sculpture]');
  const quality = sculpture.dataset.materialQuality === 'economy' ? 'economy' : 'full';
  const canvas = sculpture.querySelector<HTMLCanvasElement>('[data-material-canvas]');
  const painter = canvas ? createMaterialCanvas(canvas, sculpture, quality) : null;
  const floor = required<SVGGElement>(rig, '[data-material-floor]');
  const foreground = required<SVGGElement>(rig, '[data-material-foreground]');
  const body = required<HTMLElement | SVGGElement>(rig, '[data-material-body]');
  const shell = required<SVGPathElement>(rig, '[data-material-shell]');
  const panel = required<SVGPathElement>(rig, '[data-material-panel]');
  const deep = required<SVGGElement>(rig, '[data-material-deep]');
  const middle = required<SVGGElement>(rig, '[data-material-middle]');
  const well = required<SVGUseElement>(rig, '[data-material-well]');
  const surfaces = required<SVGGElement>(rig, '[data-material-surfaces]');
  const signals = [...rig.querySelectorAll<SVGPathElement>('[data-material-signal]')];
  const details = SKILL_CHAPTERS.map(chapter =>
    required<SVGGElement>(rig, `[data-material-detail="${chapter.scene}"]`));
  const captions = SKILL_CHAPTERS.map((_, index) =>
    required<HTMLElement>(rig, `[data-material-caption="${index}"]`));
  const first = SKILL_CHAPTERS[0];

  gsap.set(chapters, { autoAlpha: 0 });
  gsap.set(details, { opacity: 0 });
  gsap.set(captions, { opacity: 0 });
  gsap.set(rig, { xPercent: first.camera.x, yPercent: first.camera.y });
  gsap.set(object, { scale: first.camera.scale, rotation: first.camera.roll });

  const opening = gsap.timeline()
    .set(details[0], { opacity: 1 }, 0)
    .fromTo(floor, { opacity: 0, scale: 0.88, y: 18 }, {
      opacity: 1, scale: 1, y: 0, duration: 1.2, svgOrigin: '360 480', ease: 'power3.out',
    }, 0)
    .fromTo(body, { opacity: 0, y: 42, scale: 0.84 }, {
      opacity: 1, y: 0, scale: 1, duration: 1.2,
      ...(canvas ? { transformOrigin: '50% 50%' } : { svgOrigin: '360 280' }),
      ease: 'power4.out',
    }, 0.08)
    .fromTo(foreground, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 1 }, 0.18)
    .add(revealSkillTypography(chapters[0], first.textMotion, first.inlineMotion), 0.12)
    .add(revealDetails(details[0]), 0.16)
    .fromTo(captions[0], { opacity: 0, y: 8 }, {
      opacity: 1, y: 0, duration: 0.45, ease: 'power3.out',
    }, 0.95)
    .duration(SKILLS_REVEAL_SECONDS);

  const timeline = gsap.timeline({ paused: true })
    .fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.45 })
    .fromTo(stage.querySelectorAll('[data-skill-chrome]'), { opacity: 0, y: 6 }, {
      opacity: 1, y: 0, duration: 0.45, stagger: 0.07,
    }, 0.12)
    .set(chapters[0], { autoAlpha: 1 }, 0)
    .add(opening, 0.16);
  const stops = [timeline.duration()];

  function reconfigureMaterial(next: SkillChapter, previous: SkillChapter): gsap.core.Timeline {
    const geometry = getMaterialGeometry(next.scene, quality);
    const direction = Math.sign(next.camera.x - previous.camera.x);
    const movement = gsap.timeline()
      .to(rig, {
        xPercent: next.camera.x, yPercent: next.camera.y,
        duration: 1.8, ease: 'sine.inOut',
      }, 0.05)
      .to(object, {
        scale: Math.max(previous.camera.scale, next.camera.scale) * 1.1,
        rotation: direction * 3, duration: 0.88, ease: 'power2.inOut',
      }, 0)
      .to(object, {
        scale: next.camera.scale, rotation: next.camera.roll,
        duration: 0.92, ease: 'power3.out',
      }, 0.88)
      .to(foreground, { opacity: geometry.surfaceOpacity, duration: 1.5, ease: 'sine.inOut' }, 0.1)
      // Near construction lines lead the object; the ground trails it.
      .to(floor, { x: -direction * 75, scale: quality === 'economy' ? 1 : 0.94, duration: 0.85, ease: 'power2.inOut' }, 0)
      .to(floor, { x: 0, scale: 1, duration: 1.15, ease: 'power3.out' }, 0.85)
      .to(foreground, {
        x: () => document.documentElement.dataset.quality === 'low' ? 0 : direction * 65,
        y: () => document.documentElement.dataset.quality === 'low' ? 0 : -18,
        duration: 0.8, ease: 'power2.inOut',
      }, 0.1)
      .to(foreground, { x: 0, y: 0, duration: 1.1, ease: 'power3.out' }, 0.9);
    if (painter) {
      movement.fromTo(painter.transition(previous.scene, next.scene), { progress: 0 }, {
        progress: 1, duration: 1.85, ease: 'sine.inOut', immediateRender: false,
      }, 0);
    } else {
      movement
        .to(shell, { attr: { d: geometry.shell }, duration: 1.85, ease: 'sine.inOut' }, 0)
        .to(panel, { attr: { d: geometry.panel }, duration: 1.85, ease: 'sine.inOut' }, 0)
        .to(deep, { y: geometry.depth, duration: 1.75, ease: 'sine.inOut' }, 0.08)
        .to(middle, { y: geometry.depth / 2, duration: 1.75, ease: 'sine.inOut' }, 0.08)
        .to(well, { opacity: geometry.panelOpacity, duration: 1.75 }, 0.08);
      movement.to(surfaces, { opacity: geometry.surfaceOpacity, duration: 1.5, ease: 'sine.inOut' }, 0.1);
      signals.forEach((signal, index) => {
        movement.to(signal, {
          attr: { d: geometry.signals[index].d }, opacity: geometry.signals[index].opacity,
          duration: 1.75, ease: 'sine.inOut',
        }, 0.05);
      });
    }
    return movement;
  }

  for (let index = 1; index < chapters.length; index++) {
    const next = SKILL_CHAPTERS[index];
    const previous = SKILL_CHAPTERS[index - 1];
    const direction = Math.sign(next.camera.x - previous.camera.x);
    const crossing = gsap.timeline()
      .add(withdrawSkillTypography(chapters[index - 1], previous.textMotion), 0)
      .add(withdrawDetails(details[index - 1], direction), 0)
      .add(reconfigureMaterial(next, previous), 0)
      .to(chapters[index - 1], { autoAlpha: 0, duration: 0.1 }, 0.42)
      .set(chapters[index], { autoAlpha: 1 }, 0.82)
      .set(details[index], { opacity: 1 }, 0.65)
      .add(revealSkillTypography(chapters[index], next.textMotion, next.inlineMotion).duration(1), 0.88)
      .add(revealDetails(details[index]), 0.65)
      .to(captions[index - 1], { opacity: 0, y: -8, duration: 0.25 }, 0.05)
      .fromTo(captions[index], { opacity: 0, y: 8 }, {
        opacity: 1, y: 0, duration: 0.45, ease: 'power3.out',
      }, 1.15)
      .duration(SKILLS_TRANSITION_SECONDS);
    timeline.add(crossing);
    stops.push(timeline.duration());
  }
  return { timeline, stops, dispose: () => painter?.dispose() };
}

// Round 28 (TECH-079/080): a held resize settle or in-place reveal is retired by the reader's newer intent.
// Adapted from the round-28 reviewer's counterexamples.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useResizeAnchor } from '@/lib/scroll/resizeAnchor';
import { ownScroll, resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { installLayerFocus, requestReveal } from '@/lib/scroll/layerFocus';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';

function Probe() { useResizeAnchor(true); return null; }
afterEach(() => { cleanup(); resetScrollGesture(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));

function resize() {
  resetScrollGesture(); let y = 10970.4;
  let geometry: Record<string, [number, number]> = { home:[0,900],about:[900,5580],skills:[6480,4320],projects:[10800,1551],contact:[12891,900] };
  let frames: FrameRequestCallback[] = [];
  vi.stubGlobal('innerWidth',1440); vi.stubGlobal('innerHeight',900);
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(window,'scrollBy').mockImplementation(((options:ScrollToOptions)=>{y+=options.top??0}) as typeof window.scrollBy);
  const root=document.documentElement;
  Object.defineProperty(document,'scrollingElement',{configurable:true,get:()=>root});
  vi.spyOn(root,'clientWidth','get').mockReturnValue(1440);
  vi.spyOn(root,'clientHeight','get').mockReturnValue(900);
  vi.spyOn(root,'scrollHeight','get').mockReturnValue(20000);
  vi.spyOn(root,'scrollTop','get').mockImplementation(()=>y);
  for(const id of Object.keys(geometry)){
    const section=document.body.appendChild(document.createElement('section'));section.id=id;
    section.getBoundingClientRect=()=>DOMRect.fromRect({y:geometry[id][0]-y,width:innerWidth,height:geometry[id][1]});
  }
  const mounted=render(<Probe/>); subscribeScrollGesture(()=>{});
  root.dispatchEvent(new PointerEvent('pointerdown',{button:0,buttons:1,bubbles:true,clientX:1444,clientY:450}));
  geometry={home:[0,560],about:[560,3472],skills:[4032,2688],projects:[6720,1938],contact:[9258,733]};
  vi.stubGlobal('innerWidth',900);vi.stubGlobal('innerHeight',560);
  act(()=>window.dispatchEvent(new Event('resize')));
  act(()=>{const due=frames;frames=[];due.forEach(cb=>cb(performance.now()))});
  return {mounted, read:()=>y, move:(next:number)=>{y=next}};
}

it('REQ: newer wheel intent invalidates an already-held resize anchor',()=>{
  const p=resize();
  act(()=>window.dispatchEvent(new WheelEvent('wheel',{deltaY:120})));
  p.move(9000); act(release);
  expect(p.read()).toBe(9000);
});
it('REQ: unmount retires a held resize anchor instead of restoring after disposal',()=>{
  const p=resize(); p.mounted.unmount(); p.move(9000); act(release);
  expect(p.read()).toBe(9000);
});
it('CONTROL: later explicit absolute navigation wins over the older resize key',()=>{
  const p=resize();
  act(()=>publishSectionNavigation('contact'));
  ownScroll(()=>p.move(9000),{key:window}); act(release);
  expect(p.read()).toBe(9000);
});

function focus() {
  resetScrollGesture();
  document.body.innerHTML='<div id="track"><main><section id="contact"><button id="feedback">Feedback</button></section></main></div>';
  const track=document.getElementById('track')!, main=track.querySelector('main')!, section=main.firstElementChild!, field=document.getElementById('feedback')!;
  Object.defineProperties(track,{clientWidth:{value:500},clientLeft:{value:0},clientHeight:{value:500},scrollHeight:{value:5000}});
  Object.defineProperty(main,'scrollHeight',{value:5000});
  track.getBoundingClientRect=()=>DOMRect.fromRect({width:508,height:500});
  section.getBoundingClientRect=()=>DOMRect.fromRect({y:-track.scrollTop,width:500,height:1500});
  field.getBoundingClientRect=()=>DOMRect.fromRect({y:650-track.scrollTop,width:120,height:36});
  const stop=installLayerFocus({track,main:()=>main,navigate:()=>{}});
  subscribeScrollGesture(()=>{});
  track.dispatchEvent(new PointerEvent('pointerdown',{button:0,buttons:1,bubbles:true,clientX:504,clientY:10}));
  requestReveal(field); expect(track.scrollTop).toBe(0);
  return {track,stop};
}
it('REQ: a feedback reveal queued while visible cannot pull the reader back after newer input',()=>{
  const {track,stop}=focus();
  document.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true}));
  track.scrollTop=2000; track.dispatchEvent(new Event('scroll'));
  release(); stop();
  expect(track.scrollTop).toBe(2000);
});
it('CONTROL: a newer absolute write sharing the reveal key replaces the reveal',()=>{
  const {track,stop}=focus();
  ownScroll(()=>{track.scrollTop=2000},{key:track});
  release(); stop(); expect(track.scrollTop).toBe(2000);
});

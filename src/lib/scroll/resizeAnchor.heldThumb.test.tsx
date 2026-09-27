// Round 27 (TECH-077): a resize settle under a held document thumb runs once, measured on release.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useResizeAnchor } from '@/lib/scroll/resizeAnchor';
import { resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';

function Probe() { useResizeAnchor(true); return null; }
afterEach(() => { cleanup(); resetScrollGesture(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });
it('REQ: a two-frame resize restore under a held document thumb applies the drift only once', () => {
  resetScrollGesture();
  let y = 10800 + 0.4 * 1551 - 450;
  let geometry: Record<string, [number, number]> = { home: [0,900],about:[900,5580],skills:[6480,4320],projects:[10800,1551],contact:[12891,900] };
  let frames: FrameRequestCallback[] = [];
  vi.stubGlobal('innerWidth',1440); vi.stubGlobal('innerHeight',900);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(window,'scrollBy').mockImplementation(((options:ScrollToOptions)=>{ y += options.top ?? 0; }) as typeof window.scrollBy);
  const root=document.documentElement;
  Object.defineProperty(document,'scrollingElement',{configurable:true,get:()=>root});
  vi.spyOn(root,'clientWidth','get').mockReturnValue(1440);
  vi.spyOn(root,'clientHeight','get').mockReturnValue(900);
  vi.spyOn(root,'scrollHeight','get').mockReturnValue(20000);
  vi.spyOn(root,'scrollTop','get').mockImplementation(()=>y);
  for(const id of Object.keys(geometry)){
    const section=document.body.appendChild(document.createElement('section'));section.id=id;
    section.getBoundingClientRect=()=>DOMRect.fromRect({x:0,y:geometry[id][0]-y,width:window.innerWidth,height:geometry[id][1]});
  }
  render(<Probe/>);subscribeScrollGesture(()=>{});
  root.dispatchEvent(new PointerEvent('pointerdown',{button:0,buttons:1,bubbles:true,clientX:1444,clientY:450}));
  geometry={home:[0,560],about:[560,3472],skills:[4032,2688],projects:[6720,1938],contact:[9258,733]};
  vi.stubGlobal('innerWidth',900);vi.stubGlobal('innerHeight',560);
  act(()=>window.dispatchEvent(new Event('resize')));
  act(()=>{const due=frames;frames=[];due.forEach(callback=>callback(performance.now()))});
  expect(y).toBeCloseTo(10970.4,3);
  act(()=>window.dispatchEvent(new PointerEvent('pointerup',{button:0})));
  expect(y).toBeCloseTo(7215.2,3);
});

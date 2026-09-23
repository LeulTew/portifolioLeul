import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVModel } from './TVModel';
import { TVScreenMaterial } from '@/lib/tv/tvScreenMaterial';
import { activateTV, getTVState, resetTVState, setTVExposure, setTVProjectPhase } from '@/lib/tv/tvState';

vi.mock('./3d/CRTHousing', () => ({ CRTHousing: () => null }));
vi.mock('./3d/CRTSpeakerCabinet', () => ({ CRTSpeakerCabinet: () => null }));
vi.mock('./3d/TVHardware', () => ({ TVHardware: () => null }));
vi.mock('./3d/TVScreenProjection', () => ({ TVScreenProjection: () => null }));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));

beforeEach(() => {
  resetTVState();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { cleanup(); resetTVState(); vi.restoreAllMocks(); });

interface ScreenElementProps {
  children?: ReactNode;
  object?: TVScreenMaterial;
  attach?: string;
  dispose?: null;
}

function findScreen(node: ReactNode): ReactElement<ScreenElementProps> | undefined {
  if (!isValidElement<ScreenElementProps>(node)) return;
  if (node.type === 'primitive' && node.props.attach === 'material') return node;
  for (const child of Children.toArray(node.props.children)) {
    const found = findScreen(child);
    if (found) return found;
  }
}

describe('physical TV model and isolated display', () => {
  it('retains its owned disposer after Fiber applies the actual primitive props', async () => {
    const { applyProps } = await vi.importActual<typeof import('@react-three/fiber')>('@react-three/fiber');
    const view = renderHook(({ clips }) => TVModel({ clips }), { initialProps: { clips: 2 } });
    const primitive = findScreen(view.result.current);
    if (!primitive?.props.object) throw new Error('Expected the owned TV screen material');
    const { object: material, ...props } = primitive.props;
    const disposed = vi.fn();
    material.addEventListener('dispose', disposed);
    applyProps(material, props);
    expect(material.dispose).toBeTypeOf('function');
    view.rerender({ clips: 1 });
    expect(disposed).toHaveBeenCalledOnce();
    const replacement = findScreen(view.result.current);
    if (!replacement?.props.object) throw new Error('Expected a replacement TV screen material');
    const { object: nextMaterial, ...nextProps } = replacement.props;
    expect(nextMaterial).not.toBe(material);
    const nextDisposed = vi.fn();
    nextMaterial.addEventListener('dispose', nextDisposed);
    applyProps(nextMaterial, nextProps);
    expect(nextMaterial.dispose).toBeTypeOf('function');
    view.unmount();
    expect(disposed).toHaveBeenCalledOnce();
    expect(nextDisposed).toHaveBeenCalledOnce();
  });

  it('starts off without a video element, request or autoplay timer', () => {
    const create = vi.spyOn(document, 'createElement'), interval = vi.spyOn(window, 'setInterval');
    const { container } = render(<TVModel />);
    expect(container.querySelector('mesh[name="tv-display-signal"]')).not.toBeNull();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(0);
    expect(interval).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('does not treat arbitrary cabinet clicks as a channel command', () => {
    const { container } = render(<TVModel />);
    fireEvent.click(container.firstElementChild!);
    expect(getTVState()).toMatchObject({ broadcastOn: false, channel: 0 });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('uses one user-started video and stops its decoder for the Projects display', async () => {
    const create = vi.spyOn(document, 'createElement');
    render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
    act(() => setTVProjectPhase('approaching'));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(getTVState().source).toBe('projects');
    await act(async () => setTVProjectPhase('framed'));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
  });

  it('uses the zero-download test card without a second decoder', async () => {
    const create = vi.spyOn(document, 'createElement');
    render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    act(() => activateTV('next'));
    expect(getTVState().channel).toBe(1);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(create.mock.calls.filter(([name]) => name === 'video')).toHaveLength(1);
  });

  it('stops media in a hidden document and disposes its owned resources on unmount', async () => {
    const { unmount } = render(<TVModel />);
    await act(async () => { setTVExposure(true, 'all'); activateTV('power'); });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(getTVState().exposed).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    unmount();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
  });
});

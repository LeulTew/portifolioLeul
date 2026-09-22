import { createTrackFocusRecovery } from './preserveTrackFocus';

const owners: ReturnType<typeof createTrackFocusRecovery>[] = [];

beforeEach(() => {
  const rect = DOMRect.fromRect({ width: 48, height: 48 });
  vi.spyOn(HTMLElement.prototype, 'getClientRects')
    .mockReturnValue(Object.assign([rect], { item: (index: number) => index === 0 ? rect : null }));
});

afterEach(() => {
  owners.splice(0).forEach(owner => owner.cancel());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function setup() {
  const track = document.createElement('div');
  const input = document.createElement('input');
  const outside = document.createElement('button');
  track.append(input);
  document.body.append(track, outside);
  input.value = 'Retained draft';
  input.focus();
  input.setSelectionRange(3, 7);
  const recovery = createTrackFocusRecovery();
  owners.push(recovery);
  recovery.capture(track);
  const detach = () => { track.remove(); document.body.append(track); };
  return { track, input, outside, recovery, detach };
}

it('restores the same focused input and selection after a real track detach without scrolling', () => {
  const { input, recovery, detach } = setup();
  const focus = vi.spyOn(input, 'focus');
  detach();
  expect(document.activeElement).toBe(document.body);
  expect(recovery.restore()).toBe(true);
  expect(input).toHaveFocus();
  expect(input).toHaveValue('Retained draft');
  expect(input.selectionStart).toBe(3);
  expect(input.selectionEnd).toBe(7);
  expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(recovery.restore()).toBe(false);
});

it('follows newer native focus inside the same track before its rebuild', () => {
  const { track, recovery, detach } = setup();
  const button = document.createElement('button');
  track.append(button);
  button.focus();
  detach();
  expect(recovery.restore()).toBe(true);
  expect(button).toHaveFocus();
});

it('never steals a subsequent navigation focus', () => {
  const { outside, recovery, detach } = setup();
  outside.focus();
  detach();
  expect(recovery.restore()).toBe(false);
  expect(outside).toHaveFocus();
});

it.each(['pointerdown', 'Tab', 'Escape'])('yields to %s without cancelling the input event', kind => {
  const { outside, recovery, detach } = setup();
  const event = kind === 'pointerdown'
    ? new Event('pointerdown', { bubbles: true, cancelable: true })
    : new KeyboardEvent('keydown', { key: kind, bubbles: true, cancelable: true });
  outside.dispatchEvent(event);
  detach();
  expect(event.defaultPrevented).toBe(false);
  expect(recovery.restore()).toBe(false);
});

it.each(['disabled', 'hidden', 'inert', 'removed'])('does not refocus a %s target', state => {
  const { track, input, recovery, detach } = setup();
  detach();
  if (state === 'disabled') input.disabled = true;
  if (state === 'hidden') track.hidden = true;
  if (state === 'inert') track.setAttribute('inert', '');
  if (state === 'removed') input.remove();
  expect(recovery.restore()).toBe(false);
  expect(input).not.toHaveFocus();
});

it('does nothing when focus has already survived the rebuild', () => {
  const { input, recovery } = setup();
  const focus = vi.spyOn(input, 'focus');
  expect(recovery.restore()).toBe(false);
  expect(focus).not.toHaveBeenCalled();
});

const frame = { available: false, time: 0 };
const listeners = new Set<() => void>();

export function getAvatarEchoFrame(): Readonly<typeof frame> {
  return frame;
}

export function publishAvatarEchoFrame(available: boolean, time: number): void {
  if (!Number.isFinite(time)) throw new RangeError('Avatar animation time must be finite.');
  frame.time = time;
  if (frame.available === available) return;
  frame.available = available;
  listeners.forEach(listener => listener());
}

export function subscribeAvatarEcho(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

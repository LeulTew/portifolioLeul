import { createSettledQueue } from './settledQueue';

describe('createSettledQueue', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs at once when no rebuild is owed', () => {
    const run = vi.fn();
    createSettledQueue(() => false).whenSettled(run);
    expect(run).toHaveBeenCalledOnce();
  });

  it('holds work while a rebuild is owed, and releases it outside the frame once none is', () => {
    let owed = true;
    const queue = createSettledQueue(() => owed);
    const order: string[] = [];
    queue.whenSettled(() => order.push('first'));
    queue.flush();
    vi.runAllTimers();
    expect(order).toEqual([]);

    owed = false;
    // Asked while the first still waits: it lands after it, not before.
    queue.whenSettled(() => order.push('second'));
    queue.flush();
    expect(order).toEqual([]);
    vi.runAllTimers();
    expect(order).toEqual(['first', 'second']);
  });

  it('keeps waiting when a newer change owes another rebuild before the release runs', () => {
    let owed = true;
    const queue = createSettledQueue(() => owed);
    const run = vi.fn();
    queue.whenSettled(run);
    owed = false;
    queue.flush();
    owed = true;
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
    owed = false;
    queue.flush();
    vi.runAllTimers();
    expect(run).toHaveBeenCalledOnce();
  });

  it('reads nothing while nothing waits, so a settled page pays no layout read per frame', () => {
    const owed = vi.fn(() => false);
    const queue = createSettledQueue(owed);
    for (let frame = 0; frame < 60; frame++) queue.flush();
    expect(owed).not.toHaveBeenCalled();
  });

  it('drops what waits when cleared', () => {
    let owed = true;
    const queue = createSettledQueue(() => owed);
    const run = vi.fn();
    queue.whenSettled(run);
    owed = false;
    queue.flush();
    queue.clear();
    vi.runAllTimers();
    queue.flush();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
  });
});

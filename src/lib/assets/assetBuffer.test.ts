import { describe, expect, it } from 'vitest';
import { AssetBuffer } from './assetBuffer';

describe('streamed asset byte collection', () => {
  it('uses one exact-length backing buffer when the expected size is right', () => {
    const bytes = new AssetBuffer(5);
    bytes.append(new Uint8Array([1, 2]));
    bytes.append(new Uint8Array([3, 4, 5]));
    const finished = bytes.finish();
    expect(Array.from(new Uint8Array(finished))).toEqual([1, 2, 3, 4, 5]);
    expect(bytes.finish()).toBe(finished);
  });

  it.each([0, 2, 10, Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'preserves every byte when a header estimate is %s', expected => {
      const bytes = new AssetBuffer(expected);
      bytes.append(new Uint8Array([1, 2, 3]));
      bytes.append(new Uint8Array([4, 5]));
      expect(Array.from(new Uint8Array(bytes.finish()))).toEqual([1, 2, 3, 4, 5]);
    },
  );

  it('copies only a streamed view, not unrelated bytes in its backing buffer', () => {
    const bytes = new AssetBuffer(2);
    bytes.append(new Uint8Array([8, 1, 2, 9]).subarray(1, 3));
    expect(Array.from(new Uint8Array(bytes.finish()))).toEqual([1, 2]);
  });

  it('does not allocate an unbounded amount from an untrusted header', () => {
    const bytes = new AssetBuffer(Number.MAX_SAFE_INTEGER);
    bytes.append(new Uint8Array([7]));
    expect(bytes.finish().byteLength).toBe(1);
  });
});

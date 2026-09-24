/** Avoid retaining a chunk list AND a second complete copy of each model. */
export class AssetBuffer {
  private bytes: Uint8Array<ArrayBuffer>;
  private length = 0;

  constructor(expectedBytes: number) {
    // Response headers are estimates, never permission for an unbounded allocation.
    const capacity = Number.isFinite(expectedBytes) ? Math.max(0, Math.min(32 * 1024 * 1024, Math.floor(expectedBytes))) : 0;
    this.bytes = new Uint8Array(capacity);
  }

  append(chunk: Uint8Array): void {
    const required = this.length + chunk.byteLength;
    if (required > this.bytes.byteLength) {
      const grown = new Uint8Array(Math.max(required, this.bytes.byteLength * 2, 4096));
      grown.set(this.bytes.subarray(0, this.length));
      this.bytes = grown;
    }
    this.bytes.set(chunk, this.length);
    this.length = required;
  }

  finish(): ArrayBuffer {
    return this.length === this.bytes.byteLength
      ? this.bytes.buffer
      : this.bytes.buffer.slice(0, this.length);
  }
}

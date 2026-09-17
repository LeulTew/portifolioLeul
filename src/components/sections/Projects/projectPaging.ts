export const PROJECT_WHEEL_STEP_PX = 48;
const MIN_WHEEL_EVENT_PX = 2;

type WheelDelta = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>;

export class ProjectWheelPaging {
  private distance = 0;
  private direction = 0;

  reset(): void {
    this.distance = 0;
    this.direction = 0;
  }

  take(event: WheelDelta, viewportHeight: number): -1 | 0 | 1 {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    if (Math.abs(delta) <= MIN_WHEEL_EVENT_PX) return 0;
    const direction = delta > 0 ? 1 : -1;
    if (direction !== this.direction) this.distance = 0;
    this.direction = direction;
    this.distance += Math.abs(delta);
    if (this.distance < PROJECT_WHEEL_STEP_PX) return 0;
    // One event requests at most one page; a large notch cannot bank more pages.
    this.distance = 0;
    return direction;
  }
}

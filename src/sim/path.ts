import type { Vec } from '../content/types';

/** A polyline the Foglings walk along, measured by distance from its start. */
export class Path {
  readonly points: Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: Vec[]) {
    this.points = points;
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /** Position and heading at a distance along the path (clamped to its ends). */
  at(d: number): { x: number; y: number; angle: number } {
    const dist = Math.max(0, Math.min(this.length, d));
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < dist) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const seg = this.cumulative[i] - this.cumulative[i - 1] || 1;
    const t = (dist - this.cumulative[i - 1]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Shortest distance from a point to the path. */
  distanceTo(p: Vec): number {
    let best = Infinity;
    for (let i = 1; i < this.points.length; i++) {
      best = Math.min(best, segmentDistance(p, this.points[i - 1], this.points[i]));
    }
    return best;
  }
}

export function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Small numeric helpers shared by the engine. No DOM, no side effects.

/** Parse a value to a finite number, or NaN when blank / not numeric. */
export function num(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim();
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export const isNum = (v) => Number.isFinite(num(v));

/** Return the first non-numeric field name among `names` (or null). */
export function firstMissing(obj, names) {
  for (const n of names) if (!isNum(obj?.[n])) return n;
  return null;
}

/** Linear interpolation on sorted [[x, y], ...]; clamps outside the range. */
export function interp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/**
 * Coefficient curve that is linear in log10(area), constant outside the
 * first / last point. This is the shape used by the ASCE 7 GCp charts.
 * points: sorted [[areaSf, coefficient], ...]
 */
export function logCurve(points, area) {
  const A = Math.max(area, 1e-9);
  if (A <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (A >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [a0, c0] = points[i];
    const [a1, c1] = points[i + 1];
    if (A >= a0 && A <= a1) {
      const t = (Math.log10(A) - Math.log10(a0)) / (Math.log10(a1) - Math.log10(a0));
      return c0 + (c1 - c0) * t;
    }
  }
  return last[1];
}

/** Parse "20:-2.0, 100:-0.5" into sorted [[20,-2],[100,-0.5]]; null if invalid. */
export function parseCurve(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const pts = [];
  for (const part of text.split(/[,;\n]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(-?\d+(?:\.\d+)?)\s*[:=]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    pts.push([Number(m[1]), Number(m[2])]);
  }
  if (!pts.length) return null;
  pts.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < pts.length; i++) if (pts[i][0] === pts[i - 1][0]) return null;
  if (pts[0][0] <= 0) return null;
  return pts;
}

export const round = (v, d = 2) => {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Build a pass/fail check row. `demand` and `capacity` are positive magnitudes. */
export function makeCheck(id, label, demand, capacity, unit, note = '') {
  const ratio = capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0;
  return { id, label, demand, capacity, unit, ratio, status: ratio <= 1 ? 'pass' : 'fail', note };
}

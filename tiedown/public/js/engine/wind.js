// Wind engine: velocity pressure, MWFRS wall/roof coefficients, C&C pressures.
// All pressures are ASD level (ultimate x asdFactor) unless a name ends in Ult.

import { interp, logCurve } from './util.js';

/** Kz at height z (ft). Height is floored at 15 ft (ASCE 7-16 Table 26.10-1). */
export function kz(z, exposure, pack) {
  const e = pack.exposure[exposure];
  if (!e) throw new Error(`Unknown exposure ${exposure}`);
  const zz = Math.max(z, 15);
  return pack.kzCoefficient * Math.pow(zz / e.zg, 2 / e.alpha);
}

/** Ground elevation factor Ke (Table 26.9-1), elevation in ft. */
export const ke = (elevationFt) => Math.exp(-0.0000362 * (elevationFt || 0));

/**
 * Velocity pressure at height z.
 * qz = 0.00256 Kz Kzt Kd Ke V^2   (psf, ultimate)
 */
export function velocityPressure({ V, exposure, z, kzt = 1, kd, elevation = 0, pack }) {
  const Kz = kz(z, exposure, pack);
  const Ke = ke(elevation);
  const Kd = kd ?? pack.kdBuilding;
  const qUlt = 0.00256 * Kz * kzt * Kd * Ke * V * V;
  return { Kz, Ke, Kd, Kzt: kzt, qUlt, qAsd: qUlt * pack.asdFactor };
}

export const gcpiMagnitude = (enclosure, pack) => pack.gcpi[enclosure] ?? pack.gcpi.partial;

/** Leeward wall Cp from L/B (ASCE 7-16 Fig. 27.3-1). */
export const leewardWallCp = (LB, pack) => interp(pack.leewardWallCp, LB);

/** Roof zone width parameter "a" (ft) for C&C (Fig. 30.3-1 notes). */
export function zoneWidthA(leastHorizontalDim, h) {
  return Math.max(Math.min(0.1 * leastHorizontalDim, 0.4 * h), 0.04 * leastHorizontalDim, 3);
}

/**
 * MWFRS roof Cp (suction, negative) at distance x from the windward roof edge.
 * theta < 10 deg uses the flat-roof table (interpolated on h/L between 0.5 and 1.0).
 * theta >= 10 deg uses the same table with a floor so suction is never
 * smaller than pack.roofSlopedFloor (conservative envelope).
 */
export function roofCpSuction(x, h, hOverL, thetaDeg, pack) {
  const lookup = (rows, xh) => {
    for (const [upper, cp] of rows) if (xh <= upper) return cp;
    return rows[rows.length - 1][1];
  };
  const xh = x / h;
  const lo = lookup(pack.roofCpFlat.low, xh);
  const hi = lookup(pack.roofCpFlat.high, xh);
  let cp;
  if (hOverL <= 0.5) cp = lo;
  else if (hOverL >= 1.0) cp = hi;
  else cp = lo + ((hi - lo) * (hOverL - 0.5)) / 0.5;
  if (thetaDeg >= 10) cp = Math.min(cp, pack.roofSlopedFloor);
  return cp;
}

/**
 * Components & cladding pressure for one zone at an effective wind area.
 * Returns ASD pressures (psf) with the minimum-pressure rule applied.
 *   pos: pressure toward the surface (positive)
 *   neg: pressure away from the surface (negative)
 */
export function ccPressure({ qAsd, zone, area, gcpi, pack }) {
  const gcpPos = logCurve(zone.pos, area);
  const gcpNeg = logCurve(zone.neg, area);
  const minAsd = pack.minCC * pack.asdFactor;
  let pos = qAsd * (gcpPos + gcpi);
  let neg = qAsd * (gcpNeg - gcpi);
  const posMin = pos < minAsd;
  const negMin = neg > -minAsd;
  if (posMin) pos = minAsd;
  if (negMin) neg = -minAsd;
  return { gcpPos, gcpNeg, pos, neg, posMin, negMin };
}

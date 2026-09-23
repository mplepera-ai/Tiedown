// Fence: wind force on a solid freestanding wall (ASCE 7 Ch. 29 style) and
// post embedment by the IBC 1807.3.2.1 non-constrained pole formula.
//
//   d = 0.5 A { 1 + [1 + 4.36 h / A]^(1/2) },   A = 2.34 P / (S1 b)
//   S1 = allowable lateral bearing at depth d/3 (psf)

import { num, isNum, firstMissing, interp, makeCheck } from './util.js';
import { resolveBasis } from './basis.js';
import { velocityPressure } from './wind.js';

export const FENCE_REQUIRED = ['height', 'runLength', 'postSpacing', 'holeSize', 'embedDepth', 'lateralBearing', 'postSx', 'postFb'];

/** IBC 1807.3.2.1 required embedment (ft) for P (lb) at h (ft) above grade. Returns NaN if no solution. */
export function poleEmbedment({ P, hArm, b, lateralPsfPerFt, factor = 1 }) {
  if (!(P > 0)) return 0;
  const f = (d) => {
    const S1 = lateralPsfPerFt * Math.min(d / 3, 15) * factor;
    const A = (2.34 * P) / (S1 * b);
    return 0.5 * A * (1 + Math.sqrt(1 + (4.36 * hArm) / A));
  };
  let lo = 0.25;
  let hi = 60;
  if (f(hi) - hi > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) - mid > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function analyzeFence(project) {
  const fence = project.fence || {};
  const basis = resolveBasis(project.code);
  const warnings = [...basis.warnings];
  const missing = firstMissing(fence, FENCE_REQUIRED);
  if (missing) return { ok: false, reason: `Enter "${missing}" to run the fence calculations.`, warnings };
  if (!Number.isFinite(basis.V)) return { ok: false, reason: 'Enter a design wind speed (Project & Code page).', warnings };

  const pack = basis.pack;
  const h = num(fence.height);
  const B = num(fence.runLength);
  const S = num(fence.postSpacing);
  const solidity = isNum(fence.solidity) ? num(fence.solidity) : 1;
  const holeIn = num(fence.holeSize);
  const dProv = num(fence.embedDepth);
  const lateral = num(fence.lateralBearing);
  const Sx = num(fence.postSx);
  const Fb = num(fence.postFb);
  const CD = isNum(fence.loadDuration) ? num(fence.loadDuration) : 1.6;
  const factor = fence.isolatedPole ? 2 : 1;
  const holeShape = fence.holeShape || 'round';
  const bFt = (holeShape === 'square' ? holeIn * Math.SQRT2 : holeIn) / 12;

  if (h <= 0 || B <= 0 || S <= 0 || holeIn <= 0) return { ok: false, reason: 'Height, run length, post spacing and hole size must be greater than zero.', warnings };
  if (h > 8) warnings.push('Fence heights over 8 ft are outside typical residential fence provisions; confirm applicability.');
  if (num(fence.gap) > 0) warnings.push('A gap below the fence changes the clearance ratio s/h; this tool assumes no gap (s/h = 1).');

  const vp = velocityPressure({ V: basis.V, exposure: basis.exposure, z: h, kzt: basis.kzt, elevation: basis.elevation, pack });
  const G = pack.gust;

  // force coefficient
  const Bs = B / h;
  let Cf = interp(pack.fenceCf, Bs);
  let reduction = 1;
  let cfSource = 'Table Cf (s/h = 1) x porosity reduction';
  if (solidity < 1) {
    if (solidity >= 0.7) reduction = 1 - Math.pow(1 - solidity, 1.5);
    else warnings.push('Solid area below 70%: the solid-wall Cf is used without reduction (conservative). Use the open sign / lattice provisions or enter a net Cf override.');
  }
  let cfNet = Cf * reduction;
  if (isNum(fence.cfOverride)) {
    cfNet = num(fence.cfOverride);
    cfSource = 'User override (net force coefficient on gross area)';
  }

  const wCalc = vp.qAsd * G * cfNet * h; // plf
  const wMin = pack.fenceMinPsf * pack.asdFactor * h;
  const minGoverns = wMin > wCalc;
  const w = Math.max(wCalc, wMin);
  const P = w * S;
  const hArm = h / 2;
  const M = P * hArm;
  const Mall = (Fb * CD * Sx) / 12;

  const dReq = poleEmbedment({ P, hArm, b: bFt, lateralPsfPerFt: lateral, factor });
  const checks = [];
  checks.push(makeCheck('post-bending', 'Post bending at grade', M, Mall, 'lb-ft', `Fb ${Fb} psi x CD ${CD} x Sx ${Sx} in^3`));
  checks.push(makeCheck('embed', 'Post embedment depth', Number.isFinite(dReq) ? dReq : 99, dProv, 'ft', 'IBC 1807.3.2.1 non-constrained pole formula'));

  const sMaxBending = Mall / (w * hArm);
  const table = [4, 5, 6, 8, 10, 12].map((sp) => {
    const Pi = w * sp;
    return { spacing: sp, P: Pi, M: Pi * hArm, dReq: poleEmbedment({ P: Pi, hArm, b: bFt, lateralPsfPerFt: lateral, factor }), bendingOk: Pi * hArm <= Mall };
  });

  if (fence.isolatedPole) warnings.push('Isolated-pole doubling of lateral bearing applied: confirm posts are not adversely affected by 1/2 in. of movement at grade.');

  return {
    ok: true,
    basis,
    warnings,
    wind: { ...vp, G },
    force: { h, Bs, Cf, reduction, cfNet, cfSource, wCalc, wMin, minGoverns, w, P, hArm, M, Mall },
    embed: { dReq, dProv, bFt, factor, lateral },
    limits: { sMaxBending },
    table,
    checks,
  };
}

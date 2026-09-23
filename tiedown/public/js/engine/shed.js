// Shed / small enclosed building: MWFRS lateral + uplift, overturning, sliding,
// bearing, connection demands and C&C pressures.
//
// Method summary (ASD, ASCE 7 load combinations 0.6D + 0.6W and D + 0.6W):
//  * Velocity pressure at mean roof height, ASD factor 0.6 applied to wind.
//  * Lateral: windward 0.8 + leeward Cp(L/B) applied to the projected area of
//    walls AND roof (conservative: roof treated like wall), with the MWFRS
//    minimum (16 / 8 psf ultimate) checked as a separate case.
//  * Uplift: flat-roof Cp strips (envelope floor for slopes >= 10 deg) plus
//    internal pressure, plus windward overhang underside pressure.
//  * Overturning about the leeward toe using strip-by-strip uplift moments.

import { num, isNum, firstMissing, logCurve, parseCurve, makeCheck } from './util.js';
import { resolveBasis } from './basis.js';
import { velocityPressure, gcpiMagnitude, leewardWallCp, roofCpSuction, ccPressure, zoneWidthA } from './wind.js';

const CONCRETE_PCF = 150;
const RAD = Math.PI / 180;

export const SHED_REQUIRED = ['width', 'length', 'eaveHeight', 'rise', 'overhang', 'roofDL', 'wallDL'];

/** Roof C&C zone table for the current geometry: built-in figure or user curves. */
export function roofZonesFor(shed, thetaDeg, pack) {
  const g = pack.roofGable7to20;
  if (shed.roofType === 'gable' && thetaDeg > g.minSlopeDeg && thetaDeg <= g.maxSlopeDeg) {
    return { source: `${pack.label} ${g.figure} (gable, ${g.minSlopeDeg}-${g.maxSlopeDeg} deg)`, status: pack.statuses.roofGable7to20, zones: g.zones, builtIn: true };
  }
  const zones = {};
  for (const z of shed.customZones || []) {
    const pos = parseCurve(z?.pos);
    const neg = parseCurve(z?.neg);
    if (z?.name && pos && neg) zones[z.name] = { label: `Custom zone ${z.name}`, pos, neg };
  }
  if (Object.keys(zones).length) return { source: 'User-entered GCp curves (from the adopted standard)', status: 'unverified', zones, builtIn: false };
  return null;
}

export function analyzeShed(project) {
  const shed = project.shed || {};
  const basis = resolveBasis(project.code);
  const missing = firstMissing(shed, SHED_REQUIRED);
  const warnings = [...basis.warnings];
  if (missing) return { ok: false, reason: `Enter "${missing}" to run the shed calculations.`, warnings };
  if (!Number.isFinite(basis.V)) return { ok: false, reason: 'Enter a design wind speed (Project & Code page).', warnings };

  const pack = basis.pack;
  const W = num(shed.width);
  const Lr = num(shed.length);
  const he = num(shed.eaveHeight);
  const rise = num(shed.rise);
  const o = num(shed.overhang);
  const roofDL = num(shed.roofDL);
  const wallDL = num(shed.wallDL);
  const roofLL = isNum(shed.roofLL) ? num(shed.roofLL) : 20;
  const roofType = shed.roofType || 'gable';

  if (W <= 0 || Lr <= 0 || he <= 0) return { ok: false, reason: 'Width, length and eave height must be greater than zero.', warnings };

  // ---- geometry ----------------------------------------------------------
  const thetaRad = roofType === 'flat' ? 0 : Math.atan(rise / 12);
  const theta = thetaRad / RAD;
  const rideRise = roofType === 'gable' ? (W / 2) * Math.tan(thetaRad) : roofType === 'mono' ? W * Math.tan(thetaRad) : 0;
  const hr = he + rideRise;
  const h = theta <= 10 ? he : (he + hr) / 2;
  const Wp = W + 2 * o;
  const Lp = Lr + 2 * o;
  const wallArea = 2 * (W + Lr) * he + W * rideRise;
  if (theta > 45) warnings.push('Roof slope above 45 degrees is outside the supported range.');
  if (h > 60) warnings.push('Mean roof height above 60 ft is outside the low-rise method.');
  if (roofType !== 'flat' && theta < 10 && theta > 0) warnings.push('Roof slope below 10 degrees: flat-roof MWFRS coefficients used.');

  // ---- velocity pressure -----------------------------------------------
  const vp = velocityPressure({ V: basis.V, exposure: basis.exposure, z: h, kzt: basis.kzt, elevation: basis.elevation, pack });
  const gcpi = gcpiMagnitude(basis.enclosure, pack);
  const G = pack.gust;
  const qA = vp.qAsd;

  // ---- dead loads -------------------------------------------------------
  const Droof = roofDL * Wp * Lp;
  const Dwalls = wallDL * wallArea;

  // ---- foundation weight -----------------------------------------------
  const fnd = shed.foundation || {};
  const fType = fnd.type || 'slab';
  const footprint = W * Lr;
  let Wf = 0;
  let foundationNotes = [];
  let foundationMissing = null;
  if (fType === 'slab') {
    foundationMissing = firstMissing(fnd, ['slabThk', 'edgeWidth', 'edgeDepth']);
    if (!foundationMissing) {
      const t = num(fnd.slabThk) / 12;
      const ew = num(fnd.edgeWidth) / 12;
      const ed = num(fnd.edgeDepth) / 12;
      const slabWt = CONCRETE_PCF * t * footprint;
      const perim = 2 * (W + Lr);
      const edgeWt = ed > t ? CONCRETE_PCF * ew * (ed - t) * perim : 0;
      Wf = slabWt + edgeWt;
      foundationNotes.push(`Slab ${fnd.slabThk} in. with ${fnd.edgeWidth} in. x ${fnd.edgeDepth} in. deep perimeter edge (${CONCRETE_PCF} pcf).`);
    }
  } else {
    foundationMissing = firstMissing(fnd, ['padCount', 'padSize', 'padDepth']);
    if (!foundationMissing) {
      Wf = num(fnd.padCount) * num(fnd.padSize) ** 2 * num(fnd.padDepth) * CONCRETE_PCF;
      foundationNotes.push(`${fnd.padCount} pads, ${fnd.padSize} ft square x ${fnd.padDepth} ft deep (${CONCRETE_PCF} pcf).`);
    }
  }
  const floorDL = fType === 'pads' && isNum(fnd.floorDL) ? num(fnd.floorDL) * footprint : 0;
  const Dsuper = Droof + Dwalls + floorDL;
  const Dtotal = Dsuper + Wf;

  // ---- wind directions --------------------------------------------------
  const dirs = [
    { key: 'normal', name: 'Wind normal to ridge (hits long eave wall)', B: Lr, L: W, wallProj: Lr * he, roofProj: Lr * rideRise, Wd: W, Bd: Lr, planL: Wp, planB: Lp },
    { key: 'parallel', name: 'Wind parallel to ridge (hits gable-end wall)', B: W, L: Lr, wallProj: W * he, roofProj: (W * rideRise) / 2, Wd: Lr, Bd: W, planL: Lp, planB: Wp },
  ];

  const N = 800;
  for (const d of dirs) {
    const hOverL = h / d.L;
    const LB = d.L / d.B;
    const cpLee = leewardWallCp(LB, pack);
    const cn = pack.windwardWallCp + Math.abs(cpLee);
    const FwallCalc = qA * G * cn * d.wallProj;
    const FroofCalc = qA * G * cn * d.roofProj;
    const FwallMin = pack.minMWFRS.wall * pack.asdFactor * d.wallProj;
    const FroofMin = pack.minMWFRS.roof * pack.asdFactor * d.roofProj;
    const useMin = FwallMin + FroofMin > FwallCalc + FroofCalc;
    const Fwall = useMin ? FwallMin : FwallCalc;
    const Froof = useMin ? FroofMin : FroofCalc;
    const zWall = he / 2;
    const zRoof = he + rideRise / 2;
    Object.assign(d, {
      hOverL, LB, cpLee, cn, useMin,
      Fwall, Froof, V: Fwall + Froof, Mlat: Fwall * zWall + Froof * zRoof,
    });

    // uplift strips across the roof plan (measured from windward roof edge)
    const dx = d.planL / N;
    let U = 0;
    let Mup = 0;
    const pivot = o + d.Wd;
    let cpMaxMag = 0;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      const cp = roofCpSuction(x, h, hOverL, theta, pack);
      cpMaxMag = Math.max(cpMaxMag, Math.abs(cp));
      let p = qA * (G * Math.abs(cp) + gcpi);
      if (x < o) p += qA * pack.windwardWallCp; // windward overhang underside
      const f = p * dx * d.planB;
      U += f;
      Mup += f * Math.max(0, pivot - x);
    }
    Object.assign(d, { U, Mup, cpMaxMag, Mot: d.Mlat + Mup });
  }

  const Vgov = Math.max(...dirs.map((d) => d.V));
  const Ugov = Math.max(...dirs.map((d) => d.U));

  // ---- capacities & checks ---------------------------------------------
  const checks = [];
  const outputs = { foundationNotes };
  const mu = num(fnd.friction);
  const Sp = num(fnd.passive);
  const qAllow = num(fnd.bearing);

  const reqWf = Math.max(0, Ugov / pack.asdFactor - Dsuper);
  const tRoofConnTotal = Math.max(0, Ugov - pack.asdFactor * Droof);
  const tFoundTotal = Math.max(0, Ugov - pack.asdFactor * Dsuper);

  if (!foundationMissing) {
    checks.push(makeCheck('uplift', 'Vertical uplift vs. dead weight (0.6D + 0.6W)', Ugov, pack.asdFactor * Dtotal, 'lb', 'Structure + foundation weight resisting net roof uplift'));

    for (const d of dirs) {
      const Mres = pack.asdFactor * Dtotal * (d.Wd / 2);
      d.Mres = Mres;
      checks.push(makeCheck(`ot-${d.key}`, `Overturning - ${d.name}`, d.Mot, Mres, 'lb-ft', 'About leeward toe; 0.6D resisting'));
      d.holdDown = d.Mot > Mres ? (d.Mot - Mres) / d.Wd : 0;

      // sliding
      const Nvert = pack.asdFactor * Dtotal - d.U;
      const friction = isNum(mu) ? mu * Math.max(0, Nvert) : NaN;
      let passive = 0;
      if (fType === 'slab' && isNum(Sp) && isNum(fnd.edgeDepth)) {
        const depthFt = num(fnd.edgeDepth) / 12;
        passive = 0.5 * Sp * depthFt * depthFt * d.Bd;
      }
      d.friction = friction;
      d.passive = passive;
      d.slidingCapacity = isNum(friction) ? friction + passive : NaN;
      if (isNum(friction)) checks.push(makeCheck(`slide-${d.key}`, `Sliding - ${d.name}`, d.V, d.slidingCapacity, 'lb', 'Friction on net weight + passive on thickened edge'));

      // bearing with wind (D + 0.6W)
      if (isNum(qAllow) && fType === 'slab') {
        const A = footprint;
        const N0 = Dtotal;
        const e = d.Mot / N0;
        let qmax;
        if (e <= d.Wd / 6) qmax = (N0 / A) * (1 + (6 * e) / d.Wd);
        else if (e < d.Wd / 2) qmax = (2 * N0) / (3 * d.Bd * (d.Wd / 2 - e));
        else qmax = Infinity;
        d.qmax = qmax;
        d.ecc = e;
        checks.push(makeCheck(`bear-wind-${d.key}`, `Soil bearing D + 0.6W - ${d.name}`, qmax, qAllow, 'psf', 'Uses full weight with full overturning moment (conservative)'));
      }
    }

    if (isNum(qAllow)) {
      if (fType === 'slab') {
        const qgrav = (Dtotal + roofLL * Wp * Lp) / footprint;
        outputs.qgrav = qgrav;
        checks.push(makeCheck('bear-grav', 'Soil bearing D + L (average)', qgrav, qAllow, 'psf', 'Roof live load over roof plan area'));
      } else {
        const nPads = num(fnd.padCount);
        const pad = num(fnd.padSize);
        const perPad = (Dsuper + roofLL * Wp * Lp) / nPads + (Wf / nPads);
        outputs.perPadGravity = perPad;
        checks.push(makeCheck('bear-pad', 'Pad bearing D + L (average per pad)', perPad / (pad * pad), qAllow, 'psf', 'Uniform share of load per pad'));
      }
    }
  }

  // ---- pads: per-point uplift ------------------------------------------
  if (fType === 'pads' && !foundationMissing) {
    const nPts = num(fnd.padCount);
    const demandTotal = Math.max(tFoundTotal, ...dirs.map((d) => d.holdDown || 0));
    const windwardPts = Math.max(1, nPts / 2);
    const perPad = demandTotal / windwardPts;
    const padWeight = num(fnd.padSize) ** 2 * num(fnd.padDepth) * CONCRETE_PCF;
    outputs.padUpliftDemand = perPad;
    outputs.padWeightCap = pack.asdFactor * padWeight;
    checks.push(makeCheck('pad-uplift', 'Uplift per windward pad vs. 0.6 x pad weight', perPad, pack.asdFactor * padWeight, 'lb', 'Assumes half of the pads carry the windward uplift'));
  }

  // ---- anchors -----------------------------------------------------------
  const nAnch = num(shed.anchors?.count);
  const tCap = num(shed.anchors?.tensionCap);
  const sCap = num(shed.anchors?.shearCap);
  outputs.anchors = { nAnch, tCap, sCap };
  if (isNum(tCap) && tFoundTotal > 0) outputs.anchorsRequiredTension = Math.ceil(tFoundTotal / tCap);
  if (isNum(sCap)) outputs.anchorsRequiredShear = Math.ceil(Vgov / sCap);
  if (isNum(nAnch) && nAnch > 0) {
    if (isNum(tCap)) checks.push(makeCheck('anchor-tension', 'Wall-to-foundation anchor tension (each)', tFoundTotal / nAnch, tCap, 'lb', `${nAnch} anchors sharing net uplift`));
    if (isNum(sCap)) checks.push(makeCheck('anchor-shear', 'Wall-to-foundation anchor shear (each)', Vgov / nAnch, sCap, 'lb', `${nAnch} anchors sharing base shear`));
  }

  // ---- C&C and connections ------------------------------------------------
  const roofZ = roofZonesFor(shed, theta, pack);
  const a = zoneWidthA(Math.min(W, Lr), h);
  const cc = { a, roof: null, wall: null, connections: null, roofSource: roofZ };
  const wallA = num(shed.wallEffArea);
  if (isNum(wallA)) {
    cc.wall = Object.entries(pack.wallCC.zones).map(([k, z]) => ({ zone: k, label: z.label, area: wallA, ...ccPressure({ qAsd: qA, zone: z, area: wallA, gcpi, pack }) }));
  }
  const roofA = num(shed.roofEffArea);
  if (roofZ && isNum(roofA)) {
    cc.roof = Object.entries(roofZ.zones).map(([k, z]) => ({ zone: k, label: z.label, area: roofA, ...ccPressure({ qAsd: qA, zone: z, area: roofA, gcpi, pack }) }));
  }
  if (!roofZ) warnings.push('Roof C&C zones: no built-in figure for this roof type/slope (built-in covers gable roofs over 7 and up to 20 degrees). Enter GCp curves from the adopted standard on the Shed page.');

  const spacing = num(shed.framing?.spacing);
  const span = num(shed.framing?.span);
  const clipCap = num(shed.framing?.clipCap);
  if (roofZ && isNum(spacing) && isNum(span)) {
    const aTrib = spacing * (span / 2 + o);
    const aEff = span * Math.max(spacing, span / 3);
    const rows = Object.entries(roofZ.zones).map(([k, z]) => {
      const p = ccPressure({ qAsd: qA, zone: z, area: aEff, gcpi, pack });
      const uplift = Math.max(0, Math.abs(p.neg) * aTrib - pack.asdFactor * roofDL * aTrib);
      return { zone: k, label: z.label, pNeg: p.neg, uplift };
    });
    const worst = rows.reduce((m, r) => (r.uplift > m.uplift ? r : m), rows[0]);
    cc.connections = { aTrib, aEff, rows, worst };
    if (isNum(clipCap)) checks.push(makeCheck('clip', `Roof framing uplift connection (worst zone ${worst.zone})`, worst.uplift, clipCap, 'lb', 'Per connection; tributary area = spacing x (span/2 + overhang)'));
  }

  return {
    ok: true,
    basis,
    warnings,
    geometry: { theta, ridgeHeight: hr, meanHeight: h, planWidth: Wp, planLength: Lp, wallArea, footprint },
    wind: { ...vp, gcpi, G },
    loads: { Droof, Dwalls, floorDL, Dsuper, Wf, Dtotal, roofLL },
    dirs,
    governing: { Vgov, Ugov, reqWf, tRoofConnTotal, tFoundTotal },
    foundation: { type: fType, missing: foundationMissing, notes: foundationNotes },
    outputs,
    cc,
    checks,
  };
}

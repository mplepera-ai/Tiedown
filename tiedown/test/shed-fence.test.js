// Hand-calculated checks for the shed, fence and component modules (invented values).

import test from 'node:test';
import assert from 'node:assert/strict';
import { blankProject, sampleProject, clearIdentifyingData, identifyingFields } from '../public/js/defaults.js';
import { analyzeShed, analyzeFence, analyzeComponents, poleEmbedment, resolveBasis, parseCurve, logCurve } from '../public/js/engine/index.js';

const near = (a, b, relTol, msg) => assert.ok(Math.abs(a - b) <= Math.abs(b) * relTol + 1e-9, `${msg || ''} expected ${b}, got ${a}`);

function flatShed() {
  const p = blankProject();
  p.code.enclosure = 'enclosed';
  Object.assign(p.shed, { roofType: 'flat', width: '10', length: '12', eaveHeight: '8', rise: '0', overhang: '0', roofDL: '5', wallDL: '4' });
  p.shed.foundation = { ...p.shed.foundation, type: 'slab', slabThk: '4', edgeWidth: '12', edgeDepth: '18', bearing: '2000', friction: '0.25', passive: '150' };
  return p;
}

test('resolveBasis: Broward RC II is 170 mph and flags edition screening', () => {
  const b = resolveBasis(blankProject().code);
  assert.equal(b.V, 170);
  assert.equal(b.hvhz, true);
  assert.equal(b.screeningOnly, true);
  const b7 = resolveBasis({ ...blankProject().code, edition: 'fbc7' });
  assert.equal(b7.screeningOnly, false);
  const bo = resolveBasis({ ...blankProject().code, vultOverride: '160' });
  assert.equal(bo.V, 160);
});

test('flat-roof shed uplift and uplift moment match independent integration', () => {
  const r = analyzeShed(flatShed());
  assert.equal(r.ok, true);
  near(r.wind.qAsd, 32.03, 0.001, 'qh ASD');
  const normal = r.dirs.find((d) => d.key === 'normal');
  near(normal.U, 3606.06, 0.002, 'uplift');
  near(normal.Mup, 19859.9, 0.002, 'uplift moment');
});

test('lateral force uses windward 0.8 + leeward Cp on projected area', () => {
  const r = analyzeShed(flatShed());
  const normal = r.dirs.find((d) => d.key === 'normal');
  // L/B = 10/12 -> leeward -0.5 -> Cn 1.3; projected wall area 12 x 8 = 96 sf
  near(normal.V, 32.03 * 0.85 * 1.3 * 96, 0.002, 'V normal');
  assert.equal(normal.useMin, false);
});

test('dead loads and foundation weight', () => {
  const r = analyzeShed(flatShed());
  // roof 5 psf x 10 x 12; walls 4 psf x (2*(10+12)*8)
  near(r.loads.Droof, 600, 1e-9);
  near(r.loads.Dwalls, 4 * 352, 1e-9);
  // slab 120 sf x 4/12 ft x 150 + edge 44 ft x 1 ft x (1.5-0.3333) ft x 150
  near(r.loads.Wf, 120 * (4 / 12) * 150 + 44 * 1 * (1.5 - 4 / 12) * 150, 1e-9);
});

test('required foundation weight satisfies 0.6D >= uplift exactly', () => {
  const r = analyzeShed(flatShed());
  const { Dsuper } = r.loads;
  const need = r.governing.reqWf;
  near(0.6 * (Dsuper + need), r.governing.Ugov, 1e-9);
});

test('missing inputs are reported, not computed', () => {
  const r = analyzeShed(blankProject());
  assert.equal(r.ok, false);
  assert.match(r.reason, /width/);
});

test('gable 4:12 uses built-in roof zones; flat roof needs custom curves', () => {
  const g = analyzeShed(sampleProject());
  assert.ok(g.cc.roofSource.builtIn);
  const f = analyzeShed(flatShed());
  assert.equal(f.cc.roofSource, null);
  const p = flatShed();
  p.shed.customZones[0] = { name: 'A', pos: '10:0.3', neg: '10:-1.0, 100:-0.6' };
  const f2 = analyzeShed(p);
  assert.ok(f2.cc.roofSource && !f2.cc.roofSource.builtIn);
});

test('pole embedment (IBC 1807.3.2.1) matches independent solution', () => {
  near(poleEmbedment({ P: 1000, hArm: 3, b: 1.5, lateralPsfPerFt: 150 }), 6.7977, 0.001);
  near(poleEmbedment({ P: 1000, hArm: 3, b: 1.5, lateralPsfPerFt: 150, factor: 2 }), 5.0664, 0.001);
});

test('fence force: solid, long run -> Cf 1.30; wind force per foot', () => {
  const p = blankProject();
  Object.assign(p.fence, { height: '6', runLength: '60', postSpacing: '8', holeSize: '12', embedDepth: '4', lateralBearing: '150', postSx: '7.15', postFb: '1000' });
  const r = analyzeFence(p);
  assert.equal(r.ok, true);
  near(r.force.Cf, 1.3, 1e-9);
  near(r.force.w, 32.03 * 0.85 * 1.3 * 6, 0.002);
  near(r.force.P, r.force.w * 8, 1e-9);
  near(r.force.M, r.force.P * 3, 1e-9);
  near(r.force.Mall, (1000 * 1.6 * 7.15) / 12, 1e-9);
});

test('fence porosity: 80% solid reduces force; below 70% warns and does not reduce', () => {
  const p = blankProject();
  Object.assign(p.fence, { height: '6', runLength: '60', postSpacing: '8', holeSize: '12', embedDepth: '4', lateralBearing: '150', postSx: '7.15', postFb: '1000', solidity: '0.8' });
  const r = analyzeFence(p);
  near(r.force.reduction, 1 - Math.pow(0.2, 1.5), 1e-9);
  p.fence.solidity = '0.5';
  const r2 = analyzeFence(p);
  assert.equal(r2.force.reduction, 1);
  assert.ok(r2.warnings.some((w) => /below 70%/.test(w)));
});

test('components: pass/fail against ratings', () => {
  const r = analyzeComponents(sampleProject());
  assert.equal(r.ok, true);
  assert.ok(r.checks.length >= 2);
});

test('curve helpers', () => {
  assert.deepEqual(parseCurve('20:-2.0, 100:-0.5'), [[20, -2], [100, -0.5]]);
  assert.equal(parseCurve('bad'), null);
  near(logCurve([[10, -3], [250, -1]], 100), -1.5687, 0.001);
});

test('identifying data helpers', () => {
  const p = sampleProject();
  p.meta.owner = 'x';
  assert.deepEqual(identifyingFields(p), ['name', 'owner']);
  clearIdentifyingData(p);
  assert.deepEqual(identifyingFields(p), []);
});

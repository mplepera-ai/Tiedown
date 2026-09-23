// Regression tests for the wind engine against an independent reference output
// (ASCE 7-16, Exposure C, V = 175 mph, Kd = 0.85, ASD factor 0.6, GCpi = +/-0.55,
// mean roof height 12 ft). Values only - no project data.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ASCE7_16 as pack } from '../public/js/engine/codedata.js';
import { kz, velocityPressure, ccPressure, leewardWallCp, roofCpSuction, zoneWidthA } from '../public/js/engine/wind.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);

test('Kz and qh match reference (Exposure C, z <= 15 ft)', () => {
  near(kz(12, 'C', pack), 0.849, 0.0006, 'Kz');
  const q = velocityPressure({ V: 175, exposure: 'C', z: 12, pack });
  near(q.qUlt, 56.57, 0.02, 'qh ult');
  near(q.qAsd, 33.94, 0.02, 'qh ASD');
});

test('MWFRS wall coefficients', () => {
  near(leewardWallCp(0.518, pack), -0.5, 1e-9, 'L/B 0.518');
  near(leewardWallCp(1.93, pack), -0.314, 0.001, 'L/B 1.93');
  assert.equal(pack.windwardWallCp, 0.8);
  assert.equal(pack.sideWallCp, -0.7);
});

test('MWFRS flat-roof Cp, h/L <= 0.5 (reference: 0-h -0.9, h-2h -0.5, >2h -0.3)', () => {
  const h = 12;
  near(roofCpSuction(3, h, 0.207, 0, pack), -0.9, 1e-9);
  near(roofCpSuction(11, h, 0.207, 0, pack), -0.9, 1e-9);
  near(roofCpSuction(18, h, 0.207, 0, pack), -0.5, 1e-9);
  near(roofCpSuction(30, h, 0.207, 0, pack), -0.3, 1e-9);
});

test('zone width a', () => {
  near(zoneWidthA(30.1, 12), 3.01, 0.001);
});

// [area, wall4 pos, wall4 neg, wall5 pos, wall5 neg] from the reference summary
const wallRef = [
  [2, 52.61, -56.0, 52.61, -66.19],
  [10, 52.61, -56.0, 52.61, -66.19],
  [20, 50.81, -54.2, 50.81, -62.58],
  [50, 48.42, -51.81, 48.42, -57.81],
  [100, 46.62, -50.01, 46.62, -54.2],
  [200, 44.81, -48.21, 44.81, -50.59],
  [250, 44.23, -47.63, 44.23, -49.43],
  [500, 42.43, -45.82, 42.43, -45.82],
];

test('C&C wall zones 4 and 5 reproduce reference pressures (GCpi 0.55)', () => {
  const q = velocityPressure({ V: 175, exposure: 'C', z: 12, pack }).qAsd;
  for (const [A, p4, n4, p5, n5] of wallRef) {
    const z4 = ccPressure({ qAsd: q, zone: pack.wallCC.zones[4], area: A, gcpi: 0.55, pack });
    const z5 = ccPressure({ qAsd: q, zone: pack.wallCC.zones[5], area: A, gcpi: 0.55, pack });
    near(z4.pos, p4, 0.08, `z4 pos A=${A}`);
    near(z4.neg, n4, 0.08, `z4 neg A=${A}`);
    near(z5.pos, p5, 0.08, `z5 pos A=${A}`);
    near(z5.neg, n5, 0.08, `z5 neg A=${A}`);
  }
});

// zone -> [ [A, pos, neg], ... ] at A = 2, 10, 20, 50, 100, 200, 250, 500
const roofRef = {
  '1': [[2, 42.43, -86.55], [10, 36.84, -86.55], [20, 34.44, -86.55], [50, 31.26, -57.57], [100, 28.85, -35.64], [200, 28.85, -35.64], [250, 28.85, -35.64], [500, 28.85, -35.64]],
  '2e': [[2, 42.43, -86.55], [10, 36.84, -86.55], [20, 34.44, -86.55], [50, 31.26, -57.57], [100, 28.85, -35.64], [200, 28.85, -35.64], [250, 28.85, -35.64], [500, 28.85, -35.64]],
  '2n': [[2, 42.43, -120.49], [10, 36.84, -120.49], [20, 34.44, -105.88], [50, 31.26, -86.55], [100, 28.85, -71.93], [200, 28.85, -57.32], [250, 28.85, -52.61], [500, 28.85, -52.61]],
  '2r': [[2, 42.43, -120.49], [10, 36.84, -120.49], [20, 34.44, -105.88], [50, 31.26, -86.55], [100, 28.85, -71.93], [200, 28.85, -57.32], [250, 28.85, -52.61], [500, 28.85, -52.61]],
  '3e': [[2, 42.43, -120.49], [10, 36.84, -120.49], [20, 34.44, -105.88], [50, 31.26, -86.55], [100, 28.85, -71.93], [200, 28.85, -57.32], [250, 28.85, -52.61], [500, 28.85, -52.61]],
  '3r': [[2, 42.43, -140.86], [10, 36.84, -140.86], [20, 34.44, -122.47], [50, 31.26, -98.15], [100, 28.85, -79.76], [200, 28.85, -79.76], [250, 28.85, -79.76], [500, 28.85, -79.76]],
};

test('C&C gable roof 7-20 deg zones reproduce reference pressures', () => {
  const q = velocityPressure({ V: 175, exposure: 'C', z: 12, pack }).qAsd;
  for (const [name, rows] of Object.entries(roofRef)) {
    for (const [A, p, n] of rows) {
      const r = ccPressure({ qAsd: q, zone: pack.roofGable7to20.zones[name], area: A, gcpi: 0.55, pack });
      near(r.pos, p, 0.1, `roof ${name} pos A=${A}`);
      near(r.neg, n, 0.1, `roof ${name} neg A=${A}`);
    }
  }
});

test('40 sf zone 1 panel: +32.0 / -64.6 psf', () => {
  const q = velocityPressure({ V: 175, exposure: 'C', z: 12, pack }).qAsd;
  const r = ccPressure({ qAsd: q, zone: pack.roofGable7to20.zones['1'], area: 40, gcpi: 0.55, pack });
  near(r.pos, 32.04, 0.1);
  near(r.neg, -64.63, 0.1);
});

test('minimum C&C pressure is 9.6 psf ASD', () => {
  const r = ccPressure({ qAsd: 5, zone: pack.wallCC.zones[4], area: 500, gcpi: 0.18, pack });
  near(r.pos, 9.6, 1e-9);
  near(r.neg, -9.6, 1e-9);
});

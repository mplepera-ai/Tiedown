// Code data: FBC editions, Vult by county, and wind coefficient packs.
//
// Every coefficient set carries a `status`:
//   'reference-matched' - reproduced (within rounding) against an independent
//                         commercial wind-analysis output for an ASCE 7-16 case.
//   'unverified'        - transcribed from secondary knowledge; MUST be checked
//                         against the adopted standard before any submittal.
//
// Nothing here is project data. Editing this file is how a new edition's
// numbers get added (see asce7-22 placeholder note below).

export const STATUS = {
  'reference-matched': 'Matches independent reference output',
  unverified: 'Unverified - confirm against adopted standard',
};

/** Florida Building Code editions the app knows about. */
export const EDITIONS = {
  fbc7: {
    label: 'FBC 7th Edition (2020)',
    effective: '2020-12-31',
    windStandard: 'ASCE 7-16',
    pack: 'asce7-16',
    packMatchesEdition: true,
    note: 'Superseded. Included so older reference plan sets can be reproduced.',
  },
  fbc8: {
    label: 'FBC 8th Edition (2023) - currently enforced',
    effective: '2023-12-31',
    windStandard: 'ASCE 7 wind provisions - edition to be confirmed (sources conflict: 7-16 vs 7-22)',
    pack: 'asce7-16',
    packMatchesEdition: false,
    note: 'Wind coefficients in this build are ASCE 7-16. Confirm the ASCE 7 edition your reviewer applies.',
  },
  fbc9: {
    label: 'FBC 9th Edition (2026) - effective 31 Dec 2026',
    effective: '2026-12-31',
    windStandard: 'Newer ASCE 7 edition (not yet loaded)',
    pack: 'asce7-16',
    packMatchesEdition: false,
    note: 'Wind coefficients for this edition are not loaded. Results use ASCE 7-16 and are screening only.',
  },
};

/** Jurisdictions and Risk Category II/I/III ultimate design wind speeds (mph). */
export const JURISDICTIONS = {
  broward: {
    label: 'Broward County (HVHZ)',
    hvhz: true,
    vult: { I: 156, II: 170, III: 180, IV: null },
    source:
      'Secondary summary of FBC Fig. 1609.3 / Sec. 1620 speeds; confirm against the adopted code edition and with the Broward reviewer.',
  },
  miamidade: {
    label: 'Miami-Dade County (HVHZ)',
    hvhz: true,
    vult: { I: 165, II: 175, III: 185, IV: null },
    source: 'Secondary summary of FBC Fig. 1609.3 / Sec. 1620 speeds; confirm against the adopted code edition.',
  },
  other: {
    label: 'Other Florida county (enter Vult)',
    hvhz: false,
    vult: { I: null, II: null, III: null, IV: null },
    source: 'Enter the Vult from the FBC wind speed map for the site.',
  },
};

export function vultFor(county, riskCat) {
  const j = JURISDICTIONS[county];
  if (!j) return null;
  return j.vult[riskCat] ?? null;
}

// --------------------------------------------------------------------------
// ASCE 7-16 wind coefficient pack
// --------------------------------------------------------------------------

export const ASCE7_16 = {
  id: 'asce7-16',
  label: 'ASCE 7-16',

  // Table 26.11-1 exposure constants; Kz = 2.01 (z/zg)^(2/alpha), z floored at 15 ft.
  exposure: {
    B: { alpha: 7.0, zg: 1200 },
    C: { alpha: 9.5, zg: 900 },
    D: { alpha: 11.5, zg: 700 },
  },
  kzCoefficient: 2.01,
  kdBuilding: 0.85, // Table 26.6-1 buildings, solid freestanding walls
  gust: 0.85, // rigid structures, simplified
  asdFactor: 0.6, // ASCE 7 Sec. 2.4 wind load factor for ASD combinations
  gcpi: { enclosed: 0.18, partial: 0.55, open: 0.0 }, // Table 26.13-1
  minCC: 16, // psf, ultimate (C&C minimum, Sec. 30.2.2 / 30.3)
  minMWFRS: { wall: 16, roof: 8 }, // psf, ultimate (Sec. 27.1.5)

  statuses: {
    velocityPressure: 'reference-matched', // Exposure C Kz, qh, ASD factor, min pressures
    otherConstants: 'unverified', // Exposure B/D constants, GCpi = 0.18 (enclosed)
    wallCpMWFRS: 'reference-matched', // windward 0.8, side -0.7, leeward vs L/B
    roofCpFlatLow: 'reference-matched', // h/L <= 0.5
    roofCpFlatHigh: 'unverified', // h/L >= 1.0
    wallCC: 'reference-matched', // Fig. 30.3-1 zones 4 and 5
    roofGable7to20: 'reference-matched', // Fig. 30.3-2B zones
    roofSlopedEnvelope: 'unverified', // envelope floor for slopes >= 10 deg
    fenceCf: 'unverified', // Fig. 29.3-1
  },

  // Leeward wall Cp versus L/B (Fig. 27.3-1), linear interpolation.
  leewardWallCp: [
    [0, -0.5],
    [1, -0.5],
    [2, -0.3],
    [4, -0.2],
  ],
  windwardWallCp: 0.8,
  sideWallCp: -0.7,

  // MWFRS roof Cp for wind on flat / low-slope roofs (theta < 10 deg), Fig. 27.3-1.
  // Each row: [upper limit of x/h, Cp]. The last row covers everything beyond.
  roofCpFlat: {
    low: [
      [0.5, -0.9],
      [1.0, -0.9],
      [2.0, -0.5],
      [Infinity, -0.3],
    ], // h/L <= 0.5
    high: [
      [0.5, -1.3],
      [Infinity, -0.7],
    ], // h/L >= 1.0
  },
  // Envelope for sloped roofs (theta >= 10 deg): suction magnitude never
  // less than this anywhere on the roof (conservative; see status).
  roofSlopedFloor: -0.7,

  // Components & cladding, walls, h <= 60 ft (Fig. 30.3-1). [area sf, GCp] log curves.
  wallCC: {
    figure: 'Fig. 30.3-1',
    zones: {
      4: { label: 'Wall zone 4 (interior)', pos: [[10, 1.0], [500, 0.7]], neg: [[10, -1.1], [500, -0.8]] },
      5: { label: 'Wall zone 5 (end / corner strip)', pos: [[10, 1.0], [500, 0.7]], neg: [[10, -1.4], [500, -0.8]] },
    },
  },

  // Components & cladding, gable roof 7 < theta <= 20 deg (Fig. 30.3-2B).
  roofGable7to20: {
    figure: 'Fig. 30.3-2B',
    minSlopeDeg: 7,
    maxSlopeDeg: 20,
    zones: {
      '1': { label: 'Roof zone 1 (interior)', pos: [[2, 0.7], [100, 0.3]], neg: [[20, -2.0], [100, -0.5]] },
      '2e': { label: 'Roof zone 2e', pos: [[2, 0.7], [100, 0.3]], neg: [[20, -2.0], [100, -0.5]] },
      '2n': { label: 'Roof zone 2n', pos: [[2, 0.7], [100, 0.3]], neg: [[10, -3.0], [250, -1.0]] },
      '2r': { label: 'Roof zone 2r', pos: [[2, 0.7], [100, 0.3]], neg: [[10, -3.0], [250, -1.0]] },
      '3e': { label: 'Roof zone 3e (corner)', pos: [[2, 0.7], [100, 0.3]], neg: [[10, -3.0], [250, -1.0]] },
      '3r': { label: 'Roof zone 3r (corner at ridge)', pos: [[2, 0.7], [100, 0.3]], neg: [[10, -3.6], [100, -1.8]] },
    },
  },

  // Freestanding solid walls / fences, clearance ratio s/h = 1 (Fig. 29.3-1, cases A and B).
  // [B/s, Cf], linear interpolation. UNVERIFIED - confirm against the standard.
  fenceCf: [
    [0.05, 1.8],
    [0.1, 1.7],
    [0.2, 1.65],
    [0.5, 1.55],
    [1, 1.45],
    [2, 1.4],
    [4, 1.35],
    [5, 1.35],
    [10, 1.3],
    [20, 1.3],
    [30, 1.3],
    [40, 1.3],
  ],
  fenceMinPsf: 16, // ultimate
};

export const PACKS = { 'asce7-16': ASCE7_16 };

// NOTE: an ASCE 7-22 pack (Kz table, Kd moved into the pressure equations,
// 3-zone roof C&C figures, new effective-area breakpoints) is NOT included.
// Add it as a second pack with the same shape and point the relevant EDITIONS
// entry at it; wind.js takes the pack as a parameter.

/** Presumptive soil values (IBC Table 1806.2 style). Shown as hints only - UNVERIFIED. */
export const SOIL_HINTS = [
  { cls: 'Sand, silty sand, clayey sand, silty/clayey gravel', lateral: 150, friction: 0.25 },
  { cls: 'Sandy gravel and gravel', lateral: 200, friction: 0.35 },
  { cls: 'Clay, sandy clay, silty clay, silt', lateral: 100, friction: 0.2 },
];

// Input layout for each page. Fields are declarative; app.js renders them.
// field: { path, label, unit, type: number|text|select|checkbox, options, help, showIf }

import { EDITIONS, JURISDICTIONS } from './engine/codedata.js';

const opts = (obj) => Object.entries(obj).map(([v, o]) => ({ v, l: o.label }));

export const PAGES = [
  {
    id: 'code',
    title: 'Project & Code',
    intro:
      'Set the code basis once; the shed and fence pages use it. Broward County is the default reviewing jurisdiction.',
    sections: [
      {
        title: 'Code basis',
        fields: [
          { path: 'code.county', label: 'Jurisdiction', type: 'select', options: opts(JURISDICTIONS) },
          { path: 'code.edition', label: 'Florida Building Code edition', type: 'select', options: opts(EDITIONS) },
          { path: 'code.riskCat', label: 'Risk Category', type: 'select', options: ['I', 'II', 'III', 'IV'].map((v) => ({ v, l: v })), help: 'Residential accessory structures are commonly Risk Category II; confirm with the reviewer.' },
          { path: 'code.exposure', label: 'Exposure category', type: 'select', options: ['B', 'C', 'D'].map((v) => ({ v, l: v })) },
          { path: 'code.vultOverride', label: 'Vult override', unit: 'mph', type: 'number', help: 'Leave blank to use the jurisdiction table. Enter a value to override (or for other counties).' },
          { path: 'code.kzt', label: 'Topographic factor Kzt', type: 'number', help: '1.0 for flat sites.' },
          { path: 'code.elevation', label: 'Ground elevation', unit: 'ft', type: 'number', help: 'Feeds the Ke factor; 0 is fine for South Florida.' },
          {
            path: 'code.enclosure',
            label: 'Enclosure classification',
            type: 'select',
            options: [
              { v: 'partial', l: 'Partially enclosed (GCpi +/-0.55)' },
              { v: 'enclosed', l: 'Enclosed (GCpi +/-0.18)' },
            ],
            help: 'In the windborne debris region / HVHZ, openings without impact protection make a building partially enclosed.',
          },
        ],
      },
      {
        title: 'Report header (optional)',
        note: 'Stored only in your saved file and this browser. Leave blank to keep the report anonymous. "Clear identifying data" wipes these fields before you share a file.',
        fields: [
          { path: 'meta.name', label: 'Project title', type: 'text' },
          { path: 'meta.owner', label: 'Owner', type: 'text' },
          { path: 'meta.address', label: 'Site address', type: 'text' },
          { path: 'meta.preparedBy', label: 'Prepared by', type: 'text' },
          { path: 'meta.date', label: 'Date', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'shed',
    title: 'Shed',
    intro: 'Enclosed or partially enclosed small building. Wind uplift, overturning, sliding, anchorage and foundation sizing (ASD: 0.6D + 0.6W).',
    sections: [
      {
        title: 'Geometry',
        fields: [
          { path: 'shed.roofType', label: 'Roof type', type: 'select', options: [{ v: 'gable', l: 'Gable' }, { v: 'mono', l: 'Mono-slope' }, { v: 'flat', l: 'Flat' }] },
          { path: 'shed.width', label: 'Width (eave to eave)', unit: 'ft', type: 'number' },
          { path: 'shed.length', label: 'Length (along ridge)', unit: 'ft', type: 'number' },
          { path: 'shed.eaveHeight', label: 'Eave height (low eave)', unit: 'ft', type: 'number' },
          { path: 'shed.rise', label: 'Roof slope, rise per 12', unit: 'in.', type: 'number', help: 'Enter 0 for a flat roof.' },
          { path: 'shed.overhang', label: 'Roof overhang', unit: 'ft', type: 'number' },
        ],
      },
      {
        title: 'Dead and live loads',
        fields: [
          { path: 'shed.roofDL', label: 'Roof dead load', unit: 'psf plan', type: 'number', help: 'Framing + sheathing + roofing, per square foot of roof plan area.' },
          { path: 'shed.wallDL', label: 'Wall dead load', unit: 'psf wall', type: 'number', help: 'Per square foot of wall surface.' },
          { path: 'shed.roofLL', label: 'Roof live load', unit: 'psf', type: 'number', help: 'Used for the D + L bearing check.' },
        ],
      },
      {
        title: 'Foundation',
        fields: [
          { path: 'shed.foundation.type', label: 'Foundation type', type: 'select', options: [{ v: 'slab', l: 'Slab-on-grade with thickened edge' }, { v: 'pads', l: 'Concrete pads / piers at anchor points' }] },
          { path: 'shed.foundation.slabThk', label: 'Slab thickness', unit: 'in.', type: 'number', showIf: (p) => p.shed.foundation.type === 'slab' },
          { path: 'shed.foundation.edgeWidth', label: 'Thickened edge width', unit: 'in.', type: 'number', showIf: (p) => p.shed.foundation.type === 'slab' },
          { path: 'shed.foundation.edgeDepth', label: 'Thickened edge total depth', unit: 'in.', type: 'number', help: 'Measured from the top of slab to the bottom of the edge.', showIf: (p) => p.shed.foundation.type === 'slab' },
          { path: 'shed.foundation.padCount', label: 'Number of pads', type: 'number', showIf: (p) => p.shed.foundation.type === 'pads' },
          { path: 'shed.foundation.padSize', label: 'Pad size (square)', unit: 'ft', type: 'number', showIf: (p) => p.shed.foundation.type === 'pads' },
          { path: 'shed.foundation.padDepth', label: 'Pad depth', unit: 'ft', type: 'number', showIf: (p) => p.shed.foundation.type === 'pads' },
          { path: 'shed.foundation.floorDL', label: 'Floor system dead load', unit: 'psf', type: 'number', showIf: (p) => p.shed.foundation.type === 'pads' },
          { path: 'shed.foundation.bearing', label: 'Allowable soil bearing', unit: 'psf', type: 'number', help: 'From a soil report or the presumptive value the reviewer accepts.' },
          { path: 'shed.foundation.friction', label: 'Concrete-to-soil friction coefficient', type: 'number' },
          { path: 'shed.foundation.passive', label: 'Lateral (passive) soil pressure', unit: 'psf/ft', type: 'number', showIf: (p) => p.shed.foundation.type === 'slab', help: 'Acts on the thickened edge. Leave blank to ignore passive resistance.' },
        ],
      },
      {
        title: 'Anchorage (allowable capacities from the product data)',
        fields: [
          { path: 'shed.anchors.count', label: 'Wall-to-foundation anchors / straps', type: 'number' },
          { path: 'shed.anchors.tensionCap', label: 'Allowable tension per anchor', unit: 'lb', type: 'number' },
          { path: 'shed.anchors.shearCap', label: 'Allowable shear per anchor', unit: 'lb', type: 'number' },
        ],
      },
      {
        title: 'Roof framing connections and components',
        fields: [
          { path: 'shed.framing.spacing', label: 'Rafter / truss spacing', unit: 'ft', type: 'number' },
          { path: 'shed.framing.span', label: 'Rafter / truss span (horizontal)', unit: 'ft', type: 'number' },
          { path: 'shed.framing.clipCap', label: 'Allowable uplift per framing connection', unit: 'lb', type: 'number' },
          { path: 'shed.roofEffArea', label: 'Roof sheathing effective wind area', unit: 'sf', type: 'number', help: 'Area tributary to one fastener or one panel span; 10 sf is the smallest area in the tables.' },
          { path: 'shed.wallEffArea', label: 'Wall cladding effective wind area', unit: 'sf', type: 'number' },
        ],
      },
    ],
    custom: 'customZones',
  },
  {
    id: 'fence',
    title: 'Fence',
    intro: 'Solid or nearly solid freestanding fence: wind force, post bending and post embedment (IBC pole formula).',
    sections: [
      {
        title: 'Fence',
        fields: [
          { path: 'fence.height', label: 'Height above grade', unit: 'ft', type: 'number' },
          { path: 'fence.runLength', label: 'Straight run length', unit: 'ft', type: 'number', help: 'Sets B/s for the force coefficient; longer runs use a lower coefficient.' },
          { path: 'fence.postSpacing', label: 'Post spacing', unit: 'ft', type: 'number' },
          { path: 'fence.solidity', label: 'Solid area ratio', type: 'number', help: '1.0 = solid panels. 0.7 to 1.0 uses the porosity reduction; below 0.7 is treated as solid unless you enter a net Cf.' },
          { path: 'fence.cfOverride', label: 'Net force coefficient override (optional)', type: 'number', help: 'Cf x reduction applied to the gross area, from the adopted standard.' },
        ],
      },
      {
        title: 'Post and footing',
        fields: [
          { path: 'fence.holeShape', label: 'Hole / footing shape', type: 'select', options: [{ v: 'round', l: 'Round' }, { v: 'square', l: 'Square' }] },
          { path: 'fence.holeSize', label: 'Hole diameter (or side)', unit: 'in.', type: 'number' },
          { path: 'fence.embedDepth', label: 'Post embedment provided', unit: 'ft', type: 'number' },
          { path: 'fence.lateralBearing', label: 'Allowable lateral soil bearing', unit: 'psf per ft', type: 'number', help: 'Tabulated value per foot of depth (IBC Table 1806.2 style); use your soil data.' },
          { path: 'fence.isolatedPole', label: 'Apply isolated-pole 2x lateral bearing', type: 'checkbox', help: 'Only if posts are not adversely affected by 1/2 in. of movement at grade.' },
          { path: 'fence.postSx', label: 'Post section modulus Sx', unit: 'in^3', type: 'number', help: 'Actual section: 3.5 in. square = 7.15; 5.5 in. square = 27.7.' },
          { path: 'fence.postFb', label: 'Allowable bending stress Fb', unit: 'psi', type: 'number', help: 'From the material data (before load-duration factor).' },
          { path: 'fence.loadDuration', label: 'Load duration factor CD', type: 'number', help: '1.6 for wood under wind; 1.0 for aluminum / steel.' },
        ],
      },
    ],
  },
  {
    id: 'components',
    title: 'Components',
    intro: 'Check approved products (roof panels, doors, windows, garage doors) against the C&C pressure at their size. Uses the shed geometry and wind speed.',
    components: true,
    sections: [],
  },
  { id: 'report', title: 'Report', intro: 'Calculation package for the plans examiner. Use Print / Save PDF.', report: true, sections: [] },
];

export const CUSTOM_ZONE_COUNT = 4;

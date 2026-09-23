// Blank project and a clearly fictional sample. No real project data lives here.

const emptyZone = () => ({ name: '', pos: '', neg: '' });

export function blankProject() {
  return {
    version: 1,
    meta: { name: '', owner: '', address: '', preparedBy: '', date: '' },
    code: {
      county: 'broward',
      edition: 'fbc8',
      riskCat: 'II',
      exposure: 'C',
      vultOverride: '',
      kzt: '1',
      elevation: '0',
      enclosure: 'partial',
    },
    shed: {
      roofType: 'gable',
      width: '',
      length: '',
      eaveHeight: '',
      rise: '',
      overhang: '',
      roofDL: '',
      wallDL: '',
      roofLL: '20',
      roofEffArea: '',
      wallEffArea: '',
      foundation: {
        type: 'slab',
        slabThk: '',
        edgeWidth: '',
        edgeDepth: '',
        padCount: '',
        padSize: '',
        padDepth: '',
        floorDL: '',
        bearing: '',
        friction: '',
        passive: '',
      },
      anchors: { count: '', tensionCap: '', shearCap: '' },
      framing: { spacing: '', span: '', clipCap: '' },
      customZones: [emptyZone(), emptyZone(), emptyZone(), emptyZone()],
    },
    fence: {
      height: '',
      runLength: '',
      postSpacing: '',
      solidity: '1',
      cfOverride: '',
      holeShape: 'round',
      holeSize: '',
      embedDepth: '',
      lateralBearing: '',
      isolatedPole: false,
      postSx: '',
      postFb: '',
      loadDuration: '1.6',
    },
    components: [],
  };
}

/** Fictional example (invented numbers, not from any real job). */
export function sampleProject() {
  const p = blankProject();
  p.meta = { name: 'Sample Shed and Fence (fictional)', owner: '', address: '', preparedBy: '', date: '' };
  p.shed = {
    ...p.shed,
    roofType: 'gable',
    width: '10',
    length: '12',
    eaveHeight: '8',
    rise: '4',
    overhang: '0.5',
    roofDL: '6',
    wallDL: '5',
    roofLL: '20',
    roofEffArea: '10',
    wallEffArea: '10',
    foundation: {
      type: 'slab',
      slabThk: '4',
      edgeWidth: '12',
      edgeDepth: '24',
      padCount: '6',
      padSize: '2',
      padDepth: '3',
      floorDL: '3',
      bearing: '1500',
      friction: '0.25',
      passive: '150',
    },
    anchors: { count: '12', tensionCap: '1000', shearCap: '800' },
    framing: { spacing: '2', span: '10', clipCap: '1200' },
    customZones: p.shed.customZones,
  };
  p.fence = {
    ...p.fence,
    height: '4',
    runLength: '40',
    postSpacing: '6',
    solidity: '1',
    holeShape: 'round',
    holeSize: '18',
    embedDepth: '6.5',
    lateralBearing: '150',
    isolatedPole: false,
    postSx: '27.7',
    postFb: '1000',
    loadDuration: '1.6',
  };
  p.components = [
    { name: 'Roof panel (sample rating)', location: 'roof', zone: '3r', area: '10', ratedPos: '60', ratedNeg: '-140', approval: '' },
    { name: 'Wall door (sample rating)', location: 'wall', zone: '5', area: '20', ratedPos: '60', ratedNeg: '-65', approval: '' },
  ];
  return p;
}

/** Blank every field that could identify a project, leaving engineering inputs alone. */
export function clearIdentifyingData(project) {
  project.meta = { name: '', owner: '', address: '', preparedBy: '', date: '' };
  for (const c of project.components || []) c.approval = '';
  return project;
}

/** Names of non-blank identifying fields (used to warn before export). */
export function identifyingFields(project) {
  const out = [];
  for (const [k, v] of Object.entries(project.meta || {})) if (String(v || '').trim()) out.push(k);
  return out;
}

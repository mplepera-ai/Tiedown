// Component rating check: compares approved-product design pressures (from a
// Florida Product Approval / Miami-Dade NOA) against the C&C pressures at the
// component's effective wind area. Ratings are compared at ASD level.

import { num, isNum, makeCheck } from './util.js';
import { ccPressure } from './wind.js';
import { analyzeShed } from './shed.js';

export function analyzeComponents(project) {
  const rows = (project.components || []).filter((c) => c && (c.name || isNum(c.area)));
  const shed = analyzeShed(project);
  if (!shed.ok) return { ok: false, reason: 'Complete the Shed inputs first (wind pressures use the shed geometry).', warnings: shed.warnings || [] };
  if (!rows.length) return { ok: false, reason: 'Add a component to check.', warnings: shed.warnings };

  const pack = shed.basis.pack;
  const qA = shed.wind.qAsd;
  const gcpi = shed.wind.gcpi;
  const roofZones = shed.cc.roofSource?.zones || {};
  const results = [];
  const checks = [];

  rows.forEach((c, i) => {
    const area = num(c.area);
    const zoneKey = String(c.zone || '');
    const zone = c.location === 'wall' ? pack.wallCC.zones[zoneKey] : roofZones[zoneKey];
    const label = c.name || `Component ${i + 1}`;
    if (!isNum(area) || !zone) {
      results.push({ label, error: !zone ? 'Zone not available for this roof / location.' : 'Enter an effective wind area.' });
      return;
    }
    const p = ccPressure({ qAsd: qA, zone, area, gcpi, pack });
    const ratedPos = num(c.ratedPos);
    const ratedNeg = num(c.ratedNeg);
    const r = { label, location: c.location, zone: zoneKey, area, pos: p.pos, neg: p.neg, ratedPos, ratedNeg, approval: c.approval || '' };
    results.push(r);
    if (isNum(ratedPos)) checks.push(makeCheck(`comp-pos-${i}`, `${label}: positive pressure (zone ${zoneKey})`, p.pos, Math.abs(ratedPos), 'psf', 'ASD-level comparison'));
    if (isNum(ratedNeg)) checks.push(makeCheck(`comp-neg-${i}`, `${label}: negative pressure (zone ${zoneKey})`, Math.abs(p.neg), Math.abs(ratedNeg), 'psf', 'ASD-level comparison'));
  });

  return {
    ok: true,
    warnings: [...shed.warnings, 'Confirm whether each approval lists allowable (ASD) or ultimate design pressures; ratings are compared as ASD values here.'],
    results,
    checks,
  };
}

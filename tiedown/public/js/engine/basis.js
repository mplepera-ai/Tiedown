// Resolves the code basis (edition, wind standard pack, Vult, exposure) from project.code.

import { EDITIONS, JURISDICTIONS, PACKS, vultFor } from './codedata.js';
import { num, isNum } from './util.js';

export function resolveBasis(code = {}) {
  const warnings = [];
  const edition = EDITIONS[code.edition] || EDITIONS.fbc8;
  const pack = PACKS[edition.pack];
  const jur = JURISDICTIONS[code.county] || JURISDICTIONS.broward;
  const riskCat = code.riskCat || 'II';
  const exposure = code.exposure || 'C';

  let V = num(code.vultOverride);
  let vultSource = 'manual override';
  if (!Number.isFinite(V)) {
    const tab = vultFor(code.county || 'broward', riskCat);
    V = tab === null || tab === undefined ? NaN : tab;
    vultSource = jur.label + ', Risk Category ' + riskCat;
  }

  const kzt = isNum(code.kzt) ? num(code.kzt) : 1;
  const elevation = isNum(code.elevation) ? num(code.elevation) : 0;

  if (!edition.packMatchesEdition) {
    warnings.push(
      `Wind coefficients loaded are ${pack.label}, but ${edition.label} adopts: ${edition.windStandard}. ` +
        'Results are SCREENING ONLY until the matching ASCE 7 data is loaded and verified.'
    );
  }
  if (!Number.isFinite(V)) warnings.push('No design wind speed: enter a Vult override or pick a jurisdiction / risk category with a listed speed.');
  if (jur.hvhz && exposure === 'B')
    warnings.push('HVHZ projects are normally designed as Exposure C or D. Exposure B needs justification; confirm with the reviewer.');
  if (riskCat === 'I' && jur.hvhz)
    warnings.push('Risk Category I (low-hazard minor storage) is a reviewer decision. Many reviewers treat residential accessory structures as Risk Category II.');
  if (Number.isFinite(kzt) && kzt !== 1) warnings.push('Kzt is not 1.0: confirm the topographic effect per ASCE 7 Sec. 26.8.');

  return {
    edition,
    editionKey: code.edition || 'fbc8',
    pack,
    jurisdiction: jur,
    hvhz: !!jur.hvhz,
    riskCat,
    exposure,
    V,
    vultSource,
    kzt,
    elevation,
    enclosure: code.enclosure || 'partial',
    screeningOnly: !edition.packMatchesEdition,
    warnings,
  };
}

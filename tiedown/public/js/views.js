// Results and report HTML. Pure string builders; no DOM access.

import { analyzeShed, analyzeFence, analyzeComponents, resolveBasis, STATUS, EDITIONS } from './engine/index.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const fmt = (v, d = 1) => {
  if (v === Infinity) return 'n/a';
  return Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-';
};

const chip = (status) => `<span class="chip chip-${status}">${status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : esc(status)}</span>`;

export function checksTable(checks) {
  if (!checks.length) return '<p class="muted">No pass/fail checks yet. Fill in the capacity inputs (soil, anchors, product ratings) to get them.</p>';
  const rows = checks
    .map(
      (c) => `<tr class="row-${c.status}">
      <td>${esc(c.label)}${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</td>
      <td class="num">${fmt(c.demand, c.unit === 'ft' ? 2 : c.demand < 10 ? 2 : 0)}</td>
      <td class="num">${fmt(c.capacity, c.unit === 'ft' ? 2 : c.capacity < 10 ? 2 : 0)}</td>
      <td>${esc(c.unit)}</td>
      <td class="num">${fmt(c.ratio, 2)}</td>
      <td>${chip(c.status)}</td></tr>`
    )
    .join('');
  return `<table class="tbl"><thead><tr><th>Check</th><th>Demand</th><th>Capacity</th><th>Unit</th><th>D/C</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

const kv = (rows) =>
  `<table class="tbl kv"><tbody>${rows
    .filter(Boolean)
    .map(([k, v, note]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td><td class="note">${esc(note || '')}</td></tr>`)
    .join('')}</tbody></table>`;

// The screening notice lives in the banner on app pages; it stays in the report.
const pageWarnings = (w) => (w || []).filter((x) => !/SCREENING ONLY/.test(x));

const warnList = (warnings) =>
  warnings && warnings.length ? `<div class="warnbox"><strong>Read before relying on these results</strong><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';

function overallSummary(checks) {
  if (!checks.length) return '';
  const fails = checks.filter((c) => c.status === 'fail').length;
  const cls = fails ? 'fail' : 'pass';
  return `<div class="summary summary-${cls}">${fails ? `${fails} of ${checks.length} checks FAIL` : `All ${checks.length} checks pass`}</div>`;
}

// --------------------------------------------------------------------------
// Code page
// --------------------------------------------------------------------------

export function codeResults(project) {
  const b = resolveBasis(project.code);
  const ed = b.edition;
  const statuses = Object.entries(b.pack.statuses)
    .map(([k, v]) => `<tr><td>${esc(COEFF_LABELS[k] || k)}</td><td>${esc(STATUS[v])}</td></tr>`)
    .join('');
  return `
    ${warnList(b.warnings)}
    <div class="card"><h3>Code basis</h3>
    ${kv([
      ['Jurisdiction', esc(b.jurisdiction.label), b.hvhz ? 'High-Velocity Hurricane Zone' : ''],
      ['Code edition', esc(ed.label), `Effective ${ed.effective}`],
      ['Wind standard adopted by that edition', esc(ed.windStandard)],
      ['Wind coefficient data loaded', esc(b.pack.label), b.screeningOnly ? 'Does not match the edition - screening only' : 'Matches the edition'],
      ['Design wind speed Vult', Number.isFinite(b.V) ? `${fmt(b.V, 0)} mph` : '-', b.vultSource],
      ['Risk Category / Exposure', `${esc(b.riskCat)} / ${esc(b.exposure)}`],
    ])}
    <p class="note">Speed source: ${esc(b.jurisdiction.source)}</p></div>
    <div class="card"><h3>Coefficient verification status</h3>
    <table class="tbl"><thead><tr><th>Data set</th><th>Status</th></tr></thead><tbody>${statuses}</tbody></table>
    <p class="note">"Matches independent reference output" means the values reproduce a commercial wind-analysis output for an ASCE 7-16 case. "Unverified" data must be checked against the adopted standard before submittal. The report lists this table too.</p></div>
    <div class="card"><h3>Broward HVHZ reminders</h3>
    <ul class="plain">
      <li>Prefabricated components (roof panels, doors, windows, garage doors, shutters) normally need a valid Florida Product Approval or Miami-Dade NOA listing an appropriate design pressure. Use the Components page to compare.</li>
      <li>Openings without approved impact protection make the building partially enclosed (GCpi +/-0.55).</li>
      <li>The plans examiner decides the applicable code edition, ASCE 7 edition, risk category and required sealed drawings. This tool does not replace that conversation.</li>
    </ul></div>`;
}

const COEFF_LABELS = {
  velocityPressure: 'Velocity pressure (Exposure C), Kz, ASD factor, minimum pressures',
  otherConstants: 'Exposure B and D constants; enclosed GCpi = 0.18',
  wallCpMWFRS: 'MWFRS wall Cp (windward, leeward, side)',
  roofCpFlatLow: 'MWFRS flat-roof Cp, h/L <= 0.5',
  roofCpFlatHigh: 'MWFRS flat-roof Cp, h/L >= 1.0',
  wallCC: 'C&C wall zones 4 and 5 (Fig. 30.3-1)',
  roofGable7to20: 'C&C gable roof zones, 7-20 deg (Fig. 30.3-2B)',
  roofSlopedEnvelope: 'MWFRS roof suction envelope floor for slopes >= 10 deg',
  fenceCf: 'Freestanding wall force coefficient (Fig. 29.3-1, s/h = 1)',
};

// --------------------------------------------------------------------------
// Shed
// --------------------------------------------------------------------------

export function shedSections(r) {
  const out = [];
  const b = r.basis;
  const w = r.wind;
  const g = r.geometry;

  out.push({
    title: 'Wind parameters',
    html:
      kv([
        ['Design wind speed Vult', `${fmt(b.V, 0)} mph`, b.vultSource],
        ['Exposure / Risk Category', `${esc(b.exposure)} / ${esc(b.riskCat)}`],
        ['Mean roof height h', `${fmt(g.meanHeight, 2)} ft`, `Ridge at ${fmt(g.ridgeHeight, 2)} ft`],
        ['Roof angle', `${fmt(g.theta, 1)} deg`],
        ['Kz at h (floored at 15 ft)', fmt(w.Kz, 3)],
        ['Kzt / Kd / Ke', `${fmt(w.Kzt, 2)} / ${fmt(w.Kd, 2)} / ${fmt(w.Ke, 3)}`],
        ['Velocity pressure qh (ultimate)', `${fmt(w.qUlt, 2)} psf`, 'qh = 0.00256 Kz Kzt Kd Ke V^2'],
        ['ASD load factor', `${fmt(b.pack.asdFactor, 1)}`],
        ['Velocity pressure qh (ASD)', `${fmt(w.qAsd, 2)} psf`],
        ['Internal pressure GCpi', `+/-${fmt(w.gcpi, 2)}`, b.enclosure === 'partial' ? 'Partially enclosed' : 'Enclosed'],
        ['Gust factor G', fmt(w.G, 2)],
      ]) +
      `<p class="formula">qh = 0.00256 x ${fmt(w.Kz, 3)} x ${fmt(w.Kzt, 2)} x ${fmt(w.Kd, 2)} x ${fmt(w.Ke, 3)} x ${fmt(b.V, 0)}<sup>2</sup> = ${fmt(w.qUlt, 2)} psf;&nbsp; ASD: x ${fmt(b.pack.asdFactor, 1)} = ${fmt(w.qAsd, 2)} psf</p>`,
  });

  const dirRows = (label, f) => `<tr><td>${label}</td>${r.dirs.map((d) => `<td class="num">${f(d)}</td>`).join('')}</tr>`;
  out.push({
    title: 'MWFRS: lateral force and uplift by wind direction',
    html: `<table class="tbl"><thead><tr><th></th>${r.dirs.map((d) => `<th>${esc(d.name)}</th>`).join('')}</tr></thead><tbody>
      ${dirRows('L/B, h/L', (d) => `${fmt(d.LB, 2)}, ${fmt(d.hOverL, 2)}`)}
      ${dirRows('Leeward wall Cp', (d) => fmt(d.cpLee, 2))}
      ${dirRows('Net wall coefficient (0.8 + |Cp leeward|)', (d) => fmt(d.cn, 2))}
      ${dirRows('Projected wall area (sf)', (d) => fmt(d.wallProj, 1))}
      ${dirRows('Projected roof area (sf)', (d) => fmt(d.roofProj, 1))}
      ${dirRows('Base shear V (lb)', (d) => fmt(d.V, 0) + (d.useMin ? ' (minimum-load case)' : ''))}
      ${dirRows('Moment from lateral force about base (lb-ft)', (d) => fmt(d.Mlat, 0))}
      ${dirRows('Peak roof suction |Cp|', (d) => fmt(d.cpMaxMag, 2))}
      ${dirRows('Total roof uplift U (lb)', (d) => fmt(d.U, 0))}
      ${dirRows('Uplift moment about leeward toe (lb-ft)', (d) => fmt(d.Mup, 0))}
      ${dirRows('Total overturning moment (lb-ft)', (d) => fmt(d.Mot, 0))}
      </tbody></table>
      <p class="formula">Lateral: F = qh(ASD) x G x (0.8 + |Cp,lee|) x projected area, roof projection treated like wall (conservative). Uplift: p = qh(ASD) x (G x |Cp| + GCpi) by strip across the roof, plus windward overhang underside 0.8 qh. Roof Cp from the flat-roof table; slopes of 10 degrees or more are floored at ${fmt(-b.pack.roofSlopedFloor, 2)}.</p>`,
  });

  const L = r.loads;
  out.push({
    title: 'Dead loads and foundation weight',
    html: kv([
      ['Roof dead load', `${fmt(L.Droof, 0)} lb`],
      ['Wall dead load', `${fmt(L.Dwalls, 0)} lb`],
      L.floorDL ? ['Floor system dead load', `${fmt(L.floorDL, 0)} lb`] : null,
      ['Structure above foundation', `${fmt(L.Dsuper, 0)} lb`],
      ['Foundation concrete (150 pcf)', `${fmt(L.Wf, 0)} lb`, r.foundation.notes.join(' ')],
      ['Total resisting dead load D', `${fmt(L.Dtotal, 0)} lb`],
    ]),
  });

  const G = r.governing;
  out.push({
    title: 'Uplift, tie-down and required foundation weight',
    html:
      kv([
        ['Governing roof uplift U (ASD)', `${fmt(G.Ugov, 0)} lb`],
        ['Net uplift at roof-to-wall connections: U - 0.6 x roof D', `${fmt(G.tRoofConnTotal, 0)} lb`, 'Total to be carried by framing ties across the roof'],
        ['Net uplift at wall-to-foundation connections: U - 0.6 x (roof + wall D)', `${fmt(G.tFoundTotal, 0)} lb`, 'Total to be carried by sill anchors / straps'],
        ['Minimum foundation dead weight so 0.6D >= U', `${fmt(G.reqWf, 0)} lb`, `Provided: ${fmt(L.Wf, 0)} lb`],
        r.outputs.anchorsRequiredTension ? ['Anchors needed for tension', `${r.outputs.anchorsRequiredTension}`, `At ${fmt(r.outputs.anchors.tCap, 0)} lb each`] : null,
        r.outputs.anchorsRequiredShear ? ['Anchors needed for base shear', `${r.outputs.anchorsRequiredShear}`, `At ${fmt(r.outputs.anchors.sCap, 0)} lb each`] : null,
      ]) + '<p class="formula">ASCE 7 ASD combination: 0.6D + 0.6W (wind already carries the 0.6 factor).</p>',
  });

  const stabRows = r.dirs
    .filter((d) => d.Mres !== undefined)
    .map(
      (d) => `<tr><td>${esc(d.name)}</td><td class="num">${fmt(d.Mres, 0)}</td><td class="num">${fmt(d.holdDown, 0)}</td><td class="num">${fmt(d.friction, 0)}</td><td class="num">${fmt(d.passive, 0)}</td><td class="num">${fmt(d.ecc, 2)}</td><td class="num">${fmt(d.qmax, 0)}</td></tr>`
    )
    .join('');
  if (stabRows)
    out.push({
      title: 'Overturning, sliding and bearing detail',
      html: `<table class="tbl"><thead><tr><th>Direction</th><th>Resisting moment 0.6D x W/2 (lb-ft)</th><th>Extra hold-down if overturning fails (lb)</th><th>Friction (lb)</th><th>Passive (lb)</th><th>Eccentricity (ft)</th><th>Max bearing D+0.6W (psf)</th></tr></thead><tbody>${stabRows}</tbody></table>`,
    });

  if (r.cc.wall || r.cc.roof) {
    const zoneTable = (rows, title) =>
      `<h4>${title}</h4><table class="tbl"><thead><tr><th>Zone</th><th>Area (sf)</th><th>GCp +</th><th>GCp -</th><th>Pressure toward (psf)</th><th>Pressure away (psf)</th></tr></thead><tbody>${rows
        .map((z) => `<tr><td>${esc(z.label)}</td><td class="num">${fmt(z.area, 0)}</td><td class="num">${fmt(z.gcpPos, 2)}</td><td class="num">${fmt(z.gcpNeg, 2)}</td><td class="num">${fmt(z.pos, 1)}${z.posMin ? '*' : ''}</td><td class="num">${fmt(z.neg, 1)}${z.negMin ? '*' : ''}</td></tr>`)
        .join('')}</tbody></table>`;
    out.push({
      title: 'Components & cladding pressures (ASD)',
      html:
        (r.cc.wall ? zoneTable(r.cc.wall, 'Walls') : '') +
        (r.cc.roof ? zoneTable(r.cc.roof, `Roof - ${esc(r.cc.roofSource.source)}`) : '') +
        `<p class="formula">p = qh(ASD) x (GCp - GCpi). Zone width a = ${fmt(r.cc.a, 2)} ft. * = minimum pressure of ${fmt(b.pack.minCC * b.pack.asdFactor, 1)} psf governs.</p>`,
    });
  }

  if (r.cc.connections) {
    const c = r.cc.connections;
    out.push({
      title: 'Roof framing uplift connections',
      html:
        `<table class="tbl"><thead><tr><th>Zone</th><th>C&C suction at effective area (psf)</th><th>Net uplift per connection (lb)</th></tr></thead><tbody>${c.rows
          .map((z) => `<tr><td>${esc(z.label)}</td><td class="num">${fmt(z.pNeg, 1)}</td><td class="num">${fmt(z.uplift, 0)}</td></tr>`)
          .join('')}</tbody></table>` +
        `<p class="formula">Tributary area ${fmt(c.aTrib, 1)} sf = spacing x (span/2 + overhang); effective wind area ${fmt(c.aEff, 1)} sf = span x max(spacing, span/3). Uplift = |p| x A<sub>trib</sub> - 0.6 x roof D x A<sub>trib</sub>.</p>`,
    });
  }
  return out;
}

export function shedResults(project, { open = false } = {}) {
  const r = analyzeShed(project);
  if (!r.ok) return `${warnList(r.warnings)}<div class="empty">${esc(r.reason)}</div>`;
  const G = r.governing;
  const tiles = `<div class="tiles">
    <div class="tile"><span>qh (ASD)</span><b>${fmt(r.wind.qAsd, 1)}</b> psf</div>
    <div class="tile"><span>Base shear</span><b>${fmt(G.Vgov, 0)}</b> lb</div>
    <div class="tile"><span>Roof uplift</span><b>${fmt(G.Ugov, 0)}</b> lb</div>
    <div class="tile"><span>Min. foundation weight</span><b>${fmt(G.reqWf, 0)}</b> lb</div></div>`;
  const secs = shedSections(r)
    .map((s) => `<details class="card" ${open ? 'open' : ''}><summary>${esc(s.title)}</summary>${s.html}</details>`)
    .join('');
  return `${warnList(pageWarnings(r.warnings))}${overallSummary(r.checks)}${tiles}<div class="card"><h3>Pass / fail checks</h3>${checksTable(r.checks)}</div>${secs}`;
}

// --------------------------------------------------------------------------
// Fence
// --------------------------------------------------------------------------

export function fenceSections(r) {
  const f = r.force;
  const e = r.embed;
  const out = [];
  out.push({
    title: 'Wind force and post demand',
    html:
      kv([
        ['Velocity pressure qh (ASD) at fence top', `${fmt(r.wind.qAsd, 2)} psf`, `Kz ${fmt(r.wind.Kz, 3)}, Kd ${fmt(r.wind.Kd, 2)}`],
        ['B/s (run length / height)', fmt(f.Bs, 1)],
        ['Cf (Fig. 29.3-1, s/h = 1)', fmt(f.Cf, 2), 'Unverified table - confirm against the standard'],
        ['Porosity reduction', fmt(f.reduction, 3)],
        ['Net force coefficient used', fmt(f.cfNet, 3), f.cfSource],
        ['Wind force per foot of fence (calculated)', `${fmt(f.wCalc, 1)} plf`],
        ['Minimum force per foot (16 psf x 0.6)', `${fmt(f.wMin, 1)} plf`],
        ['Design force per foot', `${fmt(f.w, 1)} plf`, f.minGoverns ? 'Minimum governs' : ''],
        ['Force per post P', `${fmt(f.P, 0)} lb`, 'Tributary width = post spacing'],
        ['Height of P above grade', `${fmt(f.hArm, 2)} ft`, 'Mid-height of the panel'],
        ['Moment at grade M', `${fmt(f.M, 0)} lb-ft`],
        ['Allowable post moment Fb x CD x Sx', `${fmt(f.Mall, 0)} lb-ft`],
        ['Maximum post spacing from post bending', `${fmt(r.limits.sMaxBending, 1)} ft`],
      ]) + `<p class="formula">w = qh(ASD) x G x Cf,net x h = ${fmt(r.wind.qAsd, 2)} x ${fmt(r.wind.G, 2)} x ${fmt(f.cfNet, 3)} x ${fmt(f.h, 1)} ft = ${fmt(f.wCalc, 1)} plf</p>`,
  });
  out.push({
    title: 'Post embedment (IBC 1807.3.2.1 non-constrained)',
    html:
      kv([
        ['Effective width b', `${fmt(e.bFt, 2)} ft`],
        ['Lateral bearing (psf per ft)', `${fmt(e.lateral, 0)}`, e.factor === 2 ? 'Isolated-pole 2x applied' : 'No isolated-pole increase'],
        ['Required embedment', Number.isFinite(e.dReq) ? `${fmt(e.dReq, 2)} ft` : 'No solution', ''],
        ['Embedment provided', `${fmt(e.dProv, 2)} ft`],
      ]) + '<p class="formula">d = 0.5 A {1 + [1 + 4.36 h / A]<sup>1/2</sup>},&nbsp; A = 2.34 P / (S1 b),&nbsp; S1 = lateral bearing x (d/3)</p>',
  });
  out.push({
    title: 'Post spacing options (same footing and post)',
    html: `<table class="tbl"><thead><tr><th>Spacing (ft)</th><th>P (lb)</th><th>M (lb-ft)</th><th>Required embedment (ft)</th><th>Post bending</th></tr></thead><tbody>${r.table
      .map((t) => `<tr><td class="num">${t.spacing}</td><td class="num">${fmt(t.P, 0)}</td><td class="num">${fmt(t.M, 0)}</td><td class="num">${fmt(t.dReq, 2)}</td><td>${chip(t.bendingOk ? 'pass' : 'fail')}</td></tr>`)
      .join('')}</tbody></table>`,
  });
  return out;
}

export function fenceResults(project, { open = false } = {}) {
  const r = analyzeFence(project);
  if (!r.ok) return `${warnList(r.warnings)}<div class="empty">${esc(r.reason)}</div>`;
  const secs = fenceSections(r)
    .map((s) => `<details class="card" ${open ? 'open' : ''}><summary>${esc(s.title)}</summary>${s.html}</details>`)
    .join('');
  return `${warnList(pageWarnings(r.warnings))}${overallSummary(r.checks)}<div class="tiles">
    <div class="tile"><span>Wind force</span><b>${fmt(r.force.w, 0)}</b> plf</div>
    <div class="tile"><span>Force per post</span><b>${fmt(r.force.P, 0)}</b> lb</div>
    <div class="tile"><span>Required embedment</span><b>${fmt(r.embed.dReq, 1)}</b> ft</div></div>
    <div class="card"><h3>Pass / fail checks</h3>${checksTable(r.checks)}</div>${secs}`;
}

// --------------------------------------------------------------------------
// Components
// --------------------------------------------------------------------------

export function componentResults(project) {
  const r = analyzeComponents(project);
  if (!r.ok) return `${warnList(r.warnings)}<div class="empty">${esc(r.reason)}</div>`;
  const rows = r.results
    .map((c) =>
      c.error
        ? `<tr><td>${esc(c.label)}</td><td colspan="6" class="note">${esc(c.error)}</td></tr>`
        : `<tr><td>${esc(c.label)}</td><td>${esc(c.location)} ${esc(c.zone)}</td><td class="num">${fmt(c.area, 0)}</td><td class="num">${fmt(c.pos, 1)}</td><td class="num">${fmt(c.neg, 1)}</td><td class="num">${fmt(c.ratedPos, 0)}</td><td class="num">${fmt(c.ratedNeg, 0)}</td></tr>`
    )
    .join('');
  return `${warnList(r.warnings)}${overallSummary(r.checks)}<div class="card"><h3>Pass / fail checks</h3>${checksTable(r.checks)}</div>
    <div class="card"><h3>Demand at each component</h3><table class="tbl"><thead><tr><th>Component</th><th>Zone</th><th>Area (sf)</th><th>Toward (psf)</th><th>Away (psf)</th><th>Rated +</th><th>Rated -</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------

export function reportHTML(project) {
  const b = resolveBasis(project.code);
  const meta = project.meta || {};
  const shed = analyzeShed(project);
  const fence = analyzeFence(project);
  const comp = analyzeComponents(project);
  const allChecks = [...(shed.ok ? shed.checks : []), ...(fence.ok ? fence.checks : []), ...(comp.ok ? comp.checks : [])];
  const statuses = Object.entries(b.pack.statuses)
    .map(([k, v]) => `<tr><td>${esc(COEFF_LABELS[k] || k)}</td><td>${esc(STATUS[v])}</td></tr>`)
    .join('');
  const hasUnverified = Object.values(b.pack.statuses).some((s) => s === 'unverified');
  const banner =
    b.screeningOnly || hasUnverified
      ? `<div class="warnbox report-banner"><strong>SCREENING REPORT - NOT A SEALED CALCULATION.</strong> ${b.screeningOnly ? esc(b.warnings.find((w) => /SCREENING/.test(w)) || '') : ''} ${hasUnverified ? 'Some coefficient sets below are marked unverified and must be checked against the adopted standard.' : ''}</div>`
      : '';
  const head = [meta.name, meta.owner, meta.address, meta.preparedBy, meta.date].some((x) => String(x || '').trim())
    ? `<table class="tbl kv"><tbody>
        ${meta.name ? `<tr><td>Project</td><td>${esc(meta.name)}</td></tr>` : ''}
        ${meta.owner ? `<tr><td>Owner</td><td>${esc(meta.owner)}</td></tr>` : ''}
        ${meta.address ? `<tr><td>Site</td><td>${esc(meta.address)}</td></tr>` : ''}
        ${meta.preparedBy ? `<tr><td>Prepared by</td><td>${esc(meta.preparedBy)}</td></tr>` : ''}
        ${meta.date ? `<tr><td>Date</td><td>${esc(meta.date)}</td></tr>` : ''}
      </tbody></table>`
    : '<p class="muted">Project header left blank.</p>';

  const shedBlock = shed.ok
    ? `<h2>Shed: wind, uplift and foundation</h2>${warnList(shed.warnings.filter((w) => !/SCREENING/.test(w)))}${shedSections(shed)
        .map((s) => `<h3>${esc(s.title)}</h3>${s.html}`)
        .join('')}`
    : '';
  const fenceBlock = fence.ok
    ? `<h2>Fence: wind and post embedment</h2>${fenceSections(fence)
        .map((s) => `<h3>${esc(s.title)}</h3>${s.html}`)
        .join('')}`
    : '';
  const compBlock = comp.ok ? `<h2>Component ratings</h2>${componentResults(project)}` : '';

  return `<article class="report">
    <h1>Wind, Uplift and Foundation Calculations</h1>
    ${banner}
    ${head}
    <h2>Design summary</h2>
    ${overallSummary(allChecks)}
    ${checksTable(allChecks)}
    <h2>Design basis</h2>
    ${kv([
      ['Jurisdiction', esc(b.jurisdiction.label)],
      ['Code edition', esc(b.edition.label), `Wind standard adopted: ${b.edition.windStandard}`],
      ['Wind coefficient data used', esc(b.pack.label)],
      ['Vult / Risk Category / Exposure', `${fmt(b.V, 0)} mph / ${esc(b.riskCat)} / ${esc(b.exposure)}`, b.vultSource],
      ['Load combinations', 'ASD: D + L, D + 0.6W, 0.6D + 0.6W', 'ASCE 7 Sec. 2.4'],
      ['Concrete unit weight', '150 pcf'],
    ])}
    ${shedBlock}${fenceBlock}${compBlock}
    <h2>Coefficient verification</h2>
    <table class="tbl"><thead><tr><th>Data set</th><th>Status</th></tr></thead><tbody>${statuses}</tbody></table>
    <h2>Assumptions and limits</h2>
    <ul class="plain">
      <li>Method: ASD, ASCE 7 wind loads on a rigid low-rise structure (h &lt;= 60 ft), G = 0.85. Roof projected area is treated like wall for base shear (conservative).</li>
      <li>Roof MWFRS uplift uses the flat-roof Cp table; slopes of 10 degrees or more use an envelope floor on suction. Overhang underside pressure is added on the windward side.</li>
      <li>Foundation weight counts only when the structure is positively anchored to it. Slab reinforcement, sill plate and framing member design are outside this tool.</li>
      <li>Fence force uses a solid freestanding wall coefficient with clearance ratio s/h = 1 and no end-zone (oblique wind) increase; check end and corner posts separately.</li>
      <li>Soil values (bearing, friction, lateral bearing) and product capacities are user inputs. Cite their source in the submittal.</li>
      <li>This is a calculation aid. Results must be reviewed by the responsible design professional, and code requirements and wind speeds confirmed against the adopted editions and the plans examiner.</li>
    </ul>
    <p class="muted">Generated by Tiedown v0.1 &middot; ${new Date().toLocaleDateString('en-US')}</p>
  </article>`;
}

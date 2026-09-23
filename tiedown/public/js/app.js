// UI shell: pages, inputs, results, save/open. All data stays in the browser.

import { PAGES, CUSTOM_ZONE_COUNT } from './modules.js';
import { blankProject, sampleProject, clearIdentifyingData, identifyingFields } from './defaults.js';
import { getPath, setPath, loadLocal, saveLocal, mergeProject } from './state.js';
import { codeResults, shedResults, fenceResults, componentResults, reportHTML, esc } from './views.js';
import { resolveBasis, analyzeShed } from './engine/index.js';

let project = mergeProject(blankProject(), loadLocal() || {});
let pageId = 'code';
const openSections = new Set();

const $ = (sel) => document.querySelector(sel);
const main = $('#page');

// ---------------------------------------------------------------- nav / banner

function renderNav() {
  $('#nav').innerHTML = PAGES.map((p) => `<button type="button" data-page="${p.id}" ${p.id === pageId ? 'aria-current="page"' : ''}>${esc(p.title)}</button>`).join('');
}

function renderBanner() {
  const b = resolveBasis(project.code);
  const msgs = [];
  if (b.screeningOnly) msgs.push(`<strong>Screening only.</strong> ${esc(b.edition.label)} adopts ${esc(b.edition.windStandard)}; this build's wind coefficients are ${esc(b.pack.label)}.`);
  msgs.push('Some coefficient sets are marked unverified - see <a href="#" data-page="code">Project &amp; Code</a>.');
  $('#banner').innerHTML = `<div class="banner">${msgs.join(' ')}</div>`;
}

// ---------------------------------------------------------------- inputs

function fieldHTML(f) {
  if (f.showIf && !f.showIf(project)) return '';
  const val = getPath(project, f.path);
  const id = 'f-' + f.path.replace(/\./g, '-');
  let control;
  if (f.type === 'select') {
    control = `<select id="${id}" data-path="${f.path}">${f.options.map((o) => `<option value="${esc(o.v)}" ${String(val) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'checkbox') {
    control = `<input id="${id}" type="checkbox" data-path="${f.path}" ${val ? 'checked' : ''}>`;
  } else {
    control = `<input id="${id}" type="${f.type === 'number' ? 'number' : 'text'}" ${f.type === 'number' ? 'step="any" inputmode="decimal"' : ''} data-path="${f.path}" value="${esc(val)}" autocomplete="off">`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}${f.unit ? ` <span class="unit">(${esc(f.unit)})</span>` : ''}</label>${control}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
}

function customZonesHTML() {
  let rows = '';
  for (let i = 0; i < CUSTOM_ZONE_COUNT; i++) {
    const z = project.shed.customZones[i] || { name: '', pos: '', neg: '' };
    rows += `<div class="zoneline">
      <input data-path="shed.customZones.${i}.name" value="${esc(z.name)}" placeholder="Zone" aria-label="Zone name ${i + 1}">
      <input data-path="shed.customZones.${i}.pos" value="${esc(z.pos)}" placeholder="Toward: 10:0.3, 100:0.2" aria-label="Positive GCp curve ${i + 1}">
      <input data-path="shed.customZones.${i}.neg" value="${esc(z.neg)}" placeholder="Away: 10:-1.0, 100:-0.8" aria-label="Negative GCp curve ${i + 1}"></div>`;
  }
  return `<details class="card" ${openSections.has('custom-zones') ? 'open' : ''} data-key="custom-zones"><summary>Custom roof GCp curves (flat, mono-slope, or slopes outside 7-20 degrees)</summary>
    <p class="note">The built-in roof table covers gable roofs over 7 and up to 20 degrees. For anything else, enter the GCp values from the adopted standard as area:value pairs (square feet : coefficient). Values are joined on a log-area scale and held constant outside the range you enter. Include every breakpoint of the chart.</p>${rows}</details>`;
}

function componentsEditorHTML() {
  const pack = resolveBasis(project.code).pack;
  const s = analyzeShed(project);
  const roofKeys = s.ok && s.cc.roofSource ? Object.keys(s.cc.roofSource.zones) : Object.keys(pack.roofGable7to20.zones);
  const wallKeys = Object.keys(pack.wallCC.zones);
  const rows = project.components
    .map((c, i) => {
      const keys = c.location === 'wall' ? wallKeys : roofKeys;
      const zoneOpts = (keys.includes(c.zone) ? keys : [c.zone, ...keys].filter(Boolean)).map((k) => `<option ${k === c.zone ? 'selected' : ''}>${esc(k)}</option>`).join('');
      return `<div class="rowline">
        <input data-path="components.${i}.name" value="${esc(c.name)}" placeholder="Name" aria-label="Component name">
        <select data-path="components.${i}.location" aria-label="Location"><option value="roof" ${c.location !== 'wall' ? 'selected' : ''}>Roof</option><option value="wall" ${c.location === 'wall' ? 'selected' : ''}>Wall</option></select>
        <select data-path="components.${i}.zone" aria-label="Zone">${zoneOpts}</select>
        <input type="number" step="any" data-path="components.${i}.area" value="${esc(c.area)}" placeholder="Area sf" aria-label="Effective area">
        <input type="number" step="any" data-path="components.${i}.ratedPos" value="${esc(c.ratedPos)}" placeholder="Rated +" aria-label="Rated positive pressure">
        <input type="number" step="any" data-path="components.${i}.ratedNeg" value="${esc(c.ratedNeg)}" placeholder="Rated -" aria-label="Rated negative pressure">
        <input data-path="components.${i}.approval" value="${esc(c.approval)}" placeholder="FL# / NOA (optional)" aria-label="Approval number">
        <button type="button" class="small" data-remove="${i}" aria-label="Remove component">Remove</button></div>`;
    })
    .join('');
  return `<fieldset><legend>Components</legend>
    <div class="rowline head"><span>Name</span><span>Location</span><span>Zone</span><span>Area (sf)</span><span>Rated + (psf)</span><span>Rated - (psf)</span><span>Approval</span><span></span></div>
    ${rows || '<p class="muted">No components yet.</p>'}
    <p><button type="button" id="btn-add-comp">Add component</button></p>
    <p class="note">Enter each approved product's design pressure (ASD level) for its size. Negative ratings are pressures away from the surface. Effective area is the product's own area (a door, a panel).</p></fieldset>`;
}

function inputsHTML(page) {
  if (page.components) return componentsEditorHTML();
  const secs = page.sections
    .map((s) => `<fieldset><legend>${esc(s.title)}</legend>${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}${s.fields.map(fieldHTML).join('')}</fieldset>`)
    .join('');
  return secs + (page.custom ? customZonesHTML() : '');
}

// ---------------------------------------------------------------- results

function resultsHTML(page) {
  switch (page.id) {
    case 'code':
      return codeResults(project);
    case 'shed':
      return shedResults(project);
    case 'fence':
      return fenceResults(project);
    case 'components':
      return componentResults(project);
    default:
      return '';
  }
}

function applyOpenState(root) {
  root.querySelectorAll('details').forEach((d) => {
    const key = d.dataset.key || d.querySelector('summary')?.textContent;
    if (key && openSections.has(key)) d.open = true;
  });
}

function renderResults() {
  const page = PAGES.find((p) => p.id === pageId);
  const box = $('#results');
  if (!box) return;
  box.innerHTML = resultsHTML(page);
  applyOpenState(box);
}

function renderInputs() {
  const page = PAGES.find((p) => p.id === pageId);
  const box = $('#inputs');
  if (!box) return;
  const active = document.activeElement;
  const activePath = active?.dataset?.path;
  box.innerHTML = `<p class="intro">${esc(page.intro)}</p>` + inputsHTML(page);
  applyOpenState(box);
  if (activePath) {
    const again = box.querySelector(`[data-path="${activePath}"]`);
    again?.focus();
  }
}

function renderPage() {
  const page = PAGES.find((p) => p.id === pageId);
  renderNav();
  renderBanner();
  if (page.report) {
    main.className = 'single';
    main.innerHTML = `<div><p class="intro">${esc(page.intro)}</p><div class="report-actions"><button type="button" class="primary" id="btn-print">Print / Save PDF</button></div>${reportHTML(project)}</div>`;
  } else {
    main.className = '';
    main.innerHTML = '<section id="inputs"></section><section id="results"></section>';
    renderInputs();
    renderResults();
  }
  window.scrollTo(0, 0);
}

function afterChange(rerenderInputs) {
  saveLocal(project);
  renderBanner();
  if (rerenderInputs) renderInputs();
  renderResults();
}

// ---------------------------------------------------------------- events

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-page]');
  if (t) {
    e.preventDefault();
    pageId = t.dataset.page;
    renderPage();
    return;
  }
  if (e.target.id === 'btn-print') window.print();
  if (e.target.id === 'btn-add-comp') {
    project.components.push({ name: '', location: 'roof', zone: '', area: '', ratedPos: '', ratedNeg: '', approval: '' });
    afterChange(true);
  }
  const rm = e.target.closest('[data-remove]');
  if (rm) {
    project.components.splice(Number(rm.dataset.remove), 1);
    afterChange(true);
  }
});

main.addEventListener('input', (e) => {
  const el = e.target;
  const path = el.dataset?.path;
  if (!path || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  setPath(project, path, el.value);
  afterChange(false);
});

main.addEventListener('change', (e) => {
  const el = e.target;
  const path = el.dataset?.path;
  if (!path) return;
  if (el.tagName === 'SELECT' || el.type === 'checkbox') {
    setPath(project, path, el.type === 'checkbox' ? el.checked : el.value);
    afterChange(true);
  }
});

document.addEventListener(
  'toggle',
  (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement)) return;
    const key = d.dataset.key || d.querySelector('summary')?.textContent;
    if (!key) return;
    if (d.open) openSections.add(key);
    else openSections.delete(key);
  },
  true
);

$('#btn-sample').addEventListener('click', () => {
  if (!confirm('Replace the current project with the fictional sample?')) return;
  project = sampleProject();
  saveLocal(project);
  renderPage();
});

$('#btn-new').addEventListener('click', () => {
  if (!confirm('Start a blank project? Unsaved changes in this browser will be lost.')) return;
  project = blankProject();
  saveLocal(project);
  renderPage();
});

$('#btn-clear').addEventListener('click', () => {
  clearIdentifyingData(project);
  saveLocal(project);
  renderPage();
});

$('#btn-save').addEventListener('click', () => {
  const ids = identifyingFields(project);
  if (ids.length && !confirm(`This project has report-header fields filled in (${ids.join(', ')}). Save the file anyway?`)) return;
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tiedown-project.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#btn-open').addEventListener('click', () => $('#file-open').click());
$('#file-open').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const loaded = JSON.parse(await file.text());
    if (!loaded || typeof loaded !== 'object') throw new Error('bad file');
    project = mergeProject(blankProject(), loaded);
    saveLocal(project);
    renderPage();
  } catch {
    alert('That file could not be opened as a Tiedown project.');
  }
});

renderPage();

// Project state helpers: path get/set and local storage. Nothing leaves the browser.

const KEY = 'tiedown.project.v1';

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

export function loadLocal() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function saveLocal(project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    /* storage may be blocked; the app still works */
  }
}

/** Merge a loaded project over a blank one so older files still open. */
export function mergeProject(blank, loaded) {
  const out = JSON.parse(JSON.stringify(blank));
  const walk = (dst, src) => {
    for (const k of Object.keys(src || {})) {
      if (Array.isArray(src[k])) dst[k] = JSON.parse(JSON.stringify(src[k]));
      else if (src[k] && typeof src[k] === 'object') walk((dst[k] ??= {}), src[k]);
      else dst[k] = src[k];
    }
  };
  walk(out, loaded);
  return out;
}

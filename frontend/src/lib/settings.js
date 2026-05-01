import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

let _cache = null;
let _inflight = null;

export async function fetchAppSettings(force = false) {
  if (!force && _cache) return _cache;
  if (!_inflight) {
    _inflight = axios.get(`${BACKEND_URL}/api/app-settings`)
      .then((r) => { _cache = r.data; _inflight = null; return _cache; })
      .catch((err) => { _inflight = null; throw err; });
  }
  return _inflight;
}

export function clearAppSettingsCache() {
  _cache = null;
}

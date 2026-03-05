import { state, setState } from "../state.js";
import { safeJsonParse } from "../utils.js";
import { log } from "../ui/log.js";

const KEY = "spirelite_save";

export function saveRun() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    log("Saved run to localStorage.", "info");
  } catch {
    log("Save failed.", "bad");
  }
}

export function loadRun() {
  const raw = localStorage.getItem(KEY);
  if (!raw) { log("No save found.", "warn"); return false; }

  const loaded = safeJsonParse(raw);
  if (!loaded) { log("Load failed.", "bad"); return false; }

  loaded.player.status ||= { weak: 0, vuln: 0 };
  loaded.player.relics ||= [];
  setState(loaded);
  log("Loaded run.", "info");
  return true;
}

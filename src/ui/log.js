import { $ } from "../utils.js";

export function log(msg, cls = "info") {
  const logEl = $("log");
  const entry = document.createElement("div");
  entry.className = `entry ${cls}`;
  entry.textContent = msg;
  logEl.prepend(entry);
}

export function logClear() {
  $("log").innerHTML = "";
}

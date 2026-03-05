// src/main.js
import { state, setState, newRunState } from "./state.js";
import { $, choice, rint } from "./utils.js";

import "./content/cards.js";
import "./content/relics.js";

import { Cards } from "./content/cards.js";
import { Relics } from "./content/relics.js";
import { EnemyDefs } from "./content/enemies.js";
import { RoomTypes } from "./content/rooms.js";
import { generateEvent } from "./content/events.js";

import { log, logClear } from "./ui/log.js";
import { bindModal, openModal } from "./ui/modal.js";
import {
  renderAll,
  modalDeckView,
  modalPickCards,
  modalUpgradePick,
  modalRemovePick,
  statusLine,
  intentText,
  renderCardDom,
} from "./ui/render.js";

import {
  addToDeck,
  startCombat,
  playCardFromHand,
  endPlayerTurn,
  makePlayable,
  livingEnemies,
} from "./systems/combat.js";

import {
  generateRewards,
  randomRelic,
  gainRelic,
  triggerRelics,
  randomCardOffer,
} from "./systems/rewards.js";

import { enterShop, buyShopItem } from "./systems/shop.js";
import { saveRun, loadRun } from "./systems/save.js";

import {
  cardArtUri,
  enemyPortraitUri,
  intentIcon,
  rarityClass,
  typeFrameClass,
} from "./visuals/svg.js";

/* ---------------- Weighted helpers ---------------- */
function weightedPick(weights) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [t, w] of weights) {
    roll -= w;
    if (roll <= 0) return t;
  }
  return weights[0][0];
}

function rollRoomTypeForRow(row, totalRows) {
  // Start: fight. End: elite (boss-lite)
  if (row === 0) return "battle";
  if (row === totalRows - 1) return "elite";

  // Slightly combat-leaning early, more variety later
  const weights = [
    ["battle", 44],
    ["elite", row > 2 ? 12 : 6],
    ["shop", 14],
    ["rest", 14],
    ["event", 10],
    ["treasure", 8],
    ["forge", 8],
    ["curse", 6],
  ];
  return weightedPick(weights);
}

/* ---------------- Map generation ---------------- */
function buildNewMap({ rows = 8, cols = 4 } = {}) {
  const nodes = {};
  const rowNodes = [];

  const nodeId = (r, c) => `r${r}c${c}`;

  for (let r = 0; r < rows; r++) {
    const count = (r === 0) ? 1 : (r === rows - 1 ? 1 : cols);
    rowNodes[r] = [];

    for (let c = 0; c < count; c++) {
      // center start/end
      const col = (r === 0 || r === rows - 1) ? Math.floor(cols / 2) : c;
      const id = nodeId(r, col);

      if (nodes[id]) { rowNodes[r].push(id); continue; }

      nodes[id] = {
        id,
        row: r,
        col,
        type: rollRoomTypeForRow(r, rows),
        next: [],
        visited: false,
      };
      rowNodes[r].push(id);
    }
  }

  // Connect rows with branching paths
  for (let r = 0; r < rows - 1; r++) {
    for (const id of rowNodes[r]) {
      const n = nodes[id];
      const nextRow = rowNodes[r + 1];

      const outCount =
        (r === 0) ? 2 :
        (r >= rows - 3) ? 1 :
        (Math.random() < 0.55 ? 2 : 1);

      // bias toward same/near col
      const candidates = [...nextRow].sort((a, b) => {
        const da = Math.abs(nodes[a].col - n.col);
        const db = Math.abs(nodes[b].col - n.col);
        return da - db;
      });

      const picks = [];
      for (let i = 0; i < candidates.length && picks.length < outCount; i++) {
        if (Math.random() < (i === 0 ? 0.85 : 0.55)) picks.push(candidates[i]);
      }
      if (!picks.length) picks.push(candidates[0]);

      n.next = [...new Set(picks)];
    }
  }

  const startId = rowNodes[0][0];
  nodes[startId].visited = true;

  return {
    rows,
    cols,
    nodes,
    startId,
    currentId: startId,
    selectable: [...nodes[startId].next],
    previewId: null,
  };
}

/* ---------------- Encounter generation ---------------- */
function generateEncounter(kind = "battle") {
  const depth = state.floor;
  const pool = ["slime", "cultist", "fang", "golem", "seer", "wisp", "brute", "mimic"];

  const enemyCount =
    kind === "elite" ? rint(2, 3) :
    depth < 3 ? rint(1, 2) :
    rint(2, 3);

  const enemies = [];
  for (let i = 0; i < enemyCount; i++) enemies.push(EnemyDefs[choice(pool)]);

  return {
    name: kind === "elite" ? "Elite Pack" : "Battle",
    kind,
    enemies: enemies.map(e => ({
      ...e,
      maxHp: e.maxHp + (kind === "elite" ? 10 : 0) + Math.floor((depth - 1) * 1.5),
    })),
  };
}

/* ---------------- Flow helpers ---------------- */
function advanceFloor() {
  state.floor += 1;
  triggerRelics("onNewFloor");
}

function endRoomAndGoMap() {
  advanceFloor();

  state.phase = "map";
  state.pendingRewards = null;
  state.shop = null;
  state.event = null;
  state.treasure = null;

  // Unlock next nodes from current node
  const m = state.map;
  if (m) {
    const cur = m.nodes[m.currentId];
    m.selectable = [...(cur?.next || [])];
    m.previewId = null;
  }

  if (state.floor % 5 === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 4);
    log("Milestone breather: +4 HP.", "good");
  }

  renderAll(renderScreen);
}

function enterNode(nodeId) {
  const m = state.map;
  const node = m.nodes[nodeId];
  const type = node.type;

  m.currentId = nodeId;
  node.visited = true;
  m.selectable = []; // lock until room ends
  m.previewId = null;

  const rt = RoomTypes[type];
  log(`Entered: ${rt.name}`, "info");

  if (type === "battle") startCombat(generateEncounter("battle"));
  else if (type === "elite") startCombat(generateEncounter("elite"));
  else if (type === "shop") enterShop();
  else if (type === "rest") state.phase = "rest";
  else if (type === "event") { state.phase = "event"; state.event = generateEvent(); }
  else if (type === "treasure") {
    state.phase = "treasure";
    state.treasure = Math.random() < 0.65
      ? { kind: "relic", id: randomRelic(), text: "A relic rests on velvet." }
      : { kind: "gold", gold: rint(60, 120), text: "A heavy gold pouch." };
  }
  else if (type === "forge") state.phase = "forge";
  else if (type === "curse") state.phase = "curse";

  renderAll(renderScreen);
}

/* ---------------- Combat results ---------------- */
function winCombat() {
  const kind = state.lastCombatKind || "battle";
  const gold = kind === "elite" ? rint(35, 55) : rint(18, 32);
  state.player.gold += gold;
  log(`Won combat! +${gold} gold.`, "good");

  triggerRelics("onCombatWin");

  state.phase = "reward";
  state.pendingRewards = generateRewards(kind);
  state.combat = null;

  renderAll(renderScreen);
}

function loseCombat() {
  state.phase = "gameover";
  log("You were defeated. Run over.", "bad");
  renderAll(renderScreen);
}

/* ---------------- Screens router ---------------- */
function renderScreen() {
  const screen = $("screen");
  screen.innerHTML = "";

  if (state.phase === "map") return screen.appendChild(screenMap());
  if (state.phase === "combat") return screen.appendChild(screenCombat());
  if (state.phase === "reward") return screen.appendChild(screenReward());
  if (state.phase === "shop") return screen.appendChild(screenShop());
  if (state.phase === "rest") return screen.appendChild(screenRest());
  if (state.phase === "event") return screen.appendChild(screenEvent());
  if (state.phase === "treasure") return screen.appendChild(screenTreasure());
  if (state.phase === "forge") return screen.appendChild(screenForge());
  if (state.phase === "curse") return screen.appendChild(screenCurse());
  if (state.phase === "gameover") return screen.appendChild(screenGameOver());
}

/* ---- MAP (branching + preview next rooms) ---- */
/* ---- MAP (branching + preview next rooms) ---- */
function screenMap() {
  const wrap = document.createElement("div");
  const m = state.map;

  const head = document.createElement("div");
  head.className = "roomCard";
  head.innerHTML = `
    <h3>Map</h3>
    <p>Click a node to preview. Click it again to enter (if it’s one of your available next nodes).</p>
    <div class="roomMeta">
      <span class="badge">Floor: ${state.floor}</span>
      <span class="badge">HP: ${state.player.hp}/${state.player.maxHp}</span>
      <span class="badge">Gold: ${state.player.gold}</span>
      <span class="badge">Deck: ${state.player.deck.length}</span>
    </div>
  `;
  wrap.appendChild(head);

  // Emoji icons per room type
  const iconFor = (type) => ({
    battle: "⚔️",
    elite: "💀",
    shop: "🛒",
    rest: "🩹",
    event: "❓",
    treasure: "💎",
    forge: "🔥",
    curse: "☠️",
  }[type] || "⬤");

  // ---- One shared coordinate space for BOTH svg + nodes ----
  const cols = m.cols;
  const rows = m.rows;

  const cellW = 120;
  const cellH = 90;
  const padX = 30;
  const padY = 20;
  const width = padX * 2 + (cols - 1) * cellW + 60;
  const height = padY * 2 + (rows - 1) * cellH + 60;

  const mapWrap = document.createElement("div");
  mapWrap.className = "mapBox";
  // inline layout so it works even if your CSS is missing/broken
  mapWrap.style.position = "relative";
  mapWrap.style.overflow = "auto";
  mapWrap.style.borderRadius = "16px";
  mapWrap.style.border = "1px solid rgba(255,255,255,0.10)";
  mapWrap.style.background = "rgba(0,0,0,0.18)";
  mapWrap.style.padding = "10px";

  // A single inner stage that both layers use
  const stage = document.createElement("div");
  stage.style.position = "relative";
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;

  // SVG lines layer (absolute)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;

  const getXY = (node) => ({
    x: padX + node.col * cellW + 30,
    y: padY + node.row * cellH + 30,
  });

  const preview = m.previewId ? m.nodes[m.previewId] : null;
  const previewNext = preview ? new Set(preview.next) : null;

  // Draw edges
  for (const id in m.nodes) {
    const n = m.nodes[id];
    const a = getXY(n);

    for (const nid of n.next) {
      const b = getXY(m.nodes[nid]);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);

      // Styling:
      // - thicker from preview node
      // - slightly brighter from current node
      const isFromCurrent = (id === m.currentId);
      const isFromPreview = (m.previewId && id === m.previewId);

      line.setAttribute("stroke", isFromPreview ? "rgba(255,255,255,0.60)"
                        : isFromCurrent ? "rgba(255,255,255,0.35)"
                        : "rgba(255,255,255,0.18)");
      line.setAttribute("stroke-width", isFromPreview ? "4" : (isFromCurrent ? "3.5" : "3"));

      svg.appendChild(line);
    }
  }

  // Node layer (absolute)
  const nodeLayer = document.createElement("div");
  nodeLayer.style.position = "absolute";
  nodeLayer.style.left = "0";
  nodeLayer.style.top = "0";
  nodeLayer.style.width = `${width}px`;
  nodeLayer.style.height = `${height}px`;

  for (const id in m.nodes) {
    const n = m.nodes[id];
    const { x, y } = getXY(n);
    const rt = RoomTypes[n.type];

    const isSelectable = m.selectable.includes(id);
    const isCurrent = (id === m.currentId);
    const isVisited = n.visited;
    const isNextFromPreview = previewNext ? previewNext.has(id) : false;

    const btn = document.createElement("button");
    btn.className = "mapNode";
    btn.style.position = "absolute";
    btn.style.left = `${x - 18}px`;
    btn.style.top = `${y - 18}px`;
    btn.style.width = "36px";
    btn.style.height = "36px";
    btn.style.borderRadius = "999px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "900";
    btn.style.border = "1px solid rgba(255,255,255,0.18)";
    btn.style.background = "rgba(15,18,30,0.88)";
    btn.style.color = "rgba(255,255,255,0.90)";
    btn.style.transition = "transform 0.08s ease";

    // Visual states (no CSS required)
    if (isSelectable) btn.style.border = "1px solid rgba(255,255,255,0.55)";
    if (isCurrent) btn.style.outline = "2px solid rgba(255,255,255,0.65)";
    if (isVisited) btn.style.opacity = "0.65";
    if (isNextFromPreview) btn.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.25)";

    btn.title = `${rt.name}`;
    btn.textContent = iconFor(n.type);

    btn.onmouseenter = () => (btn.style.transform = "scale(1.08)");
    btn.onmouseleave = () => (btn.style.transform = "scale(1.00)");

    btn.onclick = () => {
      // If it's selectable:
      // - first click previews
      // - second click enters
      if (isSelectable) {
        if (m.previewId === id) {
          enterNode(id);
          return;
        }
        m.previewId = id;
        renderAll(renderScreen);
        return;
      }

      // Not selectable: preview only (planning ahead)
      m.previewId = id;
      renderAll(renderScreen);
    };

    nodeLayer.appendChild(btn);
  }

  stage.appendChild(svg);
  stage.appendChild(nodeLayer);
  mapWrap.appendChild(stage);
  wrap.appendChild(mapWrap);

  // Preview panel
  const panel = document.createElement("div");
  panel.className = "roomCard";

  const p = m.previewId ? m.nodes[m.previewId] : null;
  if (!p) {
    panel.innerHTML = `<h3>Preview</h3><p>Click a node to see where it leads.</p>`;
  } else {
    const rt = RoomTypes[p.type];
    const canEnter = m.selectable.includes(p.id);

    const nextNames = (p.next || []).map(nid => {
      const t = m.nodes[nid].type;
      return `${iconFor(t)} ${RoomTypes[t].name}`;
    });

    panel.innerHTML = `
      <h3>Preview: ${iconFor(p.type)} ${rt.name}</h3>
      <p>${rt.desc}</p>
      <div class="roomMeta">
        <span class="badge ${rt.badge[1]}">${rt.badge[0]}</span>
        <span class="badge">${canEnter ? "Enterable now" : "Not enterable yet"}</span>
      </div>
      <p><strong>Possible next rooms from here:</strong><br>${nextNames.length ? nextNames.join(" • ") : "(end)"}</p>
    `;

    const row = document.createElement("div");
    row.className = "row";

    const enterBtn = document.createElement("button");
    enterBtn.className = "btn";
    enterBtn.textContent = canEnter ? `Enter ${rt.name}` : "Can't enter this yet";
    enterBtn.disabled = !canEnter;
    enterBtn.onclick = () => enterNode(p.id);

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn ghost";
    clearBtn.textContent = "Clear preview";
    clearBtn.onclick = () => { m.previewId = null; renderAll(renderScreen); };

    row.appendChild(enterBtn);
    row.appendChild(clearBtn);
    panel.appendChild(row);
  }

  wrap.appendChild(panel);
  return wrap;
}

/* ---- COMBAT ---- */
function screenCombat() {
  const wrap = document.createElement("div");

  const top = document.createElement("div");
  top.className = "combatTop";

  const left = document.createElement("div");
  left.className = "roomCard";
  left.innerHTML = `
    <h3>Combat — Turn ${state.combat.turn}</h3>
    <p>Click an enemy to target it.</p>
    <div class="roomMeta">
      <span class="badge">Energy: ${state.player.energy}</span>
      <span class="badge">Strength: ${state.player.str}</span>
      <span class="badge">Hand: ${state.player.hand.length}</span>
    </div>
  `;

  const btnEnd = document.createElement("button");
  btnEnd.className = "btn danger";
  btnEnd.textContent = "End Turn";
  btnEnd.onclick = () => {
    endPlayerTurn({ onWin: winCombat, onLose: loseCombat });
    renderAll(renderScreen);
  };

  left.appendChild(btnEnd);
  top.appendChild(left);

  const enemiesWrap = document.createElement("div");
  enemiesWrap.className = "enemyWrap";

  state.combat.enemies.forEach((e, i) => {
    const el = document.createElement("div");
    el.className = "enemy";
    if (state.combat.selectedTarget === i) el.classList.add("selected");

    const hpPct = Math.floor((e.hp / e.maxHp) * 100);
    el.innerHTML = `
      <div class="enemyTop">
        <div class="enemyPortrait">
          <img src="${enemyPortraitUri(e.id)}" alt="${e.name}">
        </div>
        <div>
          <div class="enemyName">${e.name}</div>
          <div class="enemyHP">${e.hp} / ${e.maxHp} ${e.block ? `• Block ${e.block}` : ""}</div>
        </div>
      </div>

      <div class="enemyBar"><div class="enemyFill" style="width:${hpPct}%;"></div></div>

      <div class="enemyLine">
        <span>Status: ${statusLine(e.status)}</span>
        <span class="intent">
          <span class="intentIcon">${intentIcon(e.intent)}</span>
          ${intentText(e.intent)}
        </span>
      </div>
    `;

    el.onclick = () => {
      state.combat.selectedTarget = i;
      renderAll(renderScreen);
    };

    enemiesWrap.appendChild(el);
  });

  top.appendChild(enemiesWrap);
  wrap.appendChild(top);

  const hand = document.createElement("div");
  hand.className = "hand";
  hand.innerHTML = `
    <div class="handHead">
      <div><strong>Your Hand</strong> <span class="pill">Click a card to play</span></div>
    </div>
  `;

  const cardsRow = document.createElement("div");
  cardsRow.className = "handCards";

  state.player.hand.forEach((inst, idx) => {
    const c = makePlayable(inst);
    const playable = c.cost <= state.player.energy;

    const base = Cards[inst.baseId];
    const rarity = rarityClass(base.rarity);
    const frame = typeFrameClass(base.type);

    const card = document.createElement("div");
    card.className = `card cardGlow ${rarity} ${playable ? "playable" : "unplayable"}`;
    card.innerHTML = `
      <div class="cardFrame ${frame}"></div>
      <div class="cardArt"><img src="${cardArtUri(inst.baseId, base.type)}" alt=""></div>
      <div class="top">
        <div class="name">${c.displayName}</div>
        <div class="cost">${c.cost}</div>
      </div>
      <div class="type">
        <span>${c.type} • ${base.rarity}</span>
        <span>${inst.upgraded ? `<span class="tag up">UPGRADED</span>` : ""}</span>
      </div>
      <div class="desc">${c.displayDesc}</div>
      <div class="tags">${(c.tags || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
    `;

    card.onclick = () => {
      if (!playable) return;
      playCardFromHand(idx, state.combat.selectedTarget);

      if (livingEnemies().length === 0) return winCombat();

      renderAll(renderScreen);
    };

    cardsRow.appendChild(card);
  });

  hand.appendChild(cardsRow);
  wrap.appendChild(hand);

  return wrap;
}

/* ---- REWARD ---- */
function screenReward() {
  const wrap = document.createElement("div");

  const head = document.createElement("div");
  head.className = "roomCard";
  head.innerHTML = `
    <h3>Choose a reward</h3>
    <p>Pick exactly one.</p>
    <div class="roomMeta">
      <span class="badge">Gold: ${state.player.gold}</span>
      <span class="badge">Deck: ${state.player.deck.length}</span>
    </div>
  `;
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "choiceGrid";

  state.pendingRewards.forEach((r) => {
    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `
      <div class="roomMeta">
        <span class="badge ${r.kind === "relic" ? "good" : r.kind === "upgrade" ? "warn" : ""}">
          ${r.kind.toUpperCase()}
        </span>
      </div>
      <h3>${r.title}</h3>
      <p>${r.desc}</p>
    `;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Choose";

    btn.onclick = () => {
      if (r.kind === "card") {
        openModal("Pick a card", modalPickCards(r.picks, (id) => {
          r.apply(id);
          endRoomAndGoMap();
        }));
        return;
      }

      if (r.kind === "upgrade") {
        openModal("Upgrade a card", modalUpgradePick((idx) => {
          r.apply(idx);
          endRoomAndGoMap();
        }));
        return;
      }

      r.apply();
      endRoomAndGoMap();
    };

    card.appendChild(btn);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);

  const skip = document.createElement("button");
  skip.className = "btn ghost";
  skip.textContent = "Skip reward";
  skip.onclick = () => endRoomAndGoMap();
  wrap.appendChild(skip);

  return wrap;
}

/* ---- SHOP ---- */
function screenShop() {
  const wrap = document.createElement("div");

  const head = document.createElement("div");
  head.className = "roomCard";
  head.innerHTML = `
    <h3>Shop</h3>
    <p>Buy cards/relics, heal, or remove a card.</p>
    <div class="roomMeta">
      <span class="badge good">Gold: ${state.player.gold}</span>
    </div>
  `;
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "choiceGrid";

  // Cards
  const cardBox = document.createElement("div");
  cardBox.className = "roomCard";
  cardBox.innerHTML = `<h3>Cards</h3><p>Click to buy.</p>`;
  const cg = document.createElement("div");
  cg.className = "cardGrid";

  state.shop.cards.forEach((it) => {
    const el = renderCardDom(it.id, false, true, () => {
      buyShopItem(it);
      renderAll(renderScreen);
    }, `${it.price}g`);
    cg.appendChild(el);
  });

  cardBox.appendChild(cg);
  grid.appendChild(cardBox);

  // Relics
  const relicBox = document.createElement("div");
  relicBox.className = "roomCard";
  relicBox.innerHTML = `<h3>Relics</h3><p>Click to buy.</p>`;
  const rg = document.createElement("div");
  rg.className = "cardGrid";

  state.shop.relics.forEach((it) => {
    const r = Relics[it.id];
    const el = document.createElement("div");
    el.className = "card playable";
    el.innerHTML = `
      <div class="top"><div class="name">${r.name}</div><div class="cost">${it.price}g</div></div>
      <div class="type"><span>Relic • ${r.rarity}</span></div>
      <div class="desc">${r.desc}</div>
    `;
    el.onclick = () => {
      buyShopItem(it);
      renderAll(renderScreen);
    };
    rg.appendChild(el);
  });

  relicBox.appendChild(rg);
  grid.appendChild(relicBox);

  wrap.appendChild(grid);

  // Services
  const services = document.createElement("div");
  services.className = "roomCard";
  services.innerHTML = `<h3>Services</h3><p>Healing and removing are strong.</p>`;

  const row = document.createElement("div");
  row.className = "row";

  const healPrice = state.shop.healPrice ?? 45;
  const removePrice = state.shop.removePrice ?? 60;

  const healBtn = document.createElement("button");
  healBtn.className = "btn good";
  healBtn.textContent = `Heal 15 HP (${healPrice}g)`;
  healBtn.disabled = state.player.gold < healPrice || state.player.hp >= state.player.maxHp;
  healBtn.onclick = () => {
    if (state.player.gold < healPrice) return;
    state.player.gold -= healPrice;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);
    log("Healed 15.", "good");
    renderAll(renderScreen);
  };

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn warn";
  removeBtn.textContent = `Remove a card (${removePrice}g)`;
  removeBtn.disabled = state.player.gold < removePrice || state.player.deck.length <= 1;
  removeBtn.onclick = () => {
    openModal("Remove a card", modalRemovePick((idx) => {
      if (state.player.gold < removePrice) { log("Not enough gold.", "warn"); return; }
      state.player.gold -= removePrice;
      const removed = state.player.deck.splice(idx, 1)[0];
      log(`Removed ${removed ? removed.baseId : "card"}.`, "good");
      renderAll(renderScreen);
    }));
  };

  row.appendChild(healBtn);
  row.appendChild(removeBtn);
  services.appendChild(row);

  const leave = document.createElement("button");
  leave.className = "btn";
  leave.textContent = "Leave shop";
  leave.onclick = () => endRoomAndGoMap();
  services.appendChild(leave);

  wrap.appendChild(services);

  return wrap;
}

/* ---- REST ---- */
function screenRest() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "roomCard";

  const healAmount = Math.floor(state.player.maxHp * 0.28);

  card.innerHTML = `
    <h3>Rest Site</h3>
    <p>Heal or upgrade a card.</p>
    <div class="roomMeta">
      <span class="badge good">HP: ${state.player.hp}/${state.player.maxHp}</span>
    </div>
  `;

  const row = document.createElement("div");
  row.className = "row";

  const healBtn = document.createElement("button");
  healBtn.className = "btn good";
  healBtn.textContent = `Rest (+${healAmount} HP)`;
  healBtn.disabled = state.player.hp >= state.player.maxHp;
  healBtn.onclick = () => {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    endRoomAndGoMap();
  };

  const upBtn = document.createElement("button");
  upBtn.className = "btn warn";
  upBtn.textContent = "Smith (Upgrade a card)";
  upBtn.onclick = () => {
    openModal("Upgrade a card", modalUpgradePick((idx) => {
      const inst = state.player.deck[idx];
      const base = Cards[inst.baseId];
      if (!inst || inst.upgraded || !base.upgrade) return;
      inst.upgraded = true;
      log(`Upgraded ${inst.baseId}+`, "good");
      endRoomAndGoMap();
    }));
  };

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn";
  leaveBtn.textContent = "Leave";
  leaveBtn.onclick = () => endRoomAndGoMap();

  row.appendChild(healBtn);
  row.appendChild(upBtn);
  row.appendChild(leaveBtn);

  card.appendChild(row);
  wrap.appendChild(card);
  return wrap;
}

/* ---- EVENT ---- */
function applyEventChoice(opt) {
  const kind = opt.kind;

  if (kind === "heal") {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + (opt.amount || 0));
    log(`Healed ${opt.amount}.`, "good");
    return;
  }

  if (kind === "card") {
    const id = randomCardOffer(1)[0];
    state.player.deck.push({ baseId: id, upgraded: false });
    log(`Found ${Cards[id].name}.`, "good");
    return;
  }

  if (kind === "relic_hp") {
    state.player.hp = Math.max(1, state.player.hp - (opt.amount || 0));
    gainRelic(randomRelic());
    log(`You paid HP for power.`, "warn");
    return;
  }

  if (kind === "gold_vuln") {
    state.player.gold += (opt.gold || 0);
    state.player.status.vuln = (state.player.status.vuln || 0) + (opt.vuln || 0);
    log(`Gained ${opt.gold} gold, but became Vulnerable.`, "warn");
    return;
  }

  if (kind === "trade_upgrade") {
    const cost = opt.gold || 0;
    if (state.player.gold < cost) { log("Not enough gold.", "warn"); return; }
    state.player.gold -= cost;
    const upgradable = state.player.deck.filter(x => !x.upgraded && !!Cards[x.baseId].upgrade);
    if (!upgradable.length) { log("No cards to upgrade.", "warn"); return; }
    choice(upgradable).upgraded = true;
    log("Upgraded a random card.", "good");
    return;
  }

  if (kind === "buy_card") {
    const cost = opt.gold || 0;
    if (state.player.gold < cost) { log("Not enough gold.", "warn"); return; }
    state.player.gold -= cost;
    const id = randomCardOffer(1)[0];
    state.player.deck.push({ baseId: id, upgraded: false });
    log(`Bought ${Cards[id].name}.`, "good");
    return;
  }

  // extra event kinds we added
  if (kind === "gold") {
    state.player.gold += (opt.gold || 0);
    log(`Gained ${opt.gold} gold.`, "good");
    return;
  }

  if (kind === "card_upgrade") {
    const id = randomCardOffer(1)[0];
    state.player.deck.push({ baseId: id, upgraded: true });
    log(`Studied and found ${Cards[id].name}+`, "good");
    return;
  }

  if (kind === "relic_weak") {
    gainRelic(randomRelic());
    state.player.status.weak = (state.player.status.weak || 0) + (opt.weak || 0);
    log(`Power gained, but you feel Weak.`, "warn");
    return;
  }

  if (kind === "gold_hp") {
    state.player.gold += (opt.gold || 0);
    state.player.hp = Math.max(1, state.player.hp - (opt.hp || 0));
    log(`Salvaged ${opt.gold} gold, but lost HP.`, "warn");
    return;
  }

  log("You move on.", "info");
}

function screenEvent() {
  const wrap = document.createElement("div");
  const e = state.event;

  const card = document.createElement("div");
  card.className = "roomCard";
  card.innerHTML = `<h3>${e.title}</h3><p>${e.text}</p>`;

  const row = document.createElement("div");
  row.className = "row";

  e.options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = opt.label;
    b.onclick = () => {
      applyEventChoice(opt);
      endRoomAndGoMap();
    };
    row.appendChild(b);
  });

  card.appendChild(row);
  wrap.appendChild(card);
  return wrap;
}

/* ---- TREASURE ---- */
function screenTreasure() {
  const wrap = document.createElement("div");
  const t = state.treasure;

  const card = document.createElement("div");
  card.className = "roomCard";
  card.innerHTML = `<h3>Treasure</h3><p>${t.text}</p>`;

  const b = document.createElement("button");
  b.className = "btn good";
  b.textContent = "Claim";
  b.onclick = () => {
    if (t.kind === "relic") {
      gainRelic(t.id);
    } else {
      state.player.gold += t.gold;
      log(`+${t.gold} gold.`, "good");
    }
    endRoomAndGoMap();
  };

  card.appendChild(b);
  wrap.appendChild(card);
  return wrap;
}

/* ---- FORGE ---- */
function screenForge() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "roomCard";
  card.innerHTML = `<h3>Forge</h3><p>Upgrade a card for free, or transmute one card into a random card.</p>`;

  const row = document.createElement("div");
  row.className = "row";

  const upgradeBtn = document.createElement("button");
  upgradeBtn.className = "btn warn";
  upgradeBtn.textContent = "Upgrade a card (free)";
  upgradeBtn.onclick = () => {
    openModal("Upgrade a card", modalUpgradePick((idx) => {
      const inst = state.player.deck[idx];
      const base = Cards[inst.baseId];
      if (!inst || inst.upgraded || !base.upgrade) return;
      inst.upgraded = true;
      log(`Forged: upgraded ${base.name}.`, "good");
      endRoomAndGoMap();
    }));
  };

  const transmuteBtn = document.createElement("button");
  transmuteBtn.className = "btn good";
  transmuteBtn.textContent = "Transmute a card";
  transmuteBtn.onclick = () => {
    openModal("Pick a card to transmute", modalRemovePick((idx) => {
      const removed = state.player.deck.splice(idx, 1)[0];
      const newId = randomCardOffer(1)[0];
      state.player.deck.push({ baseId: newId, upgraded: false });
      log(`Transmuted ${removed.baseId} → ${Cards[newId].name}`, "good");
      endRoomAndGoMap();
    }));
  };

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn";
  leaveBtn.textContent = "Leave";
  leaveBtn.onclick = () => endRoomAndGoMap();

  row.appendChild(upgradeBtn);
  row.appendChild(transmuteBtn);
  row.appendChild(leaveBtn);

  card.appendChild(row);
  wrap.appendChild(card);
  return wrap;
}

/* ---- CURSE ---- */
function screenCurse() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "roomCard";

  card.innerHTML = `
    <h3>Cursed Hall</h3>
    <p>A cold presence offers a deal. It feels like a terrible idea (so… a great idea).</p>
  `;

  const row = document.createElement("div");
  row.className = "row";

  const takeBtn = document.createElement("button");
  takeBtn.className = "btn bad";
  takeBtn.textContent = "Accept the curse (gain a relic, lose 12 HP)";
  takeBtn.onclick = () => {
    state.player.hp = Math.max(1, state.player.hp - 12);
    gainRelic(randomRelic());
    state.player.status.vuln = (state.player.status.vuln || 0) + 2;
    log("A curse clings to you… but power follows.", "warn");
    endRoomAndGoMap();
  };

  const fightBtn = document.createElement("button");
  fightBtn.className = "btn warn";
  fightBtn.textContent = "Defy it (Elite fight for big rewards)";
  fightBtn.onclick = () => {
    startCombat(generateEncounter("elite"));
    renderAll(renderScreen);
  };

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn";
  leaveBtn.textContent = "Back away";
  leaveBtn.onclick = () => endRoomAndGoMap();

  row.appendChild(takeBtn);
  row.appendChild(fightBtn);
  row.appendChild(leaveBtn);
  card.appendChild(row);
  wrap.appendChild(card);
  return wrap;
}

/* ---- GAMEOVER ---- */
function screenGameOver() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "roomCard";
  card.innerHTML = `
    <h3>Run Over</h3>
    <p>You reached floor <strong>${state.floor}</strong> with ${state.player.relics.length} relic(s).</p>
  `;

  const row = document.createElement("div");
  row.className = "row";

  const restart = document.createElement("button");
  restart.className = "btn";
  restart.textContent = "Start New Run";
  restart.onclick = () => newRun();

  const deck = document.createElement("button");
  deck.className = "btn ghost";
  deck.textContent = "View Deck";
  deck.onclick = () => openModal("Your Deck", modalDeckView());

  row.appendChild(restart);
  row.appendChild(deck);
  card.appendChild(row);

  wrap.appendChild(card);
  return wrap;
}

/* ---------------- New Run ---------------- */
function newRun() {
  setState(newRunState());
  logClear();
  log("New run started.", "info");

  addToDeck("strike", 5);
  addToDeck("defend", 5);
  addToDeck("bash", 1);

  gainRelic(randomRelic(["luckycoin", "ironheart", "swiftgloves", "matchstick"]));
  triggerRelics("onNewFloor");

  // NEW: map
  state.map = buildNewMap({ rows: 8, cols: 4 });

  renderAll(renderScreen);
}

/* ---------------- UI binds ---------------- */
function bindUI() {
  $("btnNewRun").onclick = () => newRun();
  $("btnViewDeck").onclick = () => openModal("Your Deck", modalDeckView());
  $("btnSave").onclick = () => saveRun();
  $("btnLoad").onclick = () => {
    if (loadRun()) renderAll(renderScreen);
  };
}

/* ---------------- Boot ---------------- */
bindUI();
bindModal();
newRun();

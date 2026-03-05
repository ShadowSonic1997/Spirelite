import { state, setState, newRunState } from "./state.js";
import { $ } from "./utils.js";
import { log, logClear } from "./ui/log.js";
import { bindModal, openModal } from "./ui/modal.js";
import { renderAll, modalDeckView } from "./ui/render.js";

import { Cards } from "./content/cards.js"; // ensures module is loaded
import { Relics } from "./content/relics.js"; // ensures module is loaded

import { addToDeck, startCombat, playCardFromHand, endPlayerTurn, livingEnemies } from "./systems/combat.js";
import { generateRewards, randomRelic, gainRelic, triggerRelics } from "./systems/rewards.js";
import { enterShop } from "./systems/shop.js";
import { saveRun, loadRun } from "./systems/save.js";
import { RoomTypes } from "./content/rooms.js";
import { EnemyDefs } from "./content/enemies.js";
import { choice, rint } from "./utils.js";
import { generateEvent } from "./content/events.js";

/* ---- Encounter generation (kept small here) ---- */
function generateEncounter(kind = "battle") {
  const depth = state.floor;
  const pool = ["slime", "cultist", "fang", "golem", "seer"];
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

/* ---- Map roll ---- */
function nextRoomChoices() {
  const depth = state.floor;
  const weights = [
    ["battle", 48],
    ["elite", depth > 2 ? 12 : 6],
    ["shop", 14],
    ["rest", 14],
    ["event", 10],
    ["treasure", 8],
  ];

  const drawOne = () => {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [t, w] of weights) {
      roll -= w;
      if (roll <= 0) return t;
    }
    return "battle";
  };

  return [drawOne(), drawOne(), drawOne()];
}

/* ---- Phase transitions ---- */
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

  if (state.floor % 5 === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 4);
    log("Milestone breather: +4 HP.", "good");
  }
  renderAll(renderScreen);
}

/* ---- Enter room ---- */
function enterRoom(type) {
  const rt = RoomTypes[type];
  log(`Entered floor ${state.floor}: ${rt.name}`, "info");

  if (type === "battle") startCombat(generateEncounter("battle"));
  else if (type === "elite") startCombat(generateEncounter("elite"));
  else if (type === "shop") enterShop();
  else if (type === "rest") { state.phase = "rest"; }
  else if (type === "event") { state.phase = "event"; state.event = generateEvent(); }
  else if (type === "treasure") {
    state.phase = "treasure";
    state.treasure = Math.random() < 0.65
      ? { kind: "relic", id: randomRelic(), text: "A relic rests on velvet." }
      : { kind: "gold", gold: rint(60, 120), text: "A heavy gold pouch." };
  }

  renderAll(renderScreen);
}

/* ---- Combat results ---- */
function winCombat() {
  const kind = "battle";
  const gold = rint(18, 32);
  state.player.gold += gold;
  log(`Won combat! +${gold} gold.`, "good");

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

/* ---- Rendering per phase ---- */
function renderScreen() {
  const screen = $("screen");
  screen.innerHTML = "";

  // Keep this simple: you can split into ui/screens later if you want.
  if (state.phase === "map") {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `<h3>Choose your next room</h3><p>Duplicates can happen. Embrace the chaos.</p>`;
    wrap.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "choiceGrid";
    nextRoomChoices().forEach(t => {
      const rt = RoomTypes[t];
      const card = document.createElement("div");
      card.className = "roomCard";
      card.innerHTML = `
        <div class="roomMeta">
          <span class="badge ${rt.badge[1]}">${rt.badge[0]}</span>
          <span class="badge">${rt.name}</span>
        </div>
        <h3>${rt.name}</h3>
        <p>${rt.desc}</p>
      `;
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = `Enter ${rt.name}`;
      btn.onclick = () => enterRoom(t);
      card.appendChild(btn);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "combat") {
    // In the next step we can split this into ui/screens/combat.js cleanly.
    // For now, keep it minimal: you already have combat visuals in your earlier render module.
    // If you want, I’ll fully split screens next.
    const note = document.createElement("div");
    note.className = "roomCard";
    note.innerHTML = `<h3>Combat is active</h3><p>Your combat rendering is currently still inside the old render flow. Next step: split combat screen module.</p>`;
    screen.appendChild(note);
    return;
  }

  if (state.phase === "reward") {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `<h3>Choose a reward</h3><p>Pick one.</p>`;
    wrap.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "choiceGrid";
    state.pendingRewards.forEach(r => {
      const c = document.createElement("div");
      c.className = "roomCard";
      c.innerHTML = `<h3>${r.title}</h3><p>${r.desc}</p>`;
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "Choose";
      b.onclick = () => {
        if (r.kind === "card") {
          // simple: auto pick 1 of 3 for now; we can add your nice modal pick screens next
          openModal("Pick a card", modalPickCard((id) => {
            r.apply(id);
            endRoomAndGoMap();
          }));
        } else if (r.kind === "upgrade") {
          // quick: upgrade first non-upgraded
          const idx = state.player.deck.findIndex(x => !x.upgraded);
          if (idx >= 0) r.apply(idx);
          endRoomAndGoMap();
        } else {
          r.apply();
          endRoomAndGoMap();
        }
      };
      c.appendChild(b);
      grid.appendChild(c);
    });

    wrap.appendChild(grid);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "shop") {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `<h3>Shop</h3><p>Stock rendering can be moved into ui/screens/shop.js next.</p>`;
    wrap.appendChild(head);
    const leave = document.createElement("button");
    leave.className = "btn";
    leave.textContent = "Leave shop";
    leave.onclick = () => endRoomAndGoMap();
    wrap.appendChild(leave);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "rest") {
    const wrap = document.createElement("div");
    const card = document.createElement("div");
    card.className = "roomCard";
    const healAmount = Math.floor(state.player.maxHp * 0.28);
    card.innerHTML = `<h3>Rest Site</h3><p>Heal or upgrade a card.</p>`;
    const heal = document.createElement("button");
    heal.className = "btn good";
    heal.textContent = `Rest (+${healAmount} HP)`;
    heal.onclick = () => { state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount); endRoomAndGoMap(); };
    const leave = document.createElement("button");
    leave.className = "btn";
    leave.textContent = "Leave";
    leave.onclick = () => endRoomAndGoMap();
    card.appendChild(heal);
    card.appendChild(leave);
    wrap.appendChild(card);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "event") {
    const e = state.event;
    const wrap = document.createElement("div");
    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `<h3>${e.title}</h3><p>${e.text}</p>`;
    e.options.forEach(opt => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = opt.label;
      b.onclick = () => { /* apply later cleanly */ endRoomAndGoMap(); };
      card.appendChild(b);
    });
    wrap.appendChild(card);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "treasure") {
    const t = state.treasure;
    const wrap = document.createElement("div");
    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `<h3>Treasure</h3><p>${t.text}</p>`;
    const b = document.createElement("button");
    b.className = "btn good";
    b.textContent = "Claim";
    b.onclick = () => {
      if (t.kind === "relic") gainRelic(t.id);
      else state.player.gold += t.gold;
      endRoomAndGoMap();
    };
    card.appendChild(b);
    wrap.appendChild(card);
    screen.appendChild(wrap);
    return;
  }

  if (state.phase === "gameover") {
    const wrap = document.createElement("div");
    const c = document.createElement("div");
    c.className = "roomCard";
    c.innerHTML = `<h3>Run Over</h3><p>You reached floor ${state.floor}.</p>`;
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "Start New Run";
    b.onclick = () => newRun();
    c.appendChild(b);
    wrap.appendChild(c);
    screen.appendChild(wrap);
  }
}

/* ---- New run ---- */
function newRun() {
  setState(newRunState());
  logClear();
  log("New run started.", "info");

  addToDeck("strike", 5);
  addToDeck("defend", 5);
  addToDeck("bash", 1);

  gainRelic(randomRelic(["luckycoin", "ironheart", "swiftgloves"]));
  triggerRelics("onNewFloor");

  renderAll(renderScreen);
}

/* ---- UI binds ---- */
function bindUI() {
  $("btnNewRun").onclick = () => newRun();
  $("btnViewDeck").onclick = () => openModal("Your Deck", modalDeckView());
  $("btnSave").onclick = () => saveRun();
  $("btnLoad").onclick = () => { if (loadRun()) renderAll(renderScreen); };
}

/* ---- Boot ---- */
bindUI();
bindModal();
newRun();

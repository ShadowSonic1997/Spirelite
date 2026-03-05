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
import { bindModal, openModal, closeModal } from "./ui/modal.js";
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

/* ---------------- Encounter generation ---------------- */
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

/* ---------------- Map roll ---------------- */
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

  if (state.floor % 5 === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 4);
    log("Milestone breather: +4 HP.", "good");
  }

  renderAll(renderScreen);
}

function enterRoom(type) {
  const rt = RoomTypes[type];
  log(`Entered floor ${state.floor}: ${rt.name}`, "info");

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
  if (state.phase === "gameover") return screen.appendChild(screenGameOver());
}

/* ---- MAP ---- */
function screenMap() {
  const wrap = document.createElement("div");

  const head = document.createElement("div");
  head.className = "roomCard";
  head.innerHTML = `
    <h3>Choose your next room</h3>
    <p>Duplicates can happen. Embrace the chaos.</p>
    <div class="roomMeta">
      <span class="badge">Deck: ${state.player.deck.length}</span>
      <span class="badge">HP: ${state.player.hp}/${state.player.maxHp}</span>
      <span class="badge">Gold: ${state.player.gold}</span>
    </div>
  `;
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

      // instant win check after playing
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
    const base = Cards[it.id];
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
  // This matches the kinds from src/content/events.js (the version I posted earlier)
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

  // none / unknown
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

  gainRelic(randomRelic(["luckycoin", "ironheart", "swiftgloves"]));
  triggerRelics("onNewFloor");

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

import { state } from "../state.js";
import { Cards } from "../content/cards.js";
import { Relics } from "../content/relics.js";
import { $ } from "../utils.js";
import { makePlayable, cardName } from "../systems/combat.js";
import { cardArtUri, rarityClass, typeFrameClass } from "../visuals/svg.js";
import { closeModal } from "./modal.js";

export function statusLine(s) {
  const parts = [];
  if (s?.weak) parts.push(`Weak ${s.weak}`);
  if (s?.vuln) parts.push(`Vulnerable ${s.vuln}`);
  return parts.length ? parts.join(" • ") : "None";
}

export function intentText(intent) {
  if (!intent) return "—";
  if (intent.type === "attack") return `Attack ${intent.amount}`;
  if (intent.type === "block") return `Block ${intent.amount}`;
  if (intent.type === "buff") return `Buff +${intent.amount} Str`;
  if (intent.type === "debuff") return `Debuff ${intent.debuff} ${intent.amount}`;
  if (intent.type === "multi") return `Multi ${intent.hits}×${intent.amount}`;
  return "—";
}

export function renderHUD() {
  $("hudFloor").textContent = `Floor: ${state.floor}`;
  $("hudGold").textContent = `Gold: ${state.player.gold}`;
  $("hudRelics").textContent = `Relics: ${state.player.relics.length}`;
}

export function renderLeft() {
  $("pHp").textContent = `${state.player.hp} / ${state.player.maxHp}`;
  $("pHpBar").style.width = `${Math.floor((state.player.hp / state.player.maxHp) * 100)}%`;
  $("pBlock").textContent = `${state.player.block}`;
  $("pEnergy").textContent = `${state.player.energy}`;
  $("pStatus").textContent = statusLine(state.player.status);

  $("drawCount").textContent = state.player.draw.length;
  $("discardCount").textContent = state.player.discard.length;
  $("exhaustCount").textContent = state.player.exhaust.length;

  const rlist = state.player.relics.map(id => `• ${Relics[id]?.name || id}`).join("\n");
  $("leftNote").textContent =
    `Tip: Click a card to play it.\n` +
    `Tip: Click an enemy to target it.\n` +
    `End your turn when you're out of energy.\n\n` +
    `Relics:\n${rlist || "• (none)"}`;
}

export function renderAll(renderScreenFn) {
  renderHUD();
  renderLeft();
  renderScreenFn();
}

export function renderCardDom(cardId, upgraded, playable, onClick, priceLabel = null) {
  const inst = { baseId: cardId, upgraded };
  const c = makePlayable(inst);
  const base = Cards[cardId];

  const rarity = rarityClass(base.rarity);
  const frame = typeFrameClass(base.type);

  const el = document.createElement("div");
  el.className = `card cardGlow ${rarity} ${playable ? "playable" : "unplayable"}`;

  el.innerHTML = `
    <div class="cardFrame ${frame}"></div>
    <div class="cardArt"><img src="${cardArtUri(cardId, base.type)}" alt=""></div>
    <div class="top">
      <div class="name">${c.displayName}</div>
      <div class="cost">${priceLabel ?? c.cost}</div>
    </div>
    <div class="type">
      <span>${c.type} • ${base.rarity}</span>
      <span>${upgraded ? `<span class="tag up">UPGRADED</span>` : ""}</span>
    </div>
    <div class="desc">${c.displayDesc}</div>
    <div class="tags">${(c.tags || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
  `;

  if (playable && onClick) el.onclick = onClick;
  return el;
}

/* ---------- Modals ---------- */

export function modalDeckView() {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "cardGrid";
  state.player.deck.forEach(inst => {
    grid.appendChild(renderCardDom(inst.baseId, inst.upgraded, false, null));
  });
  wrap.appendChild(grid);
  return wrap;
}

export function modalPickCards(cardIds, onPick) {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "cardGrid";

  cardIds.forEach(id => {
    grid.appendChild(renderCardDom(id, false, true, () => {
      onPick(id);
      closeModal();
    }));
  });

  wrap.appendChild(grid);
  return wrap;
}

export function modalUpgradePick(onPickIndex) {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "cardGrid";

  state.player.deck.forEach((inst, idx) => {
    const base = Cards[inst.baseId];
    const can = !inst.upgraded && !!base.upgrade;
    const el = renderCardDom(
      inst.baseId,
      inst.upgraded,
      can,
      can ? () => { onPickIndex(idx); closeModal(); } : null
    );

    // show upgrade desc if available
    const desc = el.querySelector(".desc");
    desc.textContent = inst.upgraded ? "Already upgraded." : (base.upgrade?.desc || "No upgrade available.");

    grid.appendChild(el);
  });

  wrap.appendChild(grid);
  return wrap;
}

export function modalRemovePick(onPickIndex) {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "cardGrid";

  state.player.deck.forEach((inst, idx) => {
    grid.appendChild(renderCardDom(inst.baseId, inst.upgraded, true, () => {
      onPickIndex(idx);
      closeModal();
    }));
  });

  wrap.appendChild(grid);
  return wrap;
}

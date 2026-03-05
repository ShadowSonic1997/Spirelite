import { clamp, shuffle } from "../utils.js";
import { state } from "../state.js";
import { Cards } from "../content/cards.js";
import { cloneEnemy, rollIntent } from "../content/enemies.js";
import { log } from "../ui/log.js";
import { triggerRelics } from "./rewards.js"; // uses shared relic hook helper

export function addToDeck(cardId, count = 1) {
  for (let i = 0; i < count; i++) state.player.deck.push({ baseId: cardId, upgraded: false });
}

export function cardName(cardInst) {
  const base = Cards[cardInst.baseId];
  return cardInst.upgraded ? (base.upgrade?.name || (base.name + "+")) : base.name;
}

export function makePlayable(cardInst) {
  const base = Cards[cardInst.baseId];
  return {
    ...base,
    upgraded: cardInst.upgraded,
    inst: cardInst,
    displayName: cardName(cardInst),
    displayDesc: cardInst.upgraded && base.upgrade?.desc ? base.upgrade.desc : base.desc,
  };
}

export function rebuildDrawPile() {
  state.player.draw = shuffle([...state.player.draw, ...state.player.discard]);
  state.player.discard = [];
}

export function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (state.player.draw.length === 0) rebuildDrawPile();
    if (state.player.draw.length === 0) return;
    state.player.hand.push(state.player.draw.pop());
  }
}

export function discardHand() {
  state.player.discard.push(...state.player.hand);
  state.player.hand = [];
}

export function livingEnemies() {
  return state.combat ? state.combat.enemies.filter(e => e.hp > 0) : [];
}

export function randomLivingEnemy() {
  const arr = livingEnemies();
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

export function pickTarget(ctx) {
  const enemies = livingEnemies();
  if (!enemies.length) return null;
  const idx = clamp(ctx.targetIndex ?? 0, 0, enemies.length - 1);
  return enemies[idx];
}

export function applyStatus(entity, key, amount) {
  entity.status ||= {};
  entity.status[key] = (entity.status[key] || 0) + amount;
}

export function tickStatus(statusObj) {
  for (const k of Object.keys(statusObj)) statusObj[k] = Math.max(0, (statusObj[k] || 0) - 1);
}

export function gainBlock(ctx, amount) {
  state.player.block += amount;
  log(`Gained ${amount} Block.`, "good");
  triggerRelics("onGainBlock");
}

export function healPlayer(amount) {
  const before = state.player.hp;
  state.player.hp = clamp(state.player.hp + amount, 0, state.player.maxHp);
  const gained = state.player.hp - before;
  if (gained > 0) log(`Healed ${gained}.`, "good");
}

export function dealDamage(ctx, target, amount, opts = {}) {
  if (!target) return;
  let dmg = amount;

  if (!opts.ignoreStrength && ctx?.source === "player") dmg += state.player.str;

  const attackerStatus =
    ctx?.source === "player" ? state.player.status :
    ctx?.source === "enemy" ? ctx.enemy.status : null;

  if (attackerStatus?.weak) dmg = Math.floor(dmg * 0.75);
  if (target.status?.vuln) dmg = Math.floor(dmg * 1.25);
  dmg = Math.max(0, dmg);

  if (target === state.player) {
    dmg = Math.max(0, dmg - (state.player.damageReduction || 0));
    const blocked = Math.min(state.player.block, dmg);
    state.player.block -= blocked;
    dmg -= blocked;
    if (blocked > 0) log(`Blocked ${blocked}.`, "good");
    if (dmg > 0) log(`You took ${dmg} damage.`, "bad");
    state.player.hp -= dmg;
    return;
  }

  const blocked = Math.min(target.block, dmg);
  target.block -= blocked;
  dmg -= blocked;
  if (blocked > 0) log(`${target.name} blocked ${blocked}.`, "info");
  if (dmg > 0) log(`${target.name} took ${dmg} damage.`, "good");
  target.hp -= dmg;
}

function cleanupDeadEnemies() {
  state.combat.enemies = state.combat.enemies.filter(e => e.hp > 0);
}

function baseEnergy() { return 3; }
function baseHandSize() { return 5; }

export function startCombat(encounter) {
  state.phase = "combat";
  state.player.block = 0;
  state.player.energy = baseEnergy();
  state.player.damageReduction = 0;

  state.player.draw = shuffle([...state.player.deck]);
  state.player.hand = [];
  state.player.discard = [];
  state.player.exhaust = [];

  state.combat = {
    turn: 1,
    enemies: encounter.enemies.map(cloneEnemy),
    selectedTarget: 0,
    kind: encounter.kind || "battle",
  };

  for (const e of state.combat.enemies) rollIntent(e);

  drawCards(baseHandSize());
  triggerRelics("onCombatStart");
}

export function playCardFromHand(index, targetIndex) {
  if (state.phase !== "combat") return;

  const cardInst = state.player.hand[index];
  if (!cardInst) return;
  const card = makePlayable(cardInst);

  if (card.cost > state.player.energy) {
    log(`Not enough energy for ${card.displayName}.`, "warn");
    return;
  }

  state.player.energy -= card.cost;

  const api = {
    state,
    log,
    drawCards,
    pickTarget,
    dealDamage,
    gainBlock,
    healPlayer,
    applyStatus,
    randomLivingEnemy,
  };

  const ctx = { upgraded: cardInst.upgraded, source: "player", targetIndex };

  card.play(api, ctx);

  const removed = state.player.hand.splice(index, 1)[0];
  if (card.exhaust) state.player.exhaust.push(removed);
  else state.player.discard.push(removed);

  cleanupDeadEnemies();
  state.combat.selectedTarget = clamp(state.combat.selectedTarget, 0, Math.max(0, livingEnemies().length - 1));
}

function enemyAct(enemy) {
  const intent = enemy.intent;
  enemy.block = 0;

  if (intent.type === "attack") dealDamage({ source: "enemy", enemy }, state.player, intent.amount);
  else if (intent.type === "block") { enemy.block += intent.amount; log(`${enemy.name} gained ${intent.amount} Block.`, "info"); }
  else if (intent.type === "buff") { enemy.str += intent.amount; log(`${enemy.name} gained +${intent.amount} Strength.`, "warn"); }
  else if (intent.type === "debuff") {
    if (intent.debuff === "weak") applyStatus(state.player, "weak", intent.amount);
    if (intent.debuff === "vuln") applyStatus(state.player, "vuln", intent.amount);
    log(`${enemy.name} applied ${intent.debuff}.`, "warn");
  } else if (intent.type === "multi") {
    for (let i = 0; i < intent.hits; i++) dealDamage({ source: "enemy", enemy }, state.player, intent.amount);
  }

  tickStatus(enemy.status);
}

export function endPlayerTurn({ onWin, onLose }) {
  if (state.phase !== "combat") return;

  discardHand();

  for (const e of livingEnemies()) enemyAct(e);
  cleanupDeadEnemies();

  if (state.player.hp <= 0) { onLose(); return; }
  if (livingEnemies().length === 0) { onWin(); return; }

  state.combat.turn += 1;
  state.player.block = 0;
  state.player.energy = baseEnergy();
  state.player.damageReduction = 0;

  tickStatus(state.player.status);

  if (state.player.nextStr > 0) {
    state.player.str += state.player.nextStr;
    log(`Gained +${state.player.nextStr} Strength.`, "good");
    state.player.nextStr = 0;
  }

  if (state.player.selfWeakNext > 0) {
    applyStatus(state.player, "weak", state.player.selfWeakNext);
    log(`You became Weak.`, "warn");
    state.player.selfWeakNext = 0;
  }

  for (const e of livingEnemies()) rollIntent(e);

  drawCards(baseHandSize());

  state.combat.selectedTarget = clamp(state.combat.selectedTarget, 0, Math.max(0, livingEnemies().length - 1));
}

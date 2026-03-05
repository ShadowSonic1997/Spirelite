import { state } from "../state.js";
import { choice, rint } from "../utils.js";
import { Cards } from "../content/cards.js";
import { Relics } from "../content/relics.js";
import { log } from "../ui/log.js";

export function triggerRelics(hook) {
  for (const rid of state.player.relics) {
    const r = Relics[rid];
    if (r && typeof r[hook] === "function") r[hook](makeRelicApi());
  }
}

export function gainRelic(id) {
  if (!id) return;
  if (!state.player.relics.includes(id)) state.player.relics.push(id);
  const r = Relics[id];
  log(`Relic gained: ${r.name}.`, "good");
  if (r.onGain) r.onGain(makeRelicApi());
}

function makeRelicApi() {
  // keep this small; expand as needed
  return {
    state,
    log,
    healPlayer: (n) => { state.player.hp = Math.min(state.player.maxHp, state.player.hp + n); },
    drawCards: () => {}, // combat fills this in via combat api when needed; relics that need it can be moved into combat api
    dealDamage: () => {},
    randomLivingEnemy: () => null,
  };
}

export function randomRelic(allowedIds = null) {
  const pool = allowedIds ? allowedIds : Object.keys(Relics);
  const notOwned = pool.filter(id => !state.player.relics.includes(id));
  return choice(notOwned.length ? notOwned : pool);
}

export function randomCardOffer(n) {
  const pool = Object.values(Cards)
    .filter(c => c.rarity !== "Starter")
    .map(c => c.id);

  const weighted = [];
  for (const id of pool) {
    const r = Cards[id].rarity;
    const w = r === "Common" ? 8 : r === "Uncommon" ? 4 : 2;
    for (let i = 0; i < w; i++) weighted.push(id);
  }

  const picks = new Set();
  while (picks.size < n) picks.add(choice(weighted));
  return [...picks];
}

export function generateRewards(kind) {
  const options = [];
  for (let i = 0; i < 3; i++) {
    const roll = Math.random();
    if (roll < 0.55) options.push(makeRewardAddCard());
    else if (roll < 0.82) options.push(makeRewardUpgradeCard());
    else options.push(makeRewardRelicOrGold(kind));
  }
  return options;
}

function makeRewardAddCard() {
  const pick = randomCardOffer(3);
  return {
    kind: "card",
    title: "Add a card",
    desc: "Pick 1 of 3 cards to add to your deck.",
    picks: pick,
    apply: (cardId) => {
      state.player.deck.push({ baseId: cardId, upgraded: false });
      log(`Added ${Cards[cardId].name} to your deck.`, "good");
    }
  };
}

function makeRewardUpgradeCard() {
  return {
    kind: "upgrade",
    title: "Upgrade a card",
    desc: "Choose a card in your deck to upgrade (+).",
    apply: (cardIndex) => {
      const c = state.player.deck[cardIndex];
      if (!c || c.upgraded) return;
      c.upgraded = true;
      log(`Upgraded a card.`, "good");
    }
  };
}

function makeRewardRelicOrGold(kind) {
  const giveRelic = Math.random() < (kind === "elite" ? 0.75 : 0.45);
  if (giveRelic) {
    const relic = randomRelic();
    return {
      kind: "relic",
      title: "Find a relic",
      desc: `${Relics[relic].name}: ${Relics[relic].desc}`,
      apply: () => gainRelic(relic),
    };
  }
  const gold = rint(20, 45);
  return {
    kind: "gold",
    title: `Treasure Pouch`,
    desc: `Gain ${gold} gold.`,
    apply: () => { state.player.gold += gold; log(`Gained ${gold} gold.`, "good"); }
  };
}

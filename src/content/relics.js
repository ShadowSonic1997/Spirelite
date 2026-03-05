export const Relics = {};
export function makeRelic(r) { Relics[r.id] = r; }

makeRelic({
  id: "luckycoin",
  name: "Lucky Coin",
  rarity: "Common",
  desc: `Start each floor with +15 gold.`,
  onNewFloor: (api) => { api.state.player.gold += 15; api.log(`Lucky Coin: +15 gold.`, "good"); }
});

makeRelic({
  id: "ironheart",
  name: "Iron Heart",
  rarity: "Common",
  desc: `Max HP +8.`,
  onGain: (api) => { api.state.player.maxHp += 8; api.state.player.hp += 8; }
});

makeRelic({
  id: "swiftgloves",
  name: "Swift Gloves",
  rarity: "Uncommon",
  desc: `At the start of combat, draw +1 card.`,
  onCombatStart: (api) => { api.drawCards(1); api.log(`Swift Gloves: drew +1.`, "good"); }
});

makeRelic({
  id: "spikeshield",
  name: "Spike Shield",
  rarity: "Uncommon",
  desc: `Whenever you gain Block, deal 1 damage to a random enemy.`,
  onGainBlock: (api) => {
    const e = api.randomLivingEnemy();
    if (e) api.dealDamage({ source: "relic" }, e, 1, { ignoreStrength: true });
  }
});

makeRelic({
  id: "bloodvial",
  name: "Blood Vial",
  rarity: "Common",
  desc: `After each combat, heal 3.`,
  onCombatWin: (api) => api.healPlayer(3)
});

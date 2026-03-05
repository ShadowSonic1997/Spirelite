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
  onCombatStart: (api) => { api.drawCards?.(1); api.log?.(`Swift Gloves: drew +1.`, "good"); }
});

makeRelic({
  id: "spikeshield",
  name: "Spike Shield",
  rarity: "Uncommon",
  desc: `Whenever you gain Block, deal 1 damage to a random enemy.`,
  onGainBlock: (api) => {
    const e = api.randomLivingEnemy?.();
    if (e) api.dealDamage?.({ source: "relic", ignoreStrength: true }, e, 1, { ignoreStrength: true });
  }
});

makeRelic({
  id: "bloodvial",
  name: "Blood Vial",
  rarity: "Common",
  desc: `After each combat, heal 3.`,
  onCombatWin: (api) => api.healPlayer?.(3),
});

/* -------- New Relics -------- */

makeRelic({
  id: "matchstick",
  name: "Matchstick",
  rarity: "Common",
  desc: `At the start of each combat, gain 5 Block.`,
  onCombatStart: (api) => { api.state.player.block += 5; api.log("Matchstick: +5 Block.", "good"); }
});

makeRelic({
  id: "warhorn",
  name: "War Horn",
  rarity: "Uncommon",
  desc: `Whenever you apply a debuff to an enemy, gain 1 energy (once per turn).`,
  onTurnStart: (api) => { api.state.combat.flags ||= {}; api.state.combat.flags.warhorn = false; },
  onApplyDebuff: (api) => {
    api.state.combat.flags ||= {};
    if (api.state.combat.flags.warhorn) return;
    api.state.combat.flags.warhorn = true;
    api.state.player.energy += 1;
    api.log("War Horn: +1 energy!", "good");
  }
});

makeRelic({
  id: "scrapcore",
  name: "Scrap Core",
  rarity: "Uncommon",
  desc: `The first Attack you play each turn deals +3 damage.`,
  onTurnStart: (api) => { api.state.combat.flags ||= {}; api.state.combat.flags.scrap = false; },
});

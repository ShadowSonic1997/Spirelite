export const Cards = {};

export function makeCard(c) { Cards[c.id] = c; }

const dmgText = (n) => `${n} dmg`;
const blockText = (n) => `${n} block`;

// NOTE: card effects call functions provided by combat system.
// They’ll be passed in as "api" when played.

makeCard({
  id: "strike",
  name: "Strike",
  cost: 1,
  type: "Attack",
  rarity: "Starter",
  desc: `Deal ${dmgText(6)}.`,
  tags: ["Direct"],
  upgrade: { name: "Strike+", desc: `Deal ${dmgText(9)}.` },
  play: (api, ctx) => api.dealDamage(ctx, api.pickTarget(ctx), ctx.upgraded ? 9 : 6),
});

makeCard({
  id: "defend",
  name: "Defend",
  cost: 1,
  type: "Skill",
  rarity: "Starter",
  desc: `Gain ${blockText(5)}.`,
  tags: ["Block"],
  upgrade: { name: "Defend+", desc: `Gain ${blockText(8)}.` },
  play: (api, ctx) => api.gainBlock(ctx, ctx.upgraded ? 8 : 5),
});

makeCard({
  id: "bash",
  name: "Bash",
  cost: 2,
  type: "Attack",
  rarity: "Starter",
  desc: `Deal ${dmgText(8)}. Apply 2 Vulnerable.`,
  tags: ["Debuff"],
  upgrade: { name: "Bash+", desc: `Deal ${dmgText(10)}. Apply 3 Vulnerable.` },
  play: (api, ctx) => {
    const t = api.pickTarget(ctx);
    api.dealDamage(ctx, t, ctx.upgraded ? 10 : 8);
    api.applyStatus(t, "vuln", ctx.upgraded ? 3 : 2);
    api.log(`Applied Vulnerable to ${t.name}.`, "warn");
  },
});

// Commons
makeCard({
  id: "quickstab",
  name: "Quick Stab",
  cost: 1,
  type: "Attack",
  rarity: "Common",
  desc: `Deal ${dmgText(4)} twice.`,
  tags: ["Multi-hit"],
  upgrade: { name: "Quick Stab+", desc: `Deal ${dmgText(5)} twice.` },
  play: (api, ctx) => {
    const t = api.pickTarget(ctx);
    const d = ctx.upgraded ? 5 : 4;
    api.dealDamage(ctx, t, d);
    api.dealDamage(ctx, t, d);
  },
});

makeCard({
  id: "guardup",
  name: "Guard Up",
  cost: 1,
  type: "Skill",
  rarity: "Common",
  desc: `Gain ${blockText(7)}. Draw 1.`,
  tags: ["Block", "Draw"],
  upgrade: { name: "Guard Up+", desc: `Gain ${blockText(9)}. Draw 1.` },
  play: (api, ctx) => {
    api.gainBlock(ctx, ctx.upgraded ? 9 : 7);
    api.drawCards(1);
  },
});

makeCard({
  id: "focus",
  name: "Focus",
  cost: 1,
  type: "Skill",
  rarity: "Common",
  desc: `Gain 2 Strength next turn.`,
  tags: ["Buff"],
  upgrade: { name: "Focus+", desc: `Gain 3 Strength next turn.` },
  play: (api, ctx) => {
    const n = ctx.upgraded ? 3 : 2;
    api.state.player.nextStr += n;
    api.log(`You'll gain +${n} Strength next turn.`, "good");
  },
});

makeCard({
  id: "smoke",
  name: "Smoke Bomb",
  cost: 1,
  type: "Skill",
  rarity: "Common",
  desc: `Apply 2 Weak to ALL enemies.`,
  tags: ["Debuff", "AoE"],
  upgrade: { name: "Smoke Bomb+", desc: `Apply 3 Weak to ALL enemies.` },
  play: (api, ctx) => {
    const n = ctx.upgraded ? 3 : 2;
    for (const e of api.state.combat.enemies) api.applyStatus(e, "weak", n);
    api.log(`Applied Weak to all enemies.`, "warn");
  },
});

makeCard({
  id: "cleave",
  name: "Cleave",
  cost: 1,
  type: "Attack",
  rarity: "Common",
  desc: `Deal ${dmgText(5)} to ALL enemies.`,
  tags: ["AoE"],
  upgrade: { name: "Cleave+", desc: `Deal ${dmgText(7)} to ALL enemies.` },
  play: (api, ctx) => {
    const d = ctx.upgraded ? 7 : 5;
    for (const e of api.state.combat.enemies) api.dealDamage(ctx, e, d);
  },
});

// Uncommon
makeCard({
  id: "finisher",
  name: "Finisher",
  cost: 2,
  type: "Attack",
  rarity: "Uncommon",
  desc: `Deal ${dmgText(14)}. If target is Vulnerable, gain 1 energy.`,
  tags: ["Synergy"],
  upgrade: { name: "Finisher+", desc: `Deal ${dmgText(18)}. If target is Vulnerable, gain 1 energy.` },
  play: (api, ctx) => {
    const t = api.pickTarget(ctx);
    api.dealDamage(ctx, t, ctx.upgraded ? 18 : 14);
    if ((t.status.vuln || 0) > 0) {
      api.state.player.energy += 1;
      api.log(`Finisher refunded 1 energy!`, "good");
    }
  },
});

makeCard({
  id: "meditate",
  name: "Meditate",
  cost: 0,
  type: "Skill",
  rarity: "Uncommon",
  desc: `Draw 2. Exhaust.`,
  tags: ["Draw"],
  exhaust: true,
  upgrade: { name: "Meditate+", desc: `Draw 3. Exhaust.` },
  play: (api, ctx) => api.drawCards(ctx.upgraded ? 3 : 2),
});

// Rare
makeCard({
  id: "overcharge",
  name: "Overcharge",
  cost: 0,
  type: "Skill",
  rarity: "Rare",
  desc: `Gain 2 energy. Apply 1 Weak to yourself next turn.`,
  tags: ["Energy"],
  upgrade: { name: "Overcharge+", desc: `Gain 3 energy. Apply 1 Weak to yourself next turn.` },
  play: (api, ctx) => {
    const n = ctx.upgraded ? 3 : 2;
    api.state.player.energy += n;
    api.state.player.selfWeakNext += 1;
    api.log(`+${n} energy now, but you'll be Weak next turn.`, "warn");
  },
});

makeCard({
  id: "reaper",
  name: "Reaper",
  cost: 2,
  type: "Attack",
  rarity: "Rare",
  desc: `Deal ${dmgText(10)} to ALL enemies. Heal for half unblocked damage dealt.`,
  tags: ["AoE", "Heal"],
  upgrade: { name: "Reaper+", desc: `Deal ${dmgText(13)} to ALL enemies. Heal for half unblocked damage dealt.` },
  play: (api, ctx) => {
    const d = ctx.upgraded ? 13 : 10;
    let healed = 0;
    for (const e of api.state.combat.enemies) {
      const before = e.hp;
      api.dealDamage(ctx, e, d);
      const delta = Math.max(0, before - e.hp);
      healed += Math.floor(delta / 2);
    }
    if (healed > 0) api.healPlayer(healed);
  },
});

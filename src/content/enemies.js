import { choice, rint } from "../utils.js";
import { state } from "../state.js";

export const EnemyDefs = {
  slime: { id: "slime", name: "Slime", maxHp: 28, intents: ["attack", "block", "debuff"] },
  cultist: { id: "cultist", name: "Cultist", maxHp: 30, intents: ["attack", "buff"] },
  fang: { id: "fang", name: "Fang Bat", maxHp: 22, intents: ["multi", "attack", "debuff"] },
  golem: { id: "golem", name: "Golem", maxHp: 40, intents: ["attack", "block"] },
  seer: { id: "seer", name: "Void Seer", maxHp: 34, intents: ["debuff", "attack", "buff"] },
};

export function cloneEnemy(e) {
  return {
    ...e,
    hp: e.maxHp,
    block: 0,
    str: 0,
    status: { weak: 0, vuln: 0 },
    intent: null,
  };
}

export function rollIntent(enemy) {
  const base = EnemyDefs[enemy.id];
  const t = choice(base.intents);
  const depth = state.floor;
  const scale = 1 + Math.floor((depth - 1) / 4);

  if (t === "attack") enemy.intent = { type: "attack", amount: rint(6, 9) + enemy.str + scale };
  else if (t === "block") enemy.intent = { type: "block", amount: rint(6, 10) + scale };
  else if (t === "buff") enemy.intent = { type: "buff", amount: rint(1, 2) };
  else if (t === "debuff") enemy.intent = { type: "debuff", debuff: choice(["weak", "vuln"]), amount: rint(1, 2) };
  else if (t === "multi") enemy.intent = { type: "multi", hits: 2, amount: rint(3, 5) + Math.floor(scale / 2) };
}

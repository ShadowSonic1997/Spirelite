import { choice, rint } from "../utils.js";
import { state } from "../state.js";

export const EnemyDefs = {
  slime: { id: "slime", name: "Slime", maxHp: 28, intents: ["attack", "block", "debuff"] },
  cultist: { id: "cultist", name: "Cultist", maxHp: 30, intents: ["attack", "buff"] },
  fang: { id: "fang", name: "Fang Bat", maxHp: 22, intents: ["multi", "attack", "debuff"] },
  golem: { id: "golem", name: "Golem", maxHp: 40, intents: ["attack", "block"] },
  seer: { id: "seer", name: "Void Seer", maxHp: 34, intents: ["debuff", "attack", "buff"] },

  // NEW
  wisp: { id: "wisp", name: "Cinder Wisp", maxHp: 18, intents: ["debuff", "attack", "buff"] },
  brute: { id: "brute", name: "Tower Brute", maxHp: 48, intents: ["attack", "attack", "block"] },
  mimic: { id: "mimic", name: "Mimic Chest", maxHp: 36, intents: ["attack", "debuff", "multi"] },
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

  // Special behaviors
  if (enemy.id === "wisp") {
    const tt = choice(["debuff", "attack", "buff", "debuff"]);
    if (tt === "debuff") enemy.intent = { type: "debuff", debuff: choice(["weak", "vuln"]), amount: rint(1, 2) };
    else if (tt === "buff") enemy.intent = { type: "buff", amount: 1 + Math.floor(scale / 2) };
    else enemy.intent = { type: "attack", amount: rint(5, 7) + enemy.str + scale };
    return;
  }

  if (enemy.id === "brute") {
    const tt = choice(["attack", "attack", "block"]);
    if (tt === "block") enemy.intent = { type: "block", amount: rint(10, 16) + scale };
    else enemy.intent = { type: "attack", amount: rint(10, 14) + enemy.str + scale };
    return;
  }

  if (enemy.id === "mimic") {
    const tt = choice(["multi", "attack", "debuff"]);
    if (tt === "multi") enemy.intent = { type: "multi", hits: 3, amount: rint(2, 4) + Math.floor(scale / 2) };
    else if (tt === "debuff") enemy.intent = { type: "debuff", debuff: "weak", amount: rint(1, 2) };
    else enemy.intent = { type: "attack", amount: rint(7, 10) + enemy.str + scale };
    return;
  }

  // Default behaviors
  if (t === "attack") enemy.intent = { type: "attack", amount: rint(6, 9) + enemy.str + scale };
  else if (t === "block") enemy.intent = { type: "block", amount: rint(6, 10) + scale };
  else if (t === "buff") enemy.intent = { type: "buff", amount: rint(1, 2) };
  else if (t === "debuff") enemy.intent = { type: "debuff", debuff: choice(["weak", "vuln"]), amount: rint(1, 2) };
  else if (t === "multi") enemy.intent = { type: "multi", hits: 2, amount: rint(3, 5) + Math.floor(scale / 2) };
}

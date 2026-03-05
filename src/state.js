export let state = null;

export function setState(next) { state = next; }

export function newRunState() {
  return {
    seed: Date.now(),
    floor: 1,
    phase: "map",

    player: {
      maxHp: 70,
      hp: 70,
      block: 0,
      energy: 3,
      str: 0,
      nextStr: 0,
      damageReduction: 0,
      gold: 99,
      relics: [],
      selfWeakNext: 0,
      status: { weak: 0, vuln: 0 },

      deck: [],
      draw: [],
      hand: [],
      discard: [],
      exhaust: [],
    },

    combat: null,
    pendingRewards: null,

    shop: null,
    event: null,
    treasure: null,

    message: "Choose your next room.",
  };
}

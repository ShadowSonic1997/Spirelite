import { choice } from "../utils.js";

export function generateEvent() {
  const events = [
    {
      title: "Mysterious Fountain",
      text: "A shimmering fountain hums quietly. It feels… helpful. Probably.",
      options: [
        { label: "Drink (+12 HP)", kind: "heal", amount: 12 },
        { label: "Bottle it (+1 random card)", kind: "card" },
        { label: "Walk away", kind: "none" },
      ],
    },
    {
      title: "Cursed Idol",
      text: "An idol offers power… for a price.",
      options: [
        { label: "Take it (+1 relic, -10 HP)", kind: "relic_hp", amount: 10 },
        { label: "Smash it (+40 gold, gain Vulnerable 2)", kind: "gold_vuln", gold: 40, vuln: 2 },
        { label: "Leave", kind: "none" },
      ],
    },
    {
      title: "Traveling Merchant",
      text: "A merchant offers a suspiciously good deal.",
      options: [
        { label: "Trade: 30g → upgrade random card", kind: "trade_upgrade", gold: 30 },
        { label: "Buy a random card (45g)", kind: "buy_card", gold: 45 },
        { label: "Decline", kind: "none" },
      ],
    },

    // NEW
    {
      title: "Astral Library",
      text: "Rows of floating books whisper your future deck choices.",
      options: [
        { label: "Study (+1 random card, upgrade it)", kind: "card_upgrade" },
        { label: "Skim (+35 gold)", kind: "gold", gold: 35 },
        { label: "Leave", kind: "none" },
      ],
    },
    {
      title: "Broken Automaton",
      text: "A sparking automaton offers you its core… but it’s unstable.",
      options: [
        { label: "Take the core (+1 relic, become Weak 2)", kind: "relic_weak", weak: 2 },
        { label: "Salvage parts (+60 gold, lose 6 HP)", kind: "gold_hp", gold: 60, hp: 6 },
        { label: "Walk away", kind: "none" },
      ],
    },
  ];

  return choice(events);
}

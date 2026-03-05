export const RoomTypes = {
  battle: {
    name: "Battle",
    badge: ["Combat", "bad"],
    desc: "Fight a pack of enemies. Win to pick an upgrade reward.",
  },
  elite: {
    name: "Elite",
    badge: ["Hard", "warn"],
    desc: "A tougher fight with better rewards.",
  },
  shop: {
    name: "Shop",
    badge: ["Gold", "good"],
    desc: "Spend gold: buy cards/relics, heal, or remove a card.",
  },
  rest: {
    name: "Rest Site",
    badge: ["Recovery", "good"],
    desc: "Heal or upgrade a card.",
  },
  event: {
    name: "Event",
    badge: ["Risky", "warn"],
    desc: "A random encounter with choices (some good, some bad).",
  },
  treasure: {
    name: "Treasure",
    badge: ["Loot", "good"],
    desc: "Grab a relic or a pile of gold.",
  },

  // NEW
  forge: {
    name: "Forge",
    badge: ["Upgrade", "warn"],
    desc: "Upgrade a card for free, or transmute one card into a random new card.",
  },
  curse: {
    name: "Cursed Hall",
    badge: ["Risk", "bad"],
    desc: "High risk, high reward. You might gain a relic… but is it worth it?",
  },
};

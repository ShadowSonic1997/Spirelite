import { state } from "../state.js";
import { rint } from "../utils.js";
import { Cards } from "../content/cards.js";
import { Relics } from "../content/relics.js";
import { randomCardOffer, randomRelic, gainRelic } from "./rewards.js";
import { log } from "../ui/log.js";

export function enterShop() {
  state.phase = "shop";
  state.shop = generateShopStock();
}

export function generateShopStock() {
  const cards = randomCardOffer(5);
  const relics = [randomRelic(), randomRelic(), randomRelic()];
  return {
    cards: cards.map(id => ({
      type: "card",
      id,
      price: Cards[id].rarity === "Rare" ? rint(135, 160)
        : Cards[id].rarity === "Uncommon" ? rint(95, 120)
        : rint(60, 85)
    })),
    relics: relics.map(id => ({
      type: "relic",
      id,
      price: Relics[id].rarity === "Uncommon" ? rint(160, 190) : rint(120, 150)
    })),
    healPrice: 45,
    removePrice: 60,
  };
}

export function buyShopItem(item) {
  if (state.player.gold < item.price) { log("Not enough gold.", "warn"); return false; }
  state.player.gold -= item.price;

  if (item.type === "card") {
    state.player.deck.push({ baseId: item.id, upgraded: false });
    log(`Bought ${Cards[item.id].name}.`, "good");
    state.shop.cards = state.shop.cards.filter(x => x !== item);
    return true;
  }

  gainRelic(item.id);
  state.shop.relics = state.shop.relics.filter(x => x !== item);
  return true;
}

/* Spirelite — vanilla JS roguelite (GitHub Pages-ready)
   - Rooms: battle / elite / shop / rest / event / treasure
   - StS-ish combat: deck/hand/discard, 3 energy, block, weak/vuln
   - Rewards: choose 1 of 3 upgrades after battle
*/

(() => {
  // ---------- Utilities ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---------- Card & Relic Libraries ----------
  // Card schema:
  // { id, name, cost, type, desc, tags, rarity, exhaust?, upgrade?:{...}, play(ctx) }
  const Cards = {};
  const makeCard = (c) => (Cards[c.id] = c);

  const dmgText = (n) => `${n} dmg`;
  const blockText = (n) => `${n} block`;

  // Core starter cards
  makeCard({
    id: "strike",
    name: "Strike",
    cost: 1,
    type: "Attack",
    rarity: "Starter",
    desc: `Deal ${dmgText(6)}.`,
    tags: ["Direct"],
    upgrade: { id: "strike+", name: "Strike+", desc: `Deal ${dmgText(9)}.` },
    play: (ctx) => dealDamage(ctx, pickTarget(ctx), ctx.upgraded ? 9 : 6),
  });

  makeCard({
    id: "defend",
    name: "Defend",
    cost: 1,
    type: "Skill",
    rarity: "Starter",
    desc: `Gain ${blockText(5)}.`,
    tags: ["Block"],
    upgrade: { id: "defend+", name: "Defend+", desc: `Gain ${blockText(8)}.` },
    play: (ctx) => gainBlock(ctx, ctx.upgraded ? 8 : 5),
  });

  makeCard({
    id: "bash",
    name: "Bash",
    cost: 2,
    type: "Attack",
    rarity: "Starter",
    desc: `Deal ${dmgText(8)}. Apply 2 Vulnerable.`,
    tags: ["Debuff"],
    upgrade: { id: "bash+", name: "Bash+", desc: `Deal ${dmgText(10)}. Apply 3 Vulnerable.` },
    play: (ctx) => {
      const t = pickTarget(ctx);
      dealDamage(ctx, t, ctx.upgraded ? 10 : 8);
      applyStatus(t, "vuln", ctx.upgraded ? 3 : 2);
      log(`Applied Vulnerable to ${t.name}.`, "warn");
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
    upgrade: { id: "quickstab+", name: "Quick Stab+", desc: `Deal ${dmgText(5)} twice.` },
    play: (ctx) => {
      const t = pickTarget(ctx);
      const d = ctx.upgraded ? 5 : 4;
      dealDamage(ctx, t, d);
      dealDamage(ctx, t, d);
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
    upgrade: { id: "guardup+", name: "Guard Up+", desc: `Gain ${blockText(9)}. Draw 1.` },
    play: (ctx) => {
      gainBlock(ctx, ctx.upgraded ? 9 : 7);
      drawCards(1);
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
    upgrade: { id: "focus+", name: "Focus+", desc: `Gain 3 Strength next turn.` },
    play: (ctx) => {
      const n = ctx.upgraded ? 3 : 2;
      state.player.nextStr += n;
      log(`You'll gain +${n} Strength next turn.`, "good");
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
    upgrade: { id: "smoke+", name: "Smoke Bomb+", desc: `Apply 3 Weak to ALL enemies.` },
    play: (ctx) => {
      const n = ctx.upgraded ? 3 : 2;
      for (const e of state.combat.enemies) applyStatus(e, "weak", n);
      log(`Applied Weak to all enemies.`, "warn");
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
    upgrade: { id: "cleave+", name: "Cleave+", desc: `Deal ${dmgText(7)} to ALL enemies.` },
    play: (ctx) => {
      const d = ctx.upgraded ? 7 : 5;
      for (const e of state.combat.enemies) dealDamage(ctx, e, d);
    },
  });

  // Uncommons
  makeCard({
    id: "finisher",
    name: "Finisher",
    cost: 2,
    type: "Attack",
    rarity: "Uncommon",
    desc: `Deal ${dmgText(14)}. If target is Vulnerable, gain 1 energy.`,
    tags: ["Synergy"],
    upgrade: { id: "finisher+", name: "Finisher+", desc: `Deal ${dmgText(18)}. If target is Vulnerable, gain 1 energy.` },
    play: (ctx) => {
      const t = pickTarget(ctx);
      const d = ctx.upgraded ? 18 : 14;
      dealDamage(ctx, t, d);
      if ((t.status.vuln || 0) > 0) {
        state.player.energy += 1;
        log(`Finisher refunded 1 energy!`, "good");
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
    upgrade: { id: "meditate+", name: "Meditate+", desc: `Draw 3. Exhaust.` },
    play: (ctx) => drawCards(ctx.upgraded ? 3 : 2),
  });

  makeCard({
    id: "fortify",
    name: "Fortify",
    cost: 2,
    type: "Skill",
    rarity: "Uncommon",
    desc: `Gain ${blockText(14)}. Reduce incoming damage by 1 this turn.`,
    tags: ["Block", "Shield"],
    upgrade: { id: "fortify+", name: "Fortify+", desc: `Gain ${blockText(18)}. Reduce incoming damage by 1 this turn.` },
    play: (ctx) => {
      gainBlock(ctx, ctx.upgraded ? 18 : 14);
      state.player.damageReduction += 1;
      log(`Damage taken -1 this turn.`, "good");
    },
  });

  // Rares
  makeCard({
    id: "overcharge",
    name: "Overcharge",
    cost: 0,
    type: "Skill",
    rarity: "Rare",
    desc: `Gain 2 energy. Apply 1 Weak to yourself next turn.`,
    tags: ["Energy"],
    upgrade: { id: "overcharge+", name: "Overcharge+", desc: `Gain 3 energy. Apply 1 Weak to yourself next turn.` },
    play: (ctx) => {
      const n = ctx.upgraded ? 3 : 2;
      state.player.energy += n;
      state.player.selfWeakNext += 1;
      log(`+${n} energy now, but you'll be Weak next turn.`, "warn");
    },
  });

  makeCard({
    id: "reaper",
    name: "Reaper",
    cost: 2,
    type: "Attack",
    rarity: "Rare",
    desc: `Deal ${dmgText(10)} to ALL enemies. Heal for half the unblocked damage dealt.`,
    tags: ["AoE", "Heal"],
    upgrade: { id: "reaper+", name: "Reaper+", desc: `Deal ${dmgText(13)} to ALL enemies. Heal for half the unblocked damage dealt.` },
    play: (ctx) => {
      const d = ctx.upgraded ? 13 : 10;
      let healed = 0;
      for (const e of state.combat.enemies) {
        const before = e.hp;
        dealDamage(ctx, e, d);
        const delta = Math.max(0, before - e.hp);
        healed += Math.floor(delta / 2);
      }
      if (healed > 0) healPlayer(healed);
    },
  });

  const Relics = {};
  const makeRelic = (r) => (Relics[r.id] = r);

  makeRelic({
    id: "luckycoin",
    name: "Lucky Coin",
    rarity: "Common",
    desc: `Start each floor with +15 gold.`,
    onNewFloor: () => { state.player.gold += 15; log(`Lucky Coin: +15 gold.`, "good"); }
  });

  makeRelic({
    id: "ironheart",
    name: "Iron Heart",
    rarity: "Common",
    desc: `Max HP +8.`,
    onGain: () => { state.player.maxHp += 8; state.player.hp += 8; }
  });

  makeRelic({
    id: "swiftgloves",
    name: "Swift Gloves",
    rarity: "Uncommon",
    desc: `At the start of combat, draw +1 card.`,
    onCombatStart: () => { drawCards(1); log(`Swift Gloves: drew +1.`, "good"); }
  });

  makeRelic({
    id: "spikeshield",
    name: "Spike Shield",
    rarity: "Uncommon",
    desc: `Whenever you gain Block, deal 1 damage to a random enemy.`,
    onGainBlock: () => {
      const e = randomLivingEnemy();
      if (e) dealDamage({ source: "relic" }, e, 1, { ignoreStrength: true });
    }
  });

  makeRelic({
    id: "bloodvial",
    name: "Blood Vial",
    rarity: "Common",
    desc: `After each combat, heal 3.`,
    onCombatWin: () => healPlayer(3)
  });

  // ---------- State ----------
  let state = null;

  function newRun() {
    state = {
      seed: Date.now(),
      floor: 1,
      phase: "map", // map | combat | reward | shop | rest | event | treasure | gameover
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
      message: "Choose your next room.",
    };

    // Starter deck
    addToDeck("strike", 5);
    addToDeck("defend", 5);
    addToDeck("bash", 1);

    // Starter relic
    gainRelic(randomRelic(["luckycoin", "ironheart", "swiftgloves"]));

    // Start-of-floor relic triggers
    triggerRelics("onNewFloor");

    logClear();
    log(`New run started.`, "info");
    renderAll();
  }

  // ---------- Deck helpers ----------
  function addToDeck(cardId, count = 1) {
    for (let i = 0; i < count; i++) state.player.deck.push({ baseId: cardId, upgraded: false });
  }

  function cardName(cardInst) {
    const base = Cards[cardInst.baseId];
    if (!base) return "???";
    return cardInst.upgraded ? (base.upgrade?.name || (base.name + "+")) : base.name;
  }

  function makePlayable(cardInst) {
    const base = Cards[cardInst.baseId];
    return {
      ...base,
      upgraded: cardInst.upgraded,
      inst: cardInst,
      displayName: cardName(cardInst),
      displayDesc: cardInst.upgraded && base.upgrade?.desc ? base.upgrade.desc : base.desc,
    };
  }

  function rebuildDrawPile() {
    state.player.draw = shuffle([...state.player.draw, ...state.player.discard]);
    state.player.discard = [];
  }

  function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (state.player.draw.length === 0) rebuildDrawPile();
      if (state.player.draw.length === 0) return; // no cards anywhere
      state.player.hand.push(state.player.draw.pop());
    }
    renderAll();
  }

  function discardHand() {
    state.player.discard.push(...state.player.hand);
    state.player.hand = [];
  }

  // ---------- Combat ----------
  function startCombat(encounter) {
    state.phase = "combat";
    state.player.block = 0;
    state.player.energy = baseEnergy();
    state.player.damageReduction = 0;

    // Set up piles
    state.player.draw = shuffle([...state.player.deck]);
    state.player.hand = [];
    state.player.discard = [];
    state.player.exhaust = [];

    state.combat = {
      turn: 1,
      enemies: encounter.enemies.map(cloneEnemy),
    };

    // Roll intents
    for (const e of state.combat.enemies) rollIntent(e);

    // Start effects
    applyTurnStartPlayerEffects();
    drawCards(baseHandSize());
    triggerRelics("onCombatStart");

    log(`Combat started: ${encounter.name}`, "info");
    renderAll();
  }

  function baseEnergy() {
    // (easy expansion later) — relics could modify this
    return 3;
  }

  function baseHandSize() {
    return 5;
  }

  function endPlayerTurn() {
    if (state.phase !== "combat") return;

    // end-of-turn: keep block? no (StS style reset)
    discardHand();

    // Enemy turn
    for (const e of livingEnemies()) enemyAct(e);

    // Cleanup dead
    cleanupDeadEnemies();

    // Check win/lose
    if (state.player.hp <= 0) {
      gameOver();
      return;
    }
    if (livingEnemies().length === 0) {
      winCombat();
      return;
    }

    // Next turn
    state.combat.turn += 1;
    state.player.block = 0;
    state.player.energy = baseEnergy();
    state.player.damageReduction = 0;

    // Tick player statuses
    tickStatus(state.player.status);
    // Apply delayed strength
    if (state.player.nextStr > 0) {
      state.player.str += state.player.nextStr;
      log(`Gained +${state.player.nextStr} Strength.`, "good");
      state.player.nextStr = 0;
    }
    // Self weak next
    if (state.player.selfWeakNext > 0) {
      applyStatus(state.player, "weak", state.player.selfWeakNext);
      log(`You became Weak.`, "warn");
      state.player.selfWeakNext = 0;
    }

    // Enemy intents reroll
    for (const e of livingEnemies()) rollIntent(e);

    // Draw
    applyTurnStartPlayerEffects();
    drawCards(baseHandSize());

    renderAll();
  }

  function applyTurnStartPlayerEffects() {
    // Placeholder for future effects
  }

  function playCardFromHand(index, targetIndex = 0) {
    if (state.phase !== "combat") return;

    const cardInst = state.player.hand[index];
    if (!cardInst) return;
    const card = makePlayable(cardInst);

    if (card.cost > state.player.energy) {
      log(`Not enough energy for ${card.displayName}.`, "warn");
      return;
    }

    state.player.energy -= card.cost;

    // context for card logic
    const ctx = {
      upgraded: cardInst.upgraded,
      source: "player",
      targetIndex,
    };

    card.play(ctx);

    // move card to discard/exhaust
    const removed = state.player.hand.splice(index, 1)[0];
    if (card.exhaust) state.player.exhaust.push(removed);
    else state.player.discard.push(removed);

    cleanupDeadEnemies();
    if (livingEnemies().length === 0) {
      winCombat();
      return;
    }

    renderAll();
  }

  function pickTarget(ctx) {
    const enemies = livingEnemies();
    if (enemies.length === 0) return null;
    const idx = clamp(ctx.targetIndex ?? 0, 0, enemies.length - 1);
    return enemies[idx];
  }

  function dealDamage(ctx, target, amount, opts = {}) {
    if (!target) return;
    let dmg = amount;

    // Strength only for player attacks unless ignoreStrength
    if (!opts.ignoreStrength && ctx?.source === "player") dmg += state.player.str;

    // Weak / Vulnerable
    const attackerStatus = ctx?.source === "player" ? state.player.status : (ctx?.source === "enemy" ? ctx.enemy.status : null);
    if (attackerStatus?.weak) dmg = Math.floor(dmg * 0.75);
    if (target.status?.vuln) dmg = Math.floor(dmg * 1.25);

    dmg = Math.max(0, dmg);

    // Block + damage reduction (player only)
    if (target === state.player) {
      dmg = Math.max(0, dmg - (state.player.damageReduction || 0));
      const blocked = Math.min(state.player.block, dmg);
      state.player.block -= blocked;
      dmg -= blocked;
      if (blocked > 0) log(`Blocked ${blocked}.`, "good");
      if (dmg > 0) log(`You took ${dmg} damage.`, "bad");
      state.player.hp -= dmg;
      return;
    }

    // Enemy block
    const blocked = Math.min(target.block, dmg);
    target.block -= blocked;
    dmg -= blocked;
    if (blocked > 0) log(`${target.name} blocked ${blocked}.`, "info");
    if (dmg > 0) log(`${target.name} took ${dmg} damage.`, "good");
    target.hp -= dmg;
  }

  function gainBlock(ctx, amount) {
    state.player.block += amount;
    log(`Gained ${amount} Block.`, "good");
    triggerRelics("onGainBlock");
  }

  function healPlayer(amount) {
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + amount, 0, state.player.maxHp);
    const gained = state.player.hp - before;
    if (gained > 0) log(`Healed ${gained}.`, "good");
  }

  function applyStatus(entity, key, amount) {
    if (!entity.status) entity.status = {};
    entity.status[key] = (entity.status[key] || 0) + amount;
  }

  function tickStatus(statusObj) {
    for (const k of Object.keys(statusObj)) statusObj[k] = Math.max(0, (statusObj[k] || 0) - 1);
  }

  function enemyAct(enemy) {
    if (!enemy.intent) rollIntent(enemy);

    // reset enemy block each turn (simple)
    enemy.block = 0;

    const intent = enemy.intent;
    if (intent.type === "attack") {
      dealDamage({ source: "enemy", enemy }, state.player, intent.amount);
    } else if (intent.type === "block") {
      enemy.block += intent.amount;
      log(`${enemy.name} gained ${intent.amount} Block.`, "info");
    } else if (intent.type === "buff") {
      enemy.str += intent.amount;
      log(`${enemy.name} gained +${intent.amount} Strength.`, "warn");
    } else if (intent.type === "debuff") {
      if (intent.debuff === "weak") applyStatus(state.player, "weak", intent.amount);
      if (intent.debuff === "vuln") applyStatus(state.player, "vuln", intent.amount);
      log(`${enemy.name} applied ${intent.debuff}.`, "warn");
    } else if (intent.type === "multi") {
      for (let i = 0; i < intent.hits; i++) dealDamage({ source: "enemy", enemy }, state.player, intent.amount);
    }

    // tick enemy statuses after action
    tickStatus(enemy.status);
  }

  function cleanupDeadEnemies() {
    const before = state.combat.enemies.length;
    state.combat.enemies = state.combat.enemies.filter(e => e.hp > 0);
    if (state.combat.enemies.length < before) {
      // keep intents stable for remaining
    }
  }

  function livingEnemies() {
    if (!state.combat) return [];
    return state.combat.enemies.filter(e => e.hp > 0);
  }

  function randomLivingEnemy() {
    const arr = livingEnemies();
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Encounters / Enemies ----------
  function cloneEnemy(e) {
    return {
      ...e,
      hp: e.maxHp,
      block: 0,
      str: 0,
      status: { weak: 0, vuln: 0 },
      intent: null,
    };
  }

  const EnemyDefs = {
    slime: { id: "slime", name: "Slime", maxHp: 28, intents: ["attack", "block", "debuff"] },
    cultist: { id: "cultist", name: "Cultist", maxHp: 30, intents: ["attack", "buff"] },
    fang: { id: "fang", name: "Fang Bat", maxHp: 22, intents: ["multi", "attack", "debuff"] },
    golem: { id: "golem", name: "Golem", maxHp: 40, intents: ["attack", "block"] },
    seer: { id: "seer", name: "Void Seer", maxHp: 34, intents: ["debuff", "attack", "buff"] },
  };

  function rollIntent(enemy) {
    const base = EnemyDefs[enemy.id];
    const t = choice(base.intents);
    const depth = state.floor;

    // scale slightly with floor
    const scale = 1 + Math.floor((depth - 1) / 4);

    if (t === "attack") {
      const amt = rint(6, 9) + enemy.str + scale;
      enemy.intent = { type: "attack", amount: amt };
    } else if (t === "block") {
      enemy.intent = { type: "block", amount: rint(6, 10) + scale };
    } else if (t === "buff") {
      enemy.intent = { type: "buff", amount: rint(1, 2) };
    } else if (t === "debuff") {
      enemy.intent = { type: "debuff", debuff: choice(["weak", "vuln"]), amount: rint(1, 2) };
    } else if (t === "multi") {
      enemy.intent = { type: "multi", hits: 2, amount: rint(3, 5) + Math.floor(scale / 2) };
    }
  }

  function generateEncounter(kind = "battle") {
    const depth = state.floor;

    const pool = ["slime", "cultist", "fang", "golem", "seer"];
    const enemyCount =
      kind === "elite" ? rint(2, 3) :
      depth < 3 ? rint(1, 2) :
      rint(2, 3);

    const enemies = [];
    for (let i = 0; i < enemyCount; i++) enemies.push(EnemyDefs[choice(pool)]);

    // Elite bump: bigger hp
    const encounter = {
      name: kind === "elite" ? "Elite Pack" : "Battle",
      kind,
      enemies: enemies.map(e => ({
        ...e,
        maxHp: e.maxHp + (kind === "elite" ? 10 : 0) + Math.floor((depth - 1) * 1.5),
      })),
    };
    return encounter;
  }

  // ---------- Rooms / Map ----------
  const RoomTypes = {
    battle: {
      name: "Battle",
      badge: ["Combat", "bad"],
      desc: "Fight a pack of enemies. Win to pick an upgrade reward.",
      enter: () => startCombat(generateEncounter("battle")),
    },
    elite: {
      name: "Elite",
      badge: ["Hard", "warn"],
      desc: "A tougher fight with better rewards.",
      enter: () => startCombat(generateEncounter("elite")),
    },
    shop: {
      name: "Shop",
      badge: ["Gold", "good"],
      desc: "Spend gold: buy cards/relics, heal, or remove a card.",
      enter: () => enterShop(),
    },
    rest: {
      name: "Rest Site",
      badge: ["Recovery", "good"],
      desc: "Heal or upgrade a card.",
      enter: () => enterRest(),
    },
    event: {
      name: "Event",
      badge: ["Risky", "warn"],
      desc: "A random encounter with choices (some good, some bad).",
      enter: () => enterEvent(),
    },
    treasure: {
      name: "Treasure",
      badge: ["Loot", "good"],
      desc: "Grab a relic or a pile of gold.",
      enter: () => enterTreasure(),
    },
  };

  function nextRoomChoices() {
    const depth = state.floor;

    // weights shift with depth
    const weights = [
      ["battle", 48],
      ["elite", depth > 2 ? 12 : 6],
      ["shop", 14],
      ["rest", 14],
      ["event", 10],
      ["treasure", 8],
    ];

    const drawOne = () => {
      const total = weights.reduce((s, [,w]) => s + w, 0);
      let roll = Math.random() * total;
      for (const [t, w] of weights) {
        roll -= w;
        if (roll <= 0) return t;
      }
      return "battle";
    };

    const picks = [];
    for (let i = 0; i < 3; i++) picks.push(drawOne());
    return picks;
  }

  function enterRoom(type) {
    // new floor
    state.message = "";
    state.phase = "map"; // temporarily
    state.currentRoom = type;

    // floor increment happens when you choose the room
    const justEnteredFloor = state.floor;
    log(`Entered floor ${justEnteredFloor}: ${RoomTypes[type].name}`, "info");

    // Enter
    RoomTypes[type].enter();
  }

  function advanceFloor() {
    state.floor += 1;
    triggerRelics("onNewFloor");
  }

  // ---------- Rewards ----------
  function winCombat() {
    const kind = state.combat?.kind || "battle";
    const baseGold = kind === "elite" ? rint(35, 55) : rint(18, 32);
    state.player.gold += baseGold;
    log(`Won combat! +${baseGold} gold.`, "good");

    triggerRelics("onCombatWin");

    state.phase = "reward";
    state.pendingRewards = generateRewards(kind);
    state.combat = null;
    renderAll();
  }

  function generateRewards(kind) {
    const options = [];

    // Reward slots: pick 1 of 3
    for (let i = 0; i < 3; i++) {
      const roll = Math.random();
      if (roll < 0.55) {
        options.push(makeRewardAddCard());
      } else if (roll < 0.82) {
        options.push(makeRewardUpgradeCard());
      } else {
        options.push(makeRewardRelicOrGold(kind));
      }
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
        log(`Upgraded ${cardName(c)}.`, "good");
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

  function randomCardOffer(n) {
    const pool = Object.values(Cards)
      .filter(c => c.rarity !== "Starter")
      .map(c => c.id);

    // rarity weighting
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

  function randomRelic(allowedIds = null) {
    const pool = allowedIds ? allowedIds : Object.keys(Relics);
    // avoid duplicates if possible
    const notOwned = pool.filter(id => !state.player.relics.includes(id));
    return choice(notOwned.length ? notOwned : pool);
  }

  function gainRelic(id) {
    if (!id) return;
    if (!state.player.relics.includes(id)) state.player.relics.push(id);
    const r = Relics[id];
    log(`Relic gained: ${r.name}.`, "good");
    if (r.onGain) r.onGain();
    renderAll();
  }

  function triggerRelics(hook) {
    for (const rid of state.player.relics) {
      const r = Relics[rid];
      if (r && typeof r[hook] === "function") r[hook]();
    }
    renderAll();
  }

  // ---------- Shop / Rest / Event / Treasure ----------
  function enterShop() {
    state.phase = "shop";
    state.shop = generateShopStock();
    renderAll();
  }

  function generateShopStock() {
    const cards = randomCardOffer(5);
    const relics = [randomRelic(), randomRelic(), randomRelic()];
    return {
      cards: cards.map(id => ({
        type: "card",
        id,
        price: Cards[id].rarity === "Rare" ? rint(135, 160) : Cards[id].rarity === "Uncommon" ? rint(95, 120) : rint(60, 85)
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

  function enterRest() {
    state.phase = "rest";
    renderAll();
  }

  function enterEvent() {
    state.phase = "event";
    state.event = generateEvent();
    renderAll();
  }

  function generateEvent() {
    const events = [
      {
        title: "Mysterious Fountain",
        text: "A shimmering fountain hums quietly. It feels… helpful. Probably.",
        options: [
          { label: "Drink (+12 HP)", effect: () => healPlayer(12) },
          { label: "Bottle it (+1 random card)", effect: () => {
              const id = randomCardOffer(1)[0];
              state.player.deck.push({ baseId: id, upgraded: false });
              log(`You found ${Cards[id].name}.`, "good");
            }
          },
          { label: "Walk away", effect: () => log("You leave it alone.", "info") },
        ],
      },
      {
        title: "Cursed Idol",
        text: "An idol offers power… for a price.",
        options: [
          { label: "Take it (+1 relic, -10 HP)", effect: () => {
              state.player.hp = clamp(state.player.hp - 10, 1, state.player.maxHp);
              gainRelic(randomRelic());
              log("Ow. Worth?", "warn");
            }
          },
          { label: "Smash it (+40 gold, become Vulnerable 2)", effect: () => {
              state.player.gold += 40;
              applyStatus(state.player, "vuln", 2);
              log("Shards fly everywhere.", "warn");
            }
          },
          { label: "Leave", effect: () => log("Not today.", "info") },
        ],
      },
      {
        title: "Traveling Merchant",
        text: "A merchant offers a suspiciously good deal.",
        options: [
          { label: "Trade: 30 gold → upgrade random card", effect: () => {
              if (state.player.gold < 30) { log("Not enough gold.", "warn"); return; }
              state.player.gold -= 30;
              const upgradable = state.player.deck.map((c,i)=>({c,i})).filter(x=>!x.c.upgraded);
              if (upgradable.length === 0) { log("No cards to upgrade.", "warn"); return; }
              const pick = choice(upgradable);
              pick.c.upgraded = true;
              log(`Upgraded ${cardName(pick.c)}.`, "good");
            }
          },
          { label: "Buy a random card (45 gold)", effect: () => {
              if (state.player.gold < 45) { log("Not enough gold.", "warn"); return; }
              state.player.gold -= 45;
              const id = randomCardOffer(1)[0];
              state.player.deck.push({ baseId: id, upgraded: false });
              log(`Bought ${Cards[id].name}.`, "good");
            }
          },
          { label: "Decline", effect: () => log("You keep walking.", "info") },
        ],
      },
    ];
    return choice(events);
  }

  function enterTreasure() {
    state.phase = "treasure";
    state.treasure = generateTreasure();
    renderAll();
  }

  function generateTreasure() {
    const relicChance = 0.65;
    if (Math.random() < relicChance) {
      const id = randomRelic();
      return { kind: "relic", id, text: `${Relics[id].name}: ${Relics[id].desc}` };
    }
    const gold = rint(60, 120);
    return { kind: "gold", gold, text: `A heavy pouch: +${gold} gold.` };
  }

  // ---------- Game over ----------
  function gameOver() {
    state.phase = "gameover";
    log("You were defeated. Run over.", "bad");
    renderAll();
  }

  // ---------- UI / Rendering ----------
  function renderAll() {
    renderHUD();
    renderLeft();
    renderScreen();
  }

  function renderHUD() {
    $("hudFloor").textContent = `Floor: ${state.floor}`;
    $("hudGold").textContent = `Gold: ${state.player.gold}`;
    $("hudRelics").textContent = `Relics: ${state.player.relics.length}`;
  }

  function renderLeft() {
    $("pHp").textContent = `${state.player.hp} / ${state.player.maxHp}`;
    $("pHpBar").style.width = `${Math.floor((state.player.hp / state.player.maxHp) * 100)}%`;
    $("pBlock").textContent = `${state.player.block}`;
    $("pEnergy").textContent = `${state.player.energy}`;
    $("pStatus").textContent = statusLine(state.player.status);

    $("drawCount").textContent = state.player.draw.length;
    $("discardCount").textContent = state.player.discard.length;
    $("exhaustCount").textContent = state.player.exhaust.length;

    const rlist = state.player.relics.map(id => `• ${Relics[id].name}`).join("\n");
    $("leftNote").textContent =
      `Tip: Click a card to play it.\n` +
      `End your turn when you're out of energy.\n\n` +
      `Relics:\n${rlist || "• (none)"}`;
  }

  function statusLine(s) {
    const parts = [];
    if (s.weak) parts.push(`Weak ${s.weak}`);
    if (s.vuln) parts.push(`Vulnerable ${s.vuln}`);
    return parts.length ? parts.join(" • ") : "None";
  }

  function renderScreen() {
    const screen = $("screen");
    screen.innerHTML = "";

    if (state.phase === "map") {
      screen.appendChild(renderMap());
    } else if (state.phase === "combat") {
      screen.appendChild(renderCombat());
    } else if (state.phase === "reward") {
      screen.appendChild(renderRewards());
    } else if (state.phase === "shop") {
      screen.appendChild(renderShop());
    } else if (state.phase === "rest") {
      screen.appendChild(renderRest());
    } else if (state.phase === "event") {
      screen.appendChild(renderEvent());
    } else if (state.phase === "treasure") {
      screen.appendChild(renderTreasure());
    } else if (state.phase === "gameover") {
      screen.appendChild(renderGameOver());
    }
  }

  function renderMap() {
    const wrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "roomCard";
    title.innerHTML = `
      <h3>Choose your next room</h3>
      <p>You sometimes get duplicates — that’s the chaos. Survive, scale, and try not to explode.</p>
      <div class="roomMeta">
        <span class="badge">Deck: ${state.player.deck.length}</span>
        <span class="badge">HP: ${state.player.hp}/${state.player.maxHp}</span>
        <span class="badge">Gold: ${state.player.gold}</span>
      </div>
    `;
    wrap.appendChild(title);

    const choices = nextRoomChoices();
    const grid = document.createElement("div");
    grid.className = "choiceGrid";

    for (const t of choices) {
      const rt = RoomTypes[t];
      const card = document.createElement("div");
      card.className = "roomCard";
      card.innerHTML = `
        <div class="roomMeta">
          <span class="badge ${rt.badge[1]}">${rt.badge[0]}</span>
          <span class="badge">${rt.name}</span>
        </div>
        <h3>${rt.name}</h3>
        <p>${rt.desc}</p>
      `;
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = `Enter ${rt.name}`;
      btn.onclick = () => {
        // choosing a room advances to the next floor first
        // (floor 1 = first choice screen, then enter room on floor 1)
        // After you finish the room, you'll advance to next floor.
        enterRoom(t);
      };
      card.appendChild(btn);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    // After each "room resolution" we advance floor (so map shows new floor)
    // We do it when leaving non-combat phases (button handlers below).
    return wrap;
  }

  function renderCombat() {
    const wrap = document.createElement("div");

    const top = document.createElement("div");
    top.className = "combatTop";

    const left = document.createElement("div");
    left.className = "roomCard";
    left.innerHTML = `
      <h3>Combat — Turn ${state.combat.turn}</h3>
      <p>Enemies show their intent. Block reduces damage this turn only.</p>
      <div class="roomMeta">
        <span class="badge">Energy: ${state.player.energy}</span>
        <span class="badge">Strength: ${state.player.str}</span>
        <span class="badge">Hand: ${state.player.hand.length}</span>
      </div>
    `;

    const btnEnd = document.createElement("button");
    btnEnd.className = "btn danger";
    btnEnd.textContent = "End Turn";
    btnEnd.onclick = () => endPlayerTurn();

    left.appendChild(btnEnd);
    top.appendChild(left);

    const enemiesWrap = document.createElement("div");
    enemiesWrap.className = "enemyWrap";

    const enemies = state.combat.enemies;
    enemies.forEach((e, i) => {
      const el = document.createElement("div");
      el.className = "enemy";
      const hpPct = Math.floor((e.hp / e.maxHp) * 100);
      el.innerHTML = `
        <div class="enemyName">${e.name}</div>
        <div class="enemyHP">${e.hp} / ${e.maxHp} ${e.block ? `• Block ${e.block}` : ""}</div>
        <div class="enemyBar"><div class="enemyFill" style="width:${hpPct}%;"></div></div>
        <div class="enemyLine">
          <span>Status: ${statusLine(e.status)}</span>
          <span class="intent">Intent: ${intentText(e.intent)}</span>
        </div>
        <div class="enemyLine"><span>Target: #${i + 1}</span><span>Str: ${e.str}</span></div>
      `;
      enemiesWrap.appendChild(el);
    });

    top.appendChild(enemiesWrap);
    wrap.appendChild(top);

    // Hand
    const hand = document.createElement("div");
    hand.className = "hand";
    hand.innerHTML = `
      <div class="handHead">
        <div><strong>Your Hand</strong> <span class="pill">Click to play</span></div>
        <div class="row">
          <span class="pill">Tip: Shift+Click sets target #2, Alt+Click sets target #3</span>
        </div>
      </div>
    `;

    const cardsRow = document.createElement("div");
    cardsRow.className = "handCards";

    state.player.hand.forEach((inst, idx) => {
      const c = makePlayable(inst);
      const playable = c.cost <= state.player.energy;

      const card = document.createElement("div");
      card.className = `card ${playable ? "playable" : "unplayable"}`;
      card.innerHTML = `
        <div class="top">
          <div class="name">${c.displayName}</div>
          <div class="cost">${c.cost}</div>
        </div>
        <div class="type">${c.type} • ${Cards[inst.baseId].rarity}${inst.upgraded ? " • Upgraded" : ""}</div>
        <div class="desc">${c.displayDesc}</div>
        <div class="tags">${(c.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      `;

      card.onclick = (ev) => {
        if (!playable) return;

        // targeting quick modifier
        let t = 0;
        if (ev.shiftKey) t = 1;
        if (ev.altKey) t = 2;

        playCardFromHand(idx, t);
      };

      cardsRow.appendChild(card);
    });

    hand.appendChild(cardsRow);
    wrap.appendChild(hand);

    return wrap;
  }

  function intentText(intent) {
    if (!intent) return "—";
    if (intent.type === "attack") return `Attack ${intent.amount}`;
    if (intent.type === "block") return `Block ${intent.amount}`;
    if (intent.type === "buff") return `Buff +${intent.amount} Str`;
    if (intent.type === "debuff") return `Debuff ${intent.debuff} ${intent.amount}`;
    if (intent.type === "multi") return `Multi ${intent.hits}×${intent.amount}`;
    return "—";
  }

  function renderRewards() {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `
      <h3>Choose a reward</h3>
      <p>Pick exactly one. After that, you’ll go to the next floor.</p>
      <div class="roomMeta">
        <span class="badge">Gold: ${state.player.gold}</span>
        <span class="badge">Deck: ${state.player.deck.length}</span>
      </div>
    `;
    wrap.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "choiceGrid";

    state.pendingRewards.forEach((r) => {
      const card = document.createElement("div");
      card.className = "roomCard";
      card.innerHTML = `
        <div class="roomMeta">
          <span class="badge ${r.kind === "relic" ? "good" : r.kind === "upgrade" ? "warn" : ""}">${r.kind.toUpperCase()}</span>
        </div>
        <h3>${r.title}</h3>
        <p>${r.desc}</p>
      `;

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Choose";
      btn.onclick = () => {
        handleRewardChoice(r);
      };

      card.appendChild(btn);
      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    const skip = document.createElement("button");
    skip.className = "btn ghost";
    skip.textContent = "Skip reward";
    skip.onclick = () => {
      log("Skipped reward.", "info");
      endRoomAndGoMap();
    };
    wrap.appendChild(skip);

    return wrap;
  }

  function handleRewardChoice(reward) {
    if (reward.kind === "card") {
      openModal("Add a card", renderCardPick(reward.picks, (id) => {
        reward.apply(id);
        closeModal();
        endRoomAndGoMap();
      }));
    } else if (reward.kind === "upgrade") {
      openModal("Upgrade a card", renderUpgradePick((idx) => {
        reward.apply(idx);
        closeModal();
        endRoomAndGoMap();
      }));
    } else {
      reward.apply();
      endRoomAndGoMap();
    }
  }

  function renderShop() {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `
      <h3>Shop</h3>
      <p>Buy stuff to scale. You can also remove a card (thinning your deck is strong).</p>
      <div class="roomMeta">
        <span class="badge good">Gold: ${state.player.gold}</span>
        <span class="badge">Deck: ${state.player.deck.length}</span>
      </div>
    `;
    wrap.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "choiceGrid";

    // cards
    const cardBox = document.createElement("div");
    cardBox.className = "roomCard";
    cardBox.innerHTML = `<h3>Cards</h3><p>Pick a card to buy.</p>`;
    const cg = document.createElement("div");
    cg.className = "cardGrid";
    for (const it of state.shop.cards) {
      cg.appendChild(renderShopItem(it));
    }
    cardBox.appendChild(cg);
    grid.appendChild(cardBox);

    // relics
    const relicBox = document.createElement("div");
    relicBox.className = "roomCard";
    relicBox.innerHTML = `<h3>Relics</h3><p>Powerful passive effects.</p>`;
    const rg = document.createElement("div");
    rg.className = "cardGrid";
    for (const it of state.shop.relics) {
      rg.appendChild(renderShopItem(it));
    }
    relicBox.appendChild(rg);
    grid.appendChild(relicBox);

    wrap.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "roomCard";
    actions.innerHTML = `<h3>Services</h3><p>Sometimes the boring choice is the correct choice.</p>`;
    const row = document.createElement("div");
    row.className = "row";

    const healBtn = document.createElement("button");
    healBtn.className = "btn good";
    healBtn.textContent = `Heal 15 HP (${state.shop.healPrice}g)`;
    healBtn.disabled = state.player.gold < state.shop.healPrice || state.player.hp >= state.player.maxHp;
    healBtn.onclick = () => {
      state.player.gold -= state.shop.healPrice;
      healPlayer(15);
      renderAll();
    };

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn warn";
    removeBtn.textContent = `Remove a card (${state.shop.removePrice}g)`;
    removeBtn.disabled = state.player.gold < state.shop.removePrice || state.player.deck.length <= 1;
    removeBtn.onclick = () => {
      openModal("Remove a card", renderRemovePick((idx) => {
        state.player.gold -= state.shop.removePrice;
        const removed = state.player.deck.splice(idx, 1)[0];
        log(`Removed ${cardName(removed)} from your deck.`, "good");
        closeModal();
        renderAll();
      }));
    };

    row.appendChild(healBtn);
    row.appendChild(removeBtn);
    actions.appendChild(row);

    const leave = document.createElement("button");
    leave.className = "btn";
    leave.textContent = "Leave shop";
    leave.onclick = () => endRoomAndGoMap();
    actions.appendChild(document.createElement("div")).className = "row";
    actions.appendChild(leave);

    wrap.appendChild(actions);
    return wrap;
  }

  function renderShopItem(item) {
    const el = document.createElement("div");
    el.className = "card";
    if (item.type === "card") {
      const c = Cards[item.id];
      el.innerHTML = `
        <div class="top"><div class="name">${c.name}</div><div class="cost">${item.price}g</div></div>
        <div class="type">${c.type} • ${c.rarity}</div>
        <div class="desc">${c.desc}</div>
      `;
      el.classList.add("playable");
      el.onclick = () => {
        if (state.player.gold < item.price) { log("Not enough gold.", "warn"); return; }
        state.player.gold -= item.price;
        state.player.deck.push({ baseId: item.id, upgraded: false });
        log(`Bought ${c.name}.`, "good");
        // remove from stock
        state.shop.cards = state.shop.cards.filter(x => x !== item);
        renderAll();
      };
    } else {
      const r = Relics[item.id];
      el.innerHTML = `
        <div class="top"><div class="name">${r.name}</div><div class="cost">${item.price}g</div></div>
        <div class="type">Relic • ${r.rarity}</div>
        <div class="desc">${r.desc}</div>
      `;
      el.classList.add("playable");
      el.onclick = () => {
        if (state.player.gold < item.price) { log("Not enough gold.", "warn"); return; }
        state.player.gold -= item.price;
        gainRelic(item.id);
        state.shop.relics = state.shop.relics.filter(x => x !== item);
        renderAll();
      };
    }
    return el;
  }

  function renderRest() {
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "roomCard";
    head.innerHTML = `
      <h3>Rest Site</h3>
      <p>Choose carefully: healing is safety, upgrading is power.</p>
      <div class="roomMeta">
        <span class="badge good">HP: ${state.player.hp}/${state.player.maxHp}</span>
        <span class="badge">Deck: ${state.player.deck.length}</span>
      </div>
    `;
    wrap.appendChild(head);

    const box = document.createElement("div");
    box.className = "roomCard";

    const healAmount = Math.floor(state.player.maxHp * 0.28);
    box.innerHTML = `
      <h3>Options</h3>
      <p>Heal restores ${healAmount} HP (28% max). Upgrade makes a card stronger permanently.</p>
    `;

    const row = document.createElement("div");
    row.className = "row";

    const healBtn = document.createElement("button");
    healBtn.className = "btn good";
    healBtn.textContent = `Rest (+${healAmount} HP)`;
    healBtn.disabled = state.player.hp >= state.player.maxHp;
    healBtn.onclick = () => { healPlayer(healAmount); endRoomAndGoMap(); };

    const upBtn = document.createElement("button");
    upBtn.className = "btn warn";
    upBtn.textContent = `Smith (Upgrade a card)`;
    upBtn.onclick = () => {
      openModal("Upgrade a card", renderUpgradePick((idx) => {
        const c = state.player.deck[idx];
        if (!c || c.upgraded) return;
        c.upgraded = true;
        log(`Upgraded ${cardName(c)}.`, "good");
        closeModal();
        endRoomAndGoMap();
      }));
    };

    row.appendChild(healBtn);
    row.appendChild(upBtn);
    box.appendChild(row);

    const leave = document.createElement("button");
    leave.className = "btn";
    leave.textContent = "Leave";
    leave.onclick = () => endRoomAndGoMap();
    box.appendChild(document.createElement("div")).className = "row";
    box.appendChild(leave);

    wrap.appendChild(box);
    return wrap;
  }

  function renderEvent() {
    const wrap = document.createElement("div");
    const e = state.event;

    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `<h3>${e.title}</h3><p>${e.text}</p>`;
    const row = document.createElement("div");
    row.className = "row";
    e.options.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = opt.label;
      b.onclick = () => {
        opt.effect();
        endRoomAndGoMap();
      };
      row.appendChild(b);
    });
    card.appendChild(row);
    wrap.appendChild(card);
    return wrap;
  }

  function renderTreasure() {
    const wrap = document.createElement("div");
    const t = state.treasure;

    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `<h3>Treasure</h3><p>${t.text}</p>`;

    const btn = document.createElement("button");
    btn.className = "btn good";
    btn.textContent = "Claim";
    btn.onclick = () => {
      if (t.kind === "relic") gainRelic(t.id);
      else { state.player.gold += t.gold; log(`+${t.gold} gold.`, "good"); }
      endRoomAndGoMap();
    };
    card.appendChild(btn);
    wrap.appendChild(card);
    return wrap;
  }

  function renderGameOver() {
    const wrap = document.createElement("div");
    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `
      <h3>Run Over</h3>
      <p>You reached floor <strong>${state.floor}</strong> with ${state.player.relics.length} relic(s) and ${state.player.deck.length} card(s).</p>
      <div class="row">
        <button class="btn" id="btnRestart2">Start New Run</button>
        <button class="btn ghost" id="btnViewDeck2">View Deck</button>
      </div>
    `;
    wrap.appendChild(card);

    setTimeout(() => {
      const r = $("btnRestart2");
      if (r) r.onclick = () => newRun();
      const d = $("btnViewDeck2");
      if (d) d.onclick = () => openModal("Your Deck", renderDeckList());
    }, 0);

    return wrap;
  }

  // ---------- Modal / Picks ----------
  function openModal(title, contentNode) {
    $("modalTitle").textContent = title;
    const body = $("modalBody");
    body.innerHTML = "";
    body.appendChild(contentNode);
    $("modalWrap").classList.remove("hidden");
  }
  function closeModal() { $("modalWrap").classList.add("hidden"); }

  function renderDeckList() {
    const wrap = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "cardGrid";

    state.player.deck.forEach((inst) => {
      const c = makePlayable(inst);
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="top"><div class="name">${c.displayName}</div><div class="cost">${c.cost}</div></div>
        <div class="type">${c.type} • ${Cards[inst.baseId].rarity}</div>
        <div class="desc">${c.displayDesc}</div>
      `;
      grid.appendChild(el);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function renderCardPick(cardIds, onPick) {
    const wrap = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "cardGrid";

    cardIds.forEach((id) => {
      const c = Cards[id];
      const el = document.createElement("div");
      el.className = "card playable";
      el.innerHTML = `
        <div class="top"><div class="name">${c.name}</div><div class="cost">${c.cost}</div></div>
        <div class="type">${c.type} • ${c.rarity}</div>
        <div class="desc">${c.desc}</div>
      `;
      el.onclick = () => onPick(id);
      grid.appendChild(el);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function renderUpgradePick(onPickIndex) {
    const wrap = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "cardGrid";

    state.player.deck.forEach((inst, idx) => {
      const base = Cards[inst.baseId];
      const el = document.createElement("div");
      el.className = `card ${(!inst.upgraded && base.upgrade) ? "playable" : "unplayable"}`;
      el.innerHTML = `
        <div class="top"><div class="name">${cardName(inst)}</div><div class="cost">${base.cost}</div></div>
        <div class="type">${base.type} • ${base.rarity}</div>
        <div class="desc">${inst.upgraded ? "Already upgraded." : (base.upgrade?.desc || "No upgrade available.")}</div>
      `;
      if (!inst.upgraded && base.upgrade) el.onclick = () => onPickIndex(idx);
      grid.appendChild(el);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function renderRemovePick(onPickIndex) {
    const wrap = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "cardGrid";

    state.player.deck.forEach((inst, idx) => {
      const base = Cards[inst.baseId];
      const el = document.createElement("div");
      el.className = "card playable";
      el.innerHTML = `
        <div class="top"><div class="name">${cardName(inst)}</div><div class="cost">${base.cost}</div></div>
        <div class="type">${base.type} • ${base.rarity}</div>
        <div class="desc">${base.desc}</div>
      `;
      el.onclick = () => onPickIndex(idx);
      grid.appendChild(el);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  // ---------- Room end / Flow ----------
  function endRoomAndGoMap() {
    // after any room resolution (combat reward, shop leave, rest leave, event choice, treasure claim)
    advanceFloor();
    state.phase = "map";
    state.pendingRewards = null;
    state.shop = null;
    state.event = null;
    state.treasure = null;

    // small floor scaling: tiny heal every 5 floors
    if (state.floor % 5 === 0) {
      healPlayer(4);
      log("Milestone breather: +4 HP.", "good");
    }

    renderAll();
  }

  // ---------- Logging ----------
  function log(msg, cls = "info") {
    const logEl = $("log");
    const entry = document.createElement("div");
    entry.className = `entry ${cls}`;
    entry.textContent = msg;
    logEl.prepend(entry);
  }
  function logClear() { $("log").innerHTML = ""; }

  // ---------- Save/Load ----------
  function saveRun() {
    try {
      localStorage.setItem("spirelite_save", JSON.stringify(state));
      log("Saved run to localStorage.", "info");
    } catch {
      log("Save failed.", "bad");
    }
  }
  function loadRun() {
    const raw = localStorage.getItem("spirelite_save");
    if (!raw) { log("No save found.", "warn"); return; }
    try {
      const loaded = JSON.parse(raw);
      state = loaded;

      // Guard: rebuild functions are in code, state is plain data: OK.
      // Ensure missing properties don't crash older saves
      state.player.status ||= { weak: 0, vuln: 0 };
      state.player.relics ||= [];
      log("Loaded run.", "info");
      renderAll();
    } catch {
      log("Load failed.", "bad");
    }
  }

  // ---------- Buttons ----------
  function bindUI() {
    $("btnNewRun").onclick = () => newRun();
    $("btnViewDeck").onclick = () => openModal("Your Deck", renderDeckList());
    $("btnSave").onclick = () => saveRun();
    $("btnLoad").onclick = () => loadRun();

    $("btnModalClose").onclick = () => closeModal();
    $("modalWrap").addEventListener("click", (e) => {
      if (e.target === $("modalWrap")) closeModal();
    });
  }

  // ---------- Boot ----------
  bindUI();
  newRun();

})();

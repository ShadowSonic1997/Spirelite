export function svgDataUri(svg) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg.trim());
}

export function cardArtUri(cardId, type) {
  const palette = {
    Attack: ["#ff5c7a", "#ffcc66"],
    Skill: ["#5cc8ff", "#6b5cff"],
    Power: ["#39d98a", "#b1ff6a"],
  }[type] || ["#aeb6e6", "#6b5cff"];

  const seed = [...cardId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const a = (seed * 37) % 360;
  const b = (seed * 91) % 360;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="140">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette[0]}"/>
        <stop offset="1" stop-color="${palette[1]}"/>
      </linearGradient>
      <radialGradient id="r" cx="30%" cy="30%" r="70%">
        <stop offset="0" stop-color="white" stop-opacity="0.35"/>
        <stop offset="1" stop-color="black" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="#0b0f1a"/>
    <rect width="100%" height="100%" fill="url(#g)" opacity="0.55"/>
    <circle cx="90" cy="50" r="60" fill="url(#r)"/>
    <g opacity="0.18" filter="url(#blur)">
      <path d="M-10 120 C 60 40, 120 180, 210 70 S 380 150, 420 40"
            fill="none" stroke="white" stroke-width="24"/>
    </g>
    <g opacity="0.30">
      <circle cx="320" cy="40" r="18" fill="white" transform="rotate(${a} 320 40)"/>
      <rect x="280" y="76" width="90" height="30" rx="10" fill="white" transform="rotate(${b} 325 91)"/>
    </g>
    <g opacity="0.85">
      <text x="14" y="124" font-family="ui-sans-serif,system-ui" font-weight="900" font-size="26"
            fill="rgba(0,0,0,0.35)">SPIRELITE</text>
      <text x="14" y="124" font-family="ui-sans-serif,system-ui" font-weight="900" font-size="26"
            fill="rgba(255,255,255,0.70)">SPIRELITE</text>
    </g>
  </svg>`;
  return svgDataUri(svg);
}

export function enemyPortraitUri(enemyId) {
  const colors = {
    slime: ["#5cc8ff", "#6b5cff"],
    cultist: ["#ff5c7a", "#6b5cff"],
    fang: ["#ffcc66", "#ff5c7a"],
    golem: ["#aeb6e6", "#5cc8ff"],
    seer: ["#39d98a", "#6b5cff"],
  }[enemyId] || ["#aeb6e6", "#6b5cff"];

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors[0]}"/>
        <stop offset="1" stop-color="${colors[1]}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="24" fill="#0b0f1a"/>
    <rect width="100%" height="100%" rx="24" fill="url(#g)" opacity="0.55"/>
    <circle cx="70" cy="74" r="42" fill="rgba(0,0,0,0.22)"/>
    <circle cx="52" cy="66" r="8" fill="rgba(255,255,255,0.75)"/>
    <circle cx="88" cy="66" r="8" fill="rgba(255,255,255,0.75)"/>
    <path d="M48 92 Q70 110 92 92" stroke="rgba(255,255,255,0.65)" stroke-width="6"
          fill="none" stroke-linecap="round"/>
  </svg>`;
  return svgDataUri(svg);
}

export function intentIcon(intent) {
  if (!intent) return "…";
  const map = { attack: "⚔️", block: "🛡️", buff: "✨", debuff: "☠️", multi: "🔁" };
  return map[intent.type] || "❔";
}

export function rarityClass(r) {
  if (r === "Rare") return "rare";
  if (r === "Uncommon") return "uncommon";
  return "common";
}

export function typeFrameClass(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("attack")) return "attack";
  if (t.includes("skill")) return "skill";
  return "power";
}

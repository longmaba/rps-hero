// Enemy types configuration
const ENEMY_TYPES = [
  {
    type: "Basic",
    description: "A basic enemy that chooses moves randomly",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
    maxHp: 100,
  },
  {
    type: "Mimic",
    description: "Copies your previous round's moves",
    getActions: (gameState) =>
      gameState.playerLastRoundActions
        ? [...gameState.playerLastRoundActions] // Copy previous round's actions
        : Array(5)
            .fill()
            .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]), // Random if no previous actions
    maxHp: 100,
  },
  {
    type: "Boss",
    description: "The final challenge with a fixed pattern of moves",
    getActions: () => ["Rock", "Rock", "Paper", "Paper", "Scissors"],
    maxHp: 150,
  },
];

// Item pool configuration
const ITEMS = [
  {
    name: "Obsidian Rock",
    type: "actionModifier",
    appliesTo: "Rock",
    effect: (dmg) => dmg + 10,
    description: "Increases Rock damage by 10",
  },
  {
    name: "Sharp Scissors",
    type: "actionModifier",
    appliesTo: "Scissors",
    effect: (dmg) => dmg + 10,
    description: "Increases Scissors damage by 10",
  },
  {
    name: "Thick Paper",
    type: "actionModifier",
    appliesTo: "Paper",
    effect: (dmg) => dmg + 10,
    description: "Increases Paper damage by 10",
  },
  {
    name: "Double Dragon",
    type: "conditionalModifier",
    appliesTo: "Rock",
    effect: (dmg) => dmg * 2,
    description: "Rock deals double damage when winning",
    condition: "win",
    triggerMessage: (dmg) => `Rock strikes twice! Dealt ${dmg} damage!`,
  },
  {
    name: "Coup De Grace",
    type: "conditionalModifier",
    appliesTo: "Scissors",
    effect: (dmg) => (Math.random() < 0.4 ? dmg * 4 : dmg),
    description: "Scissors have 20% chance to do 400% damage when winning",
    condition: "win",
    triggerMessage: (dmg) => `Lethal precision! Critical hit for ${dmg} damage!`,
  },
  {
    name: "Absolute Defense",
    type: "conditionalModifier",
    appliesTo: "Paper",
    effect: (dmg) => (Math.random() < 0.5 ? 0 : dmg),
    description: "Paper has 50% chance to nullify damage when losing",
    condition: "lose",
    triggerMessage: (dmg) => (dmg === 0 ? "Perfect defense! Nullified all damage!" : `Mitigated attack! Took ${dmg} damage.`),
  },
  {
    name: "Rock Solid",
    type: "conditionalModifier",
    appliesTo: "Rock",
    effect: (dmg) => dmg * 0.5,
    description: "Reduces damage by 50% when losing with Rock",
    condition: "lose",
    triggerMessage: (dmg) => `Rock absorption! Reduced damage to ${dmg}.`,
  },
];

// Debuff configuration
const DEBUFFS = [
  {
    id: "forgotten_rock",
    name: "Forgotten Rock",
    description: "You can't use Rock for this battle",
    icon: "❌✊",
    effect: {
      type: "ban_action",
      action: "Rock",
    },
    applyEffect: (gameState) => {
      // Nothing to do here - effect is applied in the UI/controls
    },
    roundEffect: () => {
      // No per-round effect
    },
  },
  {
    id: "broken_scissor",
    name: "Broken Scissors",
    description: "You can't use Scissors for this battle",
    icon: "❌✌️",
    effect: {
      type: "ban_action",
      action: "Scissors",
    },
    applyEffect: (gameState) => {
      // Nothing to do here - effect is applied in the UI/controls
    },
    roundEffect: () => {
      // No per-round effect
    },
  },
  {
    id: "abandoned_paper",
    name: "Abandoned Paper",
    description: "You can't use Paper for this battle",
    icon: "❌✋",
    effect: {
      type: "ban_action",
      action: "Paper",
    },
    applyEffect: (gameState) => {
      // Nothing to do here - effect is applied in the UI/controls
    },
    roundEffect: () => {
      // No per-round effect
    },
  },
  {
    id: "open_wound",
    name: "Open Wound",
    description: "You lose 5 HP at the start of each round",
    icon: "🩸",
    effect: {
      type: "hp_loss_per_round",
      amount: 5,
    },
    applyEffect: (gameState) => {
      // Initial effect application (if any)
    },
    roundEffect: (gameState) => {
      // Apply 5 HP loss at the start of each round
      gameState.player.hp = Math.max(0, gameState.player.hp - 5);

      // Log the effect
      if (document.getElementById("resolution-log")) {
        const logElem = document.createElement("p");
        logElem.className = "debuff-effect";
        logElem.textContent = "🩸 Open Wound causes you to lose 5 HP!";
        document.getElementById("resolution-log").appendChild(logElem);
        document.getElementById("resolution-log").scrollTop = document.getElementById("resolution-log").scrollHeight;
      }

      // Update HP display
      if (typeof updateHP === "function") {
        updateHP("player", gameState.player.hp);
      }
    },
  },
  {
    id: "raging_creature",
    name: "Raging Creature",
    description: "Enemy has 2.5x more health",
    icon: "😡",
    effect: {
      type: "enemy_hp_multiplier",
      multiplier: 2.5,
    },
    applyEffect: (gameState) => {
      // Multiply enemy HP by 2.5
      gameState.enemy.maxHp = Math.floor(gameState.enemy.maxHp * 2.5);
      gameState.enemy.hp = gameState.enemy.maxHp;
    },
    roundEffect: () => {
      // No per-round effect
    },
  },
  {
    id: "hand_tied",
    name: "Hand Tied",
    description: "You can only use Paper for this battle",
    icon: "🔒✋",
    effect: {
      type: "only_allow_action",
      action: "Paper",
    },
    applyEffect: (gameState) => {
      // Nothing to do here - effect is applied in the UI/controls
    },
    roundEffect: () => {
      // No per-round effect
    },
  },
];

// Game configuration
const GAME_CONFIG = {
  playerStartingHp: 250,
  baseDamage: 20,
  maxBattles: 20, // Temporarily increased to 20 levels of basic enemies
  battleDelay: 1000, // Delay between action comparisons in ms,
  debuffChance: 0.35, // 35% chance to get a debuff per battle
};

// Export the configurations
if (typeof module !== "undefined" && module.exports) {
  // Node.js environment (for testing)
  module.exports = { ENEMY_TYPES, ITEMS, GAME_CONFIG, DEBUFFS };
} else {
  // Browser environment
  window.ENEMY_TYPES = ENEMY_TYPES;
  window.ITEMS = ITEMS;
  window.GAME_CONFIG = GAME_CONFIG;
  window.DEBUFFS = DEBUFFS;
}

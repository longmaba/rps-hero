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
    effect: (dmg) => dmg + 5,
    description: "Increases Scissors damage by 5",
  },
  {
    name: "Thick Paper",
    type: "actionModifier",
    appliesTo: "Paper",
    effect: (dmg) => dmg + 5,
    description: "Increases Paper damage by 5",
  },
];

// Game configuration
const GAME_CONFIG = {
  playerStartingHp: 100,
  baseDamage: 20,
  maxBattles: 20, // Temporarily increased to 20 levels of basic enemies
  startingItem: 0, // Index of the item the player starts with
  battleDelay: 1000, // Delay between action comparisons in ms
};

// Export the configurations
if (typeof module !== "undefined" && module.exports) {
  // Node.js environment (for testing)
  module.exports = { ENEMY_TYPES, ITEMS, GAME_CONFIG };
} else {
  // Browser environment
  window.ENEMY_TYPES = ENEMY_TYPES;
  window.ITEMS = ITEMS;
  window.GAME_CONFIG = GAME_CONFIG;
}

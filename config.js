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
    effect: (dmg) => (Math.random() < 0.2 ? dmg * 4 : dmg),
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

// Game configuration
const GAME_CONFIG = {
  playerStartingHp: 250,
  baseDamage: 20,
  maxBattles: 20, // Temporarily increased to 20 levels of basic enemies
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

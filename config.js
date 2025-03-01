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
  // Elite enemies
  {
    type: "Elite Mimic",
    description: "An elite enemy that copies your moves with enhanced power",
    getActions: (gameState) =>
      gameState.playerLastRoundActions
        ? [...gameState.playerLastRoundActions]
        : Array(5)
            .fill()
            .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
    maxHp: 120,
    isElite: true,
    eliteAbility: "Copies moves with 20% more power",
  },
  {
    type: "Double Trouble",
    description: "An elite enemy that resolves each move twice",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
    maxHp: 120,
    isElite: true,
    eliteAbility: "Resolves each move twice for double damage",
  },
  {
    type: "Strategist",
    description: "An elite enemy that adapts to your weaknesses",
    getActions: (gameState) => {
      // If player has used more Rock, counter with Paper
      // If player has used more Paper, counter with Scissors
      // If player has used more Scissors, counter with Rock
      if (!gameState.playerAllActions || gameState.playerAllActions.length === 0) {
        return Array(5)
          .fill()
          .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
      }

      const counts = {
        Rock: 0,
        Paper: 0,
        Scissors: 0,
      };

      gameState.playerAllActions.forEach((action) => {
        counts[action]++;
      });

      let counter;
      if (counts.Rock >= counts.Paper && counts.Rock >= counts.Scissors) {
        counter = "Paper";
      } else if (counts.Paper >= counts.Rock && counts.Paper >= counts.Scissors) {
        counter = "Scissors";
      } else {
        counter = "Rock";
      }

      return Array(5).fill(counter);
    },
    maxHp: 130,
    isElite: true,
    eliteAbility: "Analyzes your strategy and counters it",
  },
];

// Basic items configuration (obtainable after battles)
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
    name: "Iron Shield",
    type: "conditionalModifier",
    appliesTo: "All",
    effect: (dmg) => Math.floor(dmg * 0.8),
    description: "Reduces all incoming damage by 20% when losing",
    condition: "lose",
    triggerMessage: (dmg) => `Shield absorbed ${Math.ceil(dmg * 0.3)} damage!`,
  },
  {
    name: "Healing Herb",
    type: "postBattleEffect",
    effect: (gameState) => {
      const healAmount = Math.floor(gameState.player.maxHp * 0.05);
      gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
      return healAmount;
    },
    description: "Heals 5% of max HP after each battle",
    triggerMessage: (amount) => `Healing Herb restored ${amount} HP!`,
  },
  {
    name: "Thornmail",
    type: "conditionalModifier",
    appliesTo: "All",
    effect: (dmg) => {
      const reflectDamage = Math.floor(dmg * 0.2);
      gameState.enemy.hp -= reflectDamage;
      return dmg;
    },
    description: "Reflects 20% of received damage back to enemy",
    condition: "lose",
    triggerMessage: (dmg) => `Thorns deal ${Math.floor(dmg * 0.2)} damage!`,
  },
  {
    name: "Big Heart",
    type: "utility",
    description: "Increases max HP by 100",
    effect: (gameState) => {
      gameState.player.maxHp += 100;
      gameState.player.hp = gameState.player.maxHp;
    },
    triggerMessage: () => "Big Heart increases max HP by 100!",
    description: "Increases max HP by 100",
    isOneTimeEffect: true,
  },
];

// Relic configuration (rare, powerful items available at the start)
const RELICS = [
  {
    name: "Double Dragon",
    type: "conditionalModifier",
    appliesTo: "Rock",
    effect: (dmg) => {
      // Ensure we're working with numbers
      const baseDamage = Number(dmg) || 0;
      return {
        finalDamage: baseDamage * 2,
        isCrit: false, // Not a crit effect
      };
    },
    description: "Rock deals double damage when winning",
    condition: "win",
    triggerMessage: (dmg) => `💥 Rock strikes twice! Dealt ${Number(dmg) || 0} damage!`,
    hasCritEffect: false, // Flag to indicate this doesn't have a crit effect
  },
  {
    name: "Coup De Grace",
    type: "conditionalModifier",
    appliesTo: "Scissors",
    effect: (dmg) => {
      const isCrit = Math.random() < 0.4;
      const finalDamage = isCrit ? dmg * 4 : dmg;
      return { finalDamage, isCrit };
    },
    description: "Scissors have 40% chance to do 400% damage when winning",
    condition: "win",
    triggerMessage: (dmg) => {
      return `💥 Lethal precision! Critical hit for ${dmg} damage!`;
    },
    hasCritEffect: false, // Flag this as having a crit effect
  },
  {
    name: "Vampire Blade",
    type: "conditionalModifier",
    appliesTo: "Scissors",
    effect: (dmg) => dmg, // Don't modify damage - just return it as is
    description: "Scissors heal you for 25% of damage dealt",
    condition: "win",
    triggerMessage: (dmg) => {
      const lifestealAmount = Math.floor(dmg * 0.25);
      return `🩸 Vampire Blade absorbs life! Healed for ${lifestealAmount} HP!`;
    },
    lifestealPercent: 0.25, // Store the configurable lifesteal percentage
    isLifesteal: true, // Flag to identify this as a lifesteal item
  },
  {
    name: "Absolute Defense",
    type: "conditionalModifier",
    appliesTo: "Paper",
    effect: (dmg) => (Math.random() < 0.5 ? 0 : dmg),
    description: "Paper has 50% chance to nullify damage when losing",
    condition: "lose",
    triggerMessage: (dmg) => (dmg === 0 ? "🛡️ Perfect defense! Nullified all damage!" : `Mitigated attack! Took ${dmg} damage.`),
  },
  {
    name: "Rock Solid",
    type: "conditionalModifier",
    appliesTo: "Rock",
    effect: (dmg) => dmg * 0.5,
    description: "Reduces damage by 50% when losing with Rock",
    condition: "lose",
    triggerMessage: (dmg) => `🛡️ Rock absorption! Reduced damage to ${dmg}.`,
  },
  {
    name: "Phoenix Feather",
    type: "defensive",
    appliesTo: "All",
    effect: (gameState) => {
      if (gameState.player.hp <= 0) {
        gameState.player.hp = Math.floor(gameState.player.maxHp * 0.5);
        return true; // Indicates revival happened
      }
      return false;
    },
    description: "Revive with 50% HP once per battle when defeated",
    triggerMessage: () => "🔥 Phoenix Feather brings you back from defeat!",
    consumed: false, // Track if it's been used already
  },
  {
    name: "Lucky Charm",
    type: "utility",
    appliesTo: "All",
    effect: () => {
      GAME_CONFIG.debuffChance *= 0.5;
      return true;
    },
    description: "Reduces debuff chance by 50%",
    isOneTimeEffect: true,
  },
  {
    name: "Training Manual",
    type: "scaling",
    effect: (baseValue) => baseValue + 10,
    description: "Permanently increases base damage by 10 after each battle",
    appliesTo: "baseDamage",
    triggerMessage: () => "🏋️‍♂️ Training complete! Base damage increased by 10!",
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

// Node type configuration
const NODE_TYPES = {
  BATTLE: {
    id: "battle",
    name: "Battle",
    description: "Face an enemy in RPS combat",
    icon: "⚔️",
    frequency: 0.6, // 60% chance to appear
  },
  ELITE: {
    id: "elite",
    name: "Elite Battle",
    description: "Face a powerful enemy with unique abilities",
    icon: "👹",
    frequency: 0.15, // 15% chance to appear
  },
  SHOP: {
    id: "shop",
    name: "Shop",
    description: "Buy items with your coins",
    icon: "🛒",
    frequency: 0.1, // 10% chance to appear
  },
  REST: {
    id: "rest",
    name: "Rest Site",
    description: "Heal or upgrade an item",
    icon: "🏕️",
    frequency: 0.1, // 10% chance to appear
  },
  EVENT: {
    id: "event",
    name: "Mystery Event",
    description: "Encounter a random event with various outcomes",
    icon: "❓",
    frequency: 0.05, // 5% chance to appear
  },
};

// Shop item configuration
const SHOP_ITEMS = [
  // Common items
  {
    name: "Health Potion",
    description: "Instantly heals 50 HP",
    price: 25,
    rarity: "common",
    effect: (gameState) => {
      const healAmount = 50;
      gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
      return healAmount;
    },
    triggerMessage: (amount) => `Health Potion restored ${amount} HP!`,
    oneTimeUse: true,
  },
  {
    name: "Rock Polish",
    description: "Rock deals 15 more damage for the next battle",
    price: 30,
    rarity: "common",
    appliesTo: "Rock",
    type: "actionModifier",
    effect: (dmg) => dmg + 15,
    triggerMessage: () => "Rock Polish activated! +15 damage",
    temporaryEffect: true,
    duration: 1, // Lasts for one battle
  },
  {
    name: "Scissors Sharpener",
    description: "Scissors deals 15 more damage for the next battle",
    price: 30,
    rarity: "common",
    appliesTo: "Scissors",
    type: "actionModifier",
    effect: (dmg) => dmg + 15,
    triggerMessage: () => "Scissors Sharpener activated! +15 damage",
    temporaryEffect: true,
    duration: 1,
  },
  {
    name: "Paper Reinforcement",
    description: "Paper deals 15 more damage for the next battle",
    price: 30,
    rarity: "common",
    appliesTo: "Paper",
    type: "actionModifier",
    effect: (dmg) => dmg + 15,
    triggerMessage: () => "Paper Reinforcement activated! +15 damage",
    temporaryEffect: true,
    duration: 1,
  },

  // Uncommon items
  {
    name: "Debuff Remover",
    description: "Removes your current debuff",
    price: 40,
    rarity: "uncommon",
    effect: (gameState) => {
      const hadDebuff = gameState.activeDebuff !== null;
      gameState.activeDebuff = null;
      return hadDebuff;
    },
    triggerMessage: (removed) => (removed ? "Debuff successfully removed!" : "You had no debuff to remove!"),
    oneTimeUse: true,
  },
  {
    name: "Emergency Shield",
    description: "Prevents the next 30 damage you would take",
    price: 45,
    rarity: "uncommon",
    type: "defensive",
    effect: (damage) => Math.max(0, damage - 30),
    triggerMessage: (blocked) => `Emergency Shield absorbed ${blocked} damage!`,
    oneTimeUse: true,
  },

  // Rare items
  {
    name: "Molten Gauntlet",
    description: "Rock wins deal +20 damage and apply 5 burn damage over 2 rounds",
    price: 65,
    rarity: "rare",
    appliesTo: "Rock",
    type: "actionModifier",
    effect: (dmg) => dmg + 20, // Direct damage increase
    triggerMessage: () => "Molten Gauntlet activated! +20 damage and 5 burn damage applied!",
    applyBurn: true,
    burnDamage: 5,
    burnDuration: 2,
  },
  {
    name: "Windmill Paper",
    description: "Paper wins grant a 25% chance to dodge the next attack",
    price: 70,
    rarity: "rare",
    appliesTo: "Paper",
    type: "actionModifier",
    effect: (dmg) => {
      if (Math.random() < 0.25) {
        gameState.player.dodgeNextAttack = true;
      }
      return dmg;
    },
    triggerMessage: () => "Windmill Paper gives you a chance to dodge the next attack!",
  },
];

// Define random events
const EVENTS = [
  {
    name: "Cursed Forge",
    type: "cursed_forge",
    description: "A mysterious forge emanates an eerie glow. Do you want to sacrifice 15 HP to empower your Rock attacks?",
    choices: [
      {
        text: "Sacrifice HP (Lose 15 HP, Rock deals +15 damage for the rest of the run)",
        effect: (gameState) => {
          // Reduce HP
          gameState.player.hp = Math.max(1, gameState.player.hp - 15);

          // Add rock damage boost item
          gameState.player.inventory.push({
            name: "Molten Gauntlet",
            description: "Your Rock attacks deal 15 additional damage.",
            type: "actionModifier",
            appliesTo: "Rock",
            effect: (damage) => damage + 15,
          });

          return "You sacrifice some of your vitality to the forge and feel your fist burn with new power!";
        },
      },
      {
        text: "Decline (Nothing happens)",
        effect: (gameState) => {
          return "You decide not to risk it and continue on your journey.";
        },
      },
    ],
  },
  {
    name: "Mysterious Trader",
    type: "mysterious_trader",
    description: "A hooded figure offers you a choice: sacrifice some of your maximum HP for an immediate advantage.",
    choices: [
      {
        text: "Trade 10 Max HP for 50 coins",
        effect: (gameState) => {
          // Reduce max HP
          gameState.player.maxHp -= 10;
          gameState.player.hp = Math.min(gameState.player.hp, gameState.player.maxHp);

          // Add coins
          gameState.player.coins += 50;

          return "The trader hands you a bag of coins. You feel slightly weaker but richer!";
        },
      },
      {
        text: "Trade 5 Max HP for a random item",
        effect: (gameState) => {
          // Reduce max HP
          gameState.player.maxHp -= 5;
          gameState.player.hp = Math.min(gameState.player.hp, gameState.player.maxHp);

          // Give random item
          const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          gameState.player.inventory.push({ ...randomItem });

          return `The trader gives you ${randomItem.name}. You feel slightly weaker but better equipped!`;
        },
      },
      {
        text: "Decline and leave",
        effect: (gameState) => {
          return "You decide not to risk your vitality and continue your journey unaltered.";
        },
      },
    ],
  },
  {
    name: "Healing Spring",
    type: "healing_spring",
    description: "You discover a spring with glowing water. It seems to have healing properties.",
    choices: [
      {
        text: "Drink deeply (+30 HP)",
        effect: (gameState) => {
          const healAmount = Math.min(30, gameState.player.maxHp - gameState.player.hp);
          gameState.player.hp += healAmount;

          return `You drink the glowing water and feel revitalized! (Healed ${healAmount} HP)`;
        },
      },
      {
        text: "Bottle some water (Gain Healing Potion)",
        effect: (gameState) => {
          gameState.player.inventory.push({
            name: "Healing Potion",
            description: "Restore 20 HP when you lose a match.",
            type: "defensive",
            consumed: false,
            effect: (gameState) => {
              const healAmount = Math.min(20, gameState.player.maxHp - gameState.player.hp);
              gameState.player.hp += healAmount;
              return true; // Successfully used
            },
            triggerMessage: () => "Healing Potion activates, restoring 20 HP!",
          });

          return "You carefully bottle some of the glowing water for later use.";
        },
      },
      {
        text: "Leave it be",
        effect: (gameState) => {
          return "You decide to leave the spring untouched and continue on your way.";
        },
      },
    ],
  },
];

// Game configuration
const GAME_CONFIG = {
  playerStartingHp: 400,
  baseDamage: 20,
  maxBattles: 15, // Adjusted for a shorter run with the new node system
  battleDelay: 1000, // Delay between action comparisons in ms,
  debuffChance: 0.35, // 35% chance to get a debuff per battle
  // Currency configuration
  currency: {
    startingAmount: 0, // Starting with some coins for shopping
    minRewardPerBattle: 20,
    maxRewardPerBattle: 30,
    eliteBattleMultiplier: 1.5, // Elite battles give 50% more coins
  },
  // Enemy scaling configuration
  enemyScaling: {
    baseHp: 100, // Base enemy HP for the first battle
    hpIncreasePerBattle: 5, // HP increase per battle
    damageIncreasePerBattle: 2, // Damage increase per battle
  },
  // Map configuration
  map: {
    totalNodes: 15, // Total nodes in a run
    pathsPerNode: 2, // Number of paths from each node
    minElites: 2, // Minimum number of elite battles per run
    maxElites: 4, // Maximum number of elite battles per run
    shopFrequency: 0.15, // Chance for a shop node
    restFrequency: 0.15, // Chance for a rest node
    eventFrequency: 0.1, // Chance for an event node
    bossNodeIndex: 15, // The node index of the final boss
  },
  // Rest site configuration
  rest: {
    healAmount: 100, // Amount of HP restored at rest sites
    upgradeEffect: 1.5, // Multiplier for item upgrades (50% better)
  },
};

// Export the configurations
if (typeof module !== "undefined" && module.exports) {
  // Node.js environment (for testing)
  module.exports = { ENEMY_TYPES, ITEMS, RELICS, GAME_CONFIG, DEBUFFS, NODE_TYPES, SHOP_ITEMS, EVENTS };
} else {
  // Browser environment
  window.ENEMY_TYPES = ENEMY_TYPES;
  window.ITEMS = ITEMS;
  window.RELICS = RELICS;
  window.GAME_CONFIG = GAME_CONFIG;
  window.DEBUFFS = DEBUFFS;
  window.NODE_TYPES = NODE_TYPES;
  window.SHOP_ITEMS = SHOP_ITEMS;
  window.EVENTS = EVENTS;
}

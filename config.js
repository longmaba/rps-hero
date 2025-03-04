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
  // New Enemy Types
  {
    type: "Predictor",
    description: "Analyzes your patterns and predicts your next moves",
    getActions: (gameState) => {
      if (!gameState.playerAllActions || gameState.playerAllActions.length < 5) {
        // Not enough data yet, use random moves
        return Array(5)
          .fill()
          .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
      }

      // Count frequency of each action in player history
      const counts = {
        Rock: 0,
        Paper: 0,
        Scissors: 0,
      };

      gameState.playerAllActions.forEach((action) => {
        counts[action]++;
      });

      // Determine the player's most frequent action
      let mostFrequent = "Rock";
      if (counts.Paper > counts[mostFrequent]) mostFrequent = "Paper";
      if (counts.Scissors > counts[mostFrequent]) mostFrequent = "Scissors";

      // Counter the most frequent action
      const counter = {
        Rock: "Paper",
        Paper: "Scissors",
        Scissors: "Rock",
      };

      // 80% chance to use the counter, 20% chance for random
      return Array(5)
        .fill()
        .map(() => (Math.random() < 0.8 ? counter[mostFrequent] : ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]));
    },
    maxHp: 120,
  },
  {
    type: "Berserker",
    description: "Becomes more aggressive as health decreases",
    getActions: (gameState) => {
      // Calculate how "enraged" the berserker is based on missing health
      const healthPercentage = gameState.enemy.hp / gameState.enemy.maxHp;
      const enrageLevel = 1 - healthPercentage; // 0 when full health, 1 when no health

      // Define actions based on enrage level
      // More likely to use the same attack (becomes more predictable but more dangerous)
      const actions = [];

      // Choose a primary attack that will be used more frequently as health decreases
      const primaryAttack = ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)];

      for (let i = 0; i < 5; i++) {
        // The lower the health, the more likely to use primary attack
        if (Math.random() < enrageLevel * 0.8) {
          actions.push(primaryAttack);
        } else {
          actions.push(["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
        }
      }

      return actions;
    },
    maxHp: 130,
    // Add custom property for damage multiplier based on missing health
    getDamageMultiplier: (gameState) => {
      const healthPercentage = gameState.enemy.hp / gameState.enemy.maxHp;
      // Damage multiplier increases as health decreases (1.0 to 2.0)
      return 1 + (1 - healthPercentage);
    },
  },
  {
    type: "Shielded",
    description: "Can block or reduce damage from certain attacks",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
    maxHp: 110,
    hasShield: true,
    // Chance to block damage based on the attack type
    shieldBlock: (playerAction) => {
      // Shield is more effective against certain attacks
      const blockChances = {
        Rock: 0.5, // 50% chance to block Rock
        Paper: 0.2, // 20% chance to block Paper
        Scissors: 0.3, // 30% chance to block Scissors
      };

      return Math.random() < blockChances[playerAction];
    },
    // How much damage is reduced when not fully blocked
    damageReduction: 0.3, // 30% damage reduction when not blocked
  },
  {
    type: "Debilitator",
    description: "Applies weakening effects to the player",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
    maxHp: 100,
    // Apply debuffs when player loses
    applyDebuff: (gameState, roundResult) => {
      if (roundResult === "lose" && Math.random() < 0.3) {
        // 30% chance to apply debuff on player loss
        const possibleDebuffs = [
          {
            name: "Weakened",
            effect: "Player damage reduced by 25% for 2 rounds",
            duration: 2,
            type: "damage_reduction",
            value: 0.25,
          },
          {
            name: "Confused",
            effect: "25% chance your move will change to a random one",
            duration: 2,
            type: "move_confusion",
            value: 0.25,
          },
        ];

        // Select a random debuff
        const debuff = possibleDebuffs[Math.floor(Math.random() * possibleDebuffs.length)];

        // Apply the debuff to the player
        if (!gameState.playerDebuffs) gameState.playerDebuffs = [];
        gameState.playerDebuffs.push(debuff);

        return debuff;
      }
      return null;
    },
  },
  {
    type: "Adaptive Learner",
    description: "Learns from battle and adapts its strategy",
    getActions: (gameState) => {
      if (!gameState.adaptiveMemory) {
        // Initialize adaptive memory for this battle
        gameState.adaptiveMemory = {
          playerMoves: [],
          effectiveness: {
            Rock: 0,
            Paper: 0,
            Scissors: 0,
          },
          roundsAnalyzed: 0,
        };
      }

      if (gameState.playerLastRoundActions && gameState.roundResults) {
        // Update effectiveness based on last round
        gameState.playerLastRoundActions.forEach((move, index) => {
          const result = gameState.roundResults[index];

          // Track player's moves
          gameState.adaptiveMemory.playerMoves.push(move);

          // Adjust effectiveness based on results
          if (result === "win") {
            // Player won, decrease this move's effectiveness
            gameState.adaptiveMemory.effectiveness[move] -= 1;
          } else if (result === "lose") {
            // Player lost, increase this move's effectiveness
            gameState.adaptiveMemory.effectiveness[move] += 1;
          }
        });

        gameState.adaptiveMemory.roundsAnalyzed++;
      }

      // If we have enough data, start adapting
      if (gameState.adaptiveMemory.roundsAnalyzed >= 1) {
        // Find which player move has been most effective
        let bestMove = "Rock";
        if (gameState.adaptiveMemory.effectiveness.Paper > gameState.adaptiveMemory.effectiveness[bestMove]) bestMove = "Paper";
        if (gameState.adaptiveMemory.effectiveness.Scissors > gameState.adaptiveMemory.effectiveness[bestMove]) bestMove = "Scissors";

        // Counter the player's best move
        const counter = {
          Rock: "Paper",
          Paper: "Scissors",
          Scissors: "Rock",
        };

        // Adaptive strategy: Mix of countering and prediction
        return Array(5)
          .fill()
          .map(() => {
            const strategy = Math.random();
            if (strategy < 0.6) {
              // Counter the player's most effective move
              return counter[bestMove];
            } else if (strategy < 0.8 && gameState.playerLastRoundActions) {
              // Sometimes predict next move based on last move
              const lastMove = gameState.playerLastRoundActions[0];
              // Simple "next" prediction - players often rotate
              const prediction = {
                Rock: "Paper",
                Paper: "Scissors",
                Scissors: "Rock",
              };
              return counter[prediction[lastMove]];
            } else {
              // Random move
              return ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)];
            }
          });
      }

      // Default to random moves until we have enough data
      return Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
    },
    maxHp: 115,
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
    maxHp: 150,
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
    maxHp: 300,
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
    maxHp: 150,
    isElite: true,
    eliteAbility: "Analyzes your strategy and counters it",
  },
  // Elite versions of new enemies
  {
    type: "Elite Predictor",
    description: "An elite enemy with enhanced prediction abilities",
    getActions: (gameState) => {
      if (!gameState.playerAllActions || gameState.playerAllActions.length < 3) {
        // Not enough data yet, use random moves
        return Array(5)
          .fill()
          .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
      }

      // Count frequency of each action in player history
      const counts = {
        Rock: 0,
        Paper: 0,
        Scissors: 0,
      };

      gameState.playerAllActions.forEach((action) => {
        counts[action]++;
      });

      // Determine the player's most frequent action
      let mostFrequent = "Rock";
      if (counts.Paper > counts[mostFrequent]) mostFrequent = "Paper";
      if (counts.Scissors > counts[mostFrequent]) mostFrequent = "Scissors";

      // Counter the most frequent action
      const counter = {
        Rock: "Paper",
        Paper: "Scissors",
        Scissors: "Rock",
      };

      // 90% chance to use the counter (higher than non-elite version)
      return Array(5)
        .fill()
        .map(() => (Math.random() < 0.9 ? counter[mostFrequent] : ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]));
    },
    maxHp: 160,
    isElite: true,
    eliteAbility: "Almost perfectly predicts and counters your most common moves",
  },
  {
    type: "Elite Berserker",
    description: "An elite enemy that becomes extremely dangerous at low health",
    getActions: (gameState) => {
      // Calculate how "enraged" the berserker is based on missing health
      const healthPercentage = gameState.enemy.hp / gameState.enemy.maxHp;
      const enrageLevel = 1 - healthPercentage; // 0 when full health, 1 when no health

      // More predictable but more dangerous as health decreases
      const actions = [];
      const primaryAttack = ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)];

      for (let i = 0; i < 5; i++) {
        // Higher chance to use same attack than non-elite version
        if (Math.random() < enrageLevel * 0.9) {
          actions.push(primaryAttack);
        } else {
          actions.push(["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]);
        }
      }

      return actions;
    },
    maxHp: 170,
    isElite: true,
    eliteAbility: "Gains up to 3x damage as health decreases",
    // Enhanced damage multiplier for elite version
    getDamageMultiplier: (gameState) => {
      const healthPercentage = gameState.enemy.hp / gameState.enemy.maxHp;
      // Damage multiplier increases more dramatically (1.0 to 3.0)
      return 1 + (1 - healthPercentage) * 2;
    },
  },
  {
    type: "Roaster",
    description: "A savage opponent that deals emotional damage with brutal insults",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]), // These are just for show
    maxHp: 200,
    baseDamage: 10,
    roastInterval: null, // Will store our interval ID
    onBattleStart: function (gameState) {
      // Start roasting every 5 seconds
      this.roastInterval = setInterval(() => {
        const roast = generateRoast(gameState);
        const log = document.getElementById("resolution-log");
        const roastElem = document.createElement("p");
        roastElem.className = "enemy-roast";
        roastElem.innerHTML = `🔥 Roaster: "${roast}"`;
        log.appendChild(roastElem);
        log.scrollTop = log.scrollHeight;
      }, 7000);
    },
    onBattleEnd: function () {
      clearInterval(this.roastInterval);
    },
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
    effect: (dmg) => Math.floor(dmg * 0.9),
    description: "Reduces all incoming damage by 10% when losing",
    condition: "lose",
    triggerMessage: (dmg) => `Shield absorbed ${Math.ceil(dmg * 0.1)} damage!`,
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
    effect: (dmg, gameState) => {
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
    hasCritEffect: true, // Flag this as having a crit effect
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
    effect: (dmg, gameState) => {
      const nullify = Math.random() < 0.5;
      return nullify ? 0 : dmg; // Return 0 or original damage
    },
    description: "Paper has 50% chance to nullify damage when losing",
    condition: "lose",
    triggerMessage: (finalDamage) =>
      finalDamage === 0 ? "🛡️ Perfect defense! Nullified all damage!" : `Mitigated attack! Took ${finalDamage} damage.`,
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
    name: "Training Script",
    type: "scaling",
    effect: (currentBase) => currentBase + 10,
    description: "Permanently increases YOUR base damage by 10 after each battle",
    appliesTo: "playerBaseDamage",
    triggerMessage: (amount) => `🏋️‍♂️ Training complete! Your base damage increased by ${amount}!`,
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
  {
    id: "emotional_damage",
    name: "Emotional Damage",
    description: "You're questioning your life choices after those roasts",
    icon: "💔",
    effect: {
      type: "damage_reduction",
      value: 0.3, // 30% damage reduction
    },
    applyEffect: (gameState) => {
      const log = document.getElementById("resolution-log");
      const debuffMsg = document.createElement("p");
      debuffMsg.className = "debuff-effect";
      debuffMsg.textContent = "💔 The roasts have left you emotionally compromised! Damage reduced!";
      log.appendChild(debuffMsg);
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
  },
  ELITE: {
    id: "elite",
    name: "Elite Battle",
    description: "Face a powerful enemy with unique abilities",
    icon: "👹",
  },
  SHOP: {
    id: "shop",
    name: "Shop",
    description: "Buy items with your coins",
    icon: "🛒",
  },
  REST: {
    id: "rest",
    name: "Rest Site",
    description: "Heal or upgrade an item",
    icon: "🏕️",
  },
  EVENT: {
    id: "event",
    name: "Mystery Event",
    description: "Encounter a random event with various outcomes",
    icon: "❓",
  },
  TREASURE: {
    id: "treasure",
    name: "Treasure Chest",
    description: "Find valuable items to aid your journey",
    icon: "📦",
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
    description: "A mysterious forge emanates an eerie glow. Do you want to sacrifice 20% of your HP to empower your Rock attacks?",
    choices: [
      {
        text: "Sacrifice HP (Lose 20% of current HP, Rock deals +15 damage for the rest of the run)",
        effect: (gameState) => {
          // Reduce HP
          gameState.player.hp = Math.max(1, gameState.player.hp - gameState.player.maxHp * 0.2);

          // Add rock damage boost item
          gameState.player.inventory.push({
            name: "Iron Fist",
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
        text: "Trade 50 Max HP for 100 coins",
        effect: (gameState) => {
          // Reduce max HP
          gameState.player.maxHp -= 50;
          gameState.player.hp = Math.min(gameState.player.hp, gameState.player.maxHp);

          // Add coins
          gameState.player.coins += 100;

          return "The trader hands you a bag of coins. You feel slightly weaker but richer!";
        },
      },
      {
        text: "Trade 30 Max HP for a random item",
        effect: (gameState) => {
          // Reduce max HP
          gameState.player.maxHp -= 30;
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
        text: "Bottle some water (Gain Health Potion)",
        effect: (gameState) => {
          gameState.player.inventory.push({
            name: "Health Potion",
            description: "Instantly heals 50 HP",
            effect: (gameState) => {
              const healAmount = 50;
              gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
              return healAmount;
            },
            triggerMessage: (amount) => `Health Potion restored ${amount} HP!`,
            oneTimeUse: true,
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
    minRewardPerBattle: 30,
    maxRewardPerBattle: 40,
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
    totalNodes: 25, // Total nodes in a run
    pathsPerNode: 2, // Number of paths from each node
    minElites: 4, // Minimum number of elite battles per run
    maxElites: 10, // Maximum number of elite battles per run
    shopFrequency: 0.15, // Chance for a shop node
    restFrequency: 0.15, // Chance for a rest node
    eventFrequency: 0.1, // Chance for an event node
    eliteFrequency: 0.15, // Chance for an elite battle node
    treasureFrequency: 0.2, // Chance for a treasure node
    bossNodeIndex: 25, // The node index of the final boss
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

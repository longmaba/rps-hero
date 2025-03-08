// Add this near the top with other constants
const emojiMap = {
  Rock: "✊",
  Paper: "✋",
  Scissors: "✌️",
};

// Add this function near the top with other helper functions
function determineRoundWinner(playerAction, enemyAction) {
  // Track player move frequency for roasting material
  if (!gameState.playerMoveCounts) {
    gameState.playerMoveCounts = { Rock: 0, Paper: 0, Scissors: 0 };
  }
  gameState.playerMoveCounts[playerAction]++;

  if (playerAction === enemyAction) {
    return "tie";
  } else if (
    (playerAction === "Rock" && enemyAction === "Scissors") ||
    (playerAction === "Paper" && enemyAction === "Rock") ||
    (playerAction === "Scissors" && enemyAction === "Paper")
  ) {
    return "win";
  } else {
    return "lose";
  }
}

// Game state
let gameState = {
  player: {
    hp: GAME_CONFIG.playerStartingHp,
    maxHp: GAME_CONFIG.playerStartingHp,
    inventory: [], // No starting item, will be chosen
    plannedActions: [],
    coins: GAME_CONFIG.currency.startingAmount, // Player's currency
    baseDamage: GAME_CONFIG.baseDamage, // Add base damage tracking
  },
  enemy: {
    hp: 100,
    maxHp: 100,
    actions: [],
    type: "Basic",
    baseDamage: GAME_CONFIG.baseDamage, // Enemy gets their own base damage from config
  },
  runProgress: 0,
  maxBattles: GAME_CONFIG.maxBattles, // Final boss at battle 3
  itemSelectionContext: "start", // Context for item selection (start or victory)
  activeDebuff: null, // Current active debuff (if any)
  enemyScaling: {
    baseHp: GAME_CONFIG.enemyScaling.baseHp,
    hpIncreasePerBattle: GAME_CONFIG.enemyScaling.hpIncreasePerBattle,
    baseDamage: GAME_CONFIG.baseDamage,
    damageIncreasePerBattle: GAME_CONFIG.enemyScaling.damageIncreasePerBattle,
  },
  usedReviveItem: false, // Track if a revival item has been used in the current battle
  map: [], // Will store the generated map with nodes
  currentNodeIndex: 0, // Current position on the map
  availableNodeChoices: [], // Available nodes to choose from
  playerAllActions: [], // Track all player actions for elite enemy AI
  temporaryItems: [], // Items that are only active for a specific duration
  burnEffects: [], // Track any burn effects applied to enemies
  playerDebuffs: [], // Track any debuffs applied to the player
  adaptiveMemory: null, // Track adaptive memory for Adaptive Learner enemies
  roundResults: [], // Track round results for Adaptive Learner
};

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Start with relic selection
  showItemSelection("start");
});

// Function to initialize a battle
function initBattle(isEliteBattle = false) {
  gameState.runProgress++;
  gameState.currentRound = 1; // Reset round for each battle

  const existingOtherImages = document.querySelectorAll(".rest-site-image, .event-image-container, .shop-image-container");
  existingOtherImages.forEach((img) => img.remove());
  // Add a separator in the battle log for a new battle
  const log = document.getElementById("resolution-log");
  if (log) {
    const battleSeparator = document.createElement("div");
    battleSeparator.className = "battle-separator";

    // Show which battle number this is
    const battleNumber = gameState.runProgress;
    let battleType = "Normal";

    if (isEliteBattle) {
      battleType = "Elite";
    } else if (gameState.runProgress === gameState.maxBattles) {
      battleType = "Boss";
    }

    const battleMarker = document.createElement("p");
    battleMarker.className = "battle-marker";
    battleMarker.setAttribute("data-battle-type", battleType);
    battleMarker.textContent = `⚔️ Battle #${battleNumber} (${battleType}) ⚔️`;

    battleSeparator.appendChild(battleMarker);
    log.appendChild(battleSeparator);
    log.scrollTop = log.scrollHeight;
  }

  // Reset the used revival item flag for the new battle
  gameState.usedReviveItem = false;

  // Reset the consumed state for defensive items
  gameState.player.inventory.forEach((item) => {
    if (item.type === "defensive") {
      item.consumed = false;
    }
  });

  // Process any burn effects before starting a new battle
  gameState.burnEffects = [];

  // Clear any player debuffs from previous battles
  gameState.playerDebuffs = [];

  // Clear adaptive memory for Adaptive Learner enemies
  gameState.adaptiveMemory = null;

  // Reset round results tracking
  gameState.roundResults = [];

  // Reset used roasts
  gameState.usedRoasts = [];

  // Select enemy type based on node type
  let enemyType;

  const currentNode = gameState.map[gameState.currentNodeIndex];

  if (currentNode && currentNode.type === NODE_TYPES.ELITE.id) {
    // Select a random elite enemy
    const eliteEnemies = ENEMY_TYPES.filter((enemy) => enemy.isElite);
    enemyType = eliteEnemies[Math.floor(Math.random() * eliteEnemies.length)];
  } else if (gameState.runProgress === gameState.maxBattles || (currentNode && currentNode.isBoss)) {
    // Boss enemy
    enemyType = ENEMY_TYPES.find((enemy) => enemy.type === "Boss");
  } else {
    // Regular enemy - wider selection including new enemy types
    const regularEnemies = ENEMY_TYPES.filter((enemy) => !enemy.isElite && enemy.type !== "Boss");

    // Weight selection based on difficulty
    // More likely to encounter basic enemies early, advanced enemies later
    let availableEnemies;
    const progressPercentage = gameState.runProgress / gameState.maxBattles;

    if (progressPercentage < 0.2) {
      // Early game - mostly basic enemies
      availableEnemies = regularEnemies.filter((enemy) => ["Basic", "Mimic"].includes(enemy.type));
      // availableEnemies = regularEnemies.filter((enemy) => ["Roaster"].includes(enemy.type));
    } else if (progressPercentage < 0.4) {
      // Mid game - introduce Predictor and Shielded
      availableEnemies = regularEnemies.filter((enemy) => ["Basic", "Mimic", "Predictor", "Shielded", "Roaster"].includes(enemy.type));
    } else {
      // Late game - all enemy types available with higher chance for advanced types
      availableEnemies = regularEnemies;

      // Increase chance of difficult enemies in late game
      if (Math.random() < 0.8) {
        availableEnemies = availableEnemies.filter((enemy) => !["Basic", "Mimic"].includes(enemy.type));
      }
    }

    enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
  }

  // Calculate scaled HP based on runProgress
  const scaledHp = Math.floor(enemyType.maxHp + (gameState.runProgress - 1) * gameState.enemyScaling.hpIncreasePerBattle);

  gameState.enemy = {
    hp: scaledHp,
    maxHp: scaledHp,
    type: enemyType, // Store the enemy type object
    actions: enemyType.getActions(gameState), // Set actions for the first round
    baseDamage: enemyType.baseDamage || GAME_CONFIG.baseDamage, // Enemy gets their own base damage from config
  };

  // Clear all planned actions
  gameState.player.plannedActions = [];

  // Update the UI to reflect the new battle
  updateEnemyDisplay();
  updateUI();

  if (enemyType.onBattleStart) {
    enemyType.onBattleStart(gameState);
  }
  // Randomly apply a debuff with a certain chance
  if (Math.random() < GAME_CONFIG.debuffChance && !gameState.activeDebuff) {
    const availableDebuffs = DEBUFFS.filter(
      (debuff) => debuff.id !== "emotional_damage" && !gameState.player.inventory.some((item) => item.name === "Lucky Charm")
    );
    if (availableDebuffs.length > 0) {
      const randomDebuff = availableDebuffs[Math.floor(Math.random() * availableDebuffs.length)];
      gameState.activeDebuff = { ...randomDebuff };

      // Apply the debuff effect
      if (gameState.activeDebuff.applyEffect) {
        gameState.activeDebuff.applyEffect(gameState);
      }

      // Show notification for the new debuff
      showDebuffNotification(randomDebuff);
    }
  }

  // Setup debuff display
  setupDebuffDisplay();

  // Check for action replacers (debuffs that replace allowed moves)
  applyActionReplacerEffects();

  // Update enemy HP display
  updateHP("enemy", gameState.enemy.hp);

  // Handle any temporary items
  processTemporaryItems();

  // Update enemy actions display after a short delay
  setTimeout(() => {
    updateEnemyActionsDisplay();
  }, 500);
}

// Show a notification when a debuff is applied
function showDebuffNotification(debuff) {
  const log = document.getElementById("resolution-log");
  if (log) {
    // Create a debuff notification element
    const notifElem = document.createElement("p");
    notifElem.className = "debuff-notification";
    notifElem.innerHTML = `<strong>${debuff.icon} DEBUFF APPLIED: ${debuff.name}</strong><br>${debuff.description}`;
    log.appendChild(notifElem);
    log.scrollTop = log.scrollHeight;
  }
}

// Function to resolve a round of battle
function resolveRound() {
  const playerActions = [...gameState.player.plannedActions];
  const enemyActions = [...gameState.enemy.actions];

  // Enable battle mode for focused UI during resolution
  const statusElement = document.getElementById("status");
  if (statusElement) {
    statusElement.classList.add("battle-mode");
  }

  // Show active comparison and hide battle log
  const activeComparisonElement = document.getElementById("active-comparison");
  if (activeComparisonElement) {
    activeComparisonElement.classList.remove("hidden");
    activeComparisonElement.innerHTML = "<p>Getting ready to fight...</p>";
  }

  // Reset round info object to track critical hits
  gameState.roundInfo = {
    lastCriticalHit: null,
  };

  // Store player's actions for this round (for mimic enemies)
  gameState.playerLastRoundActions = [...playerActions];

  // Store all player actions for elite enemy AI
  if (!gameState.playerAllActions) {
    gameState.playerAllActions = [];
  }
  gameState.playerAllActions = gameState.playerAllActions.concat(playerActions);

  // Clear planned actions for both player and enemy
  gameState.player.plannedActions = [];
  gameState.enemy.actions = [];

  // Apply any round-based debuff effects
  if (gameState.activeDebuff && gameState.activeDebuff.roundEffect) {
    gameState.activeDebuff.roundEffect(gameState);
  }

  // Apply player debuffs from Debilitator enemy
  if (gameState.playerDebuffs && gameState.playerDebuffs.length > 0) {
    // Apply active debuffs
    gameState.playerDebuffs.forEach((debuff, index) => {
      // Apply debuff effect
      if (debuff.type === "damage_reduction") {
        // Log the debuff effect
        const log = document.getElementById("resolution-log");
        const debuffMsg = document.createElement("p");
        debuffMsg.className = "debuff-effect";
        debuffMsg.textContent = `💔 ${debuff.name}: Your damage is reduced by ${Math.round(debuff.value * 100)}%`;
        log.appendChild(debuffMsg);
      } else if (debuff.type === "move_confusion") {
        // Log the debuff effect
        const log = document.getElementById("resolution-log");
        const debuffMsg = document.createElement("p");
        debuffMsg.className = "debuff-effect";
        debuffMsg.textContent = `🌀 ${debuff.name}: ${debuff.effect}`;
        log.appendChild(debuffMsg);
      }

      // Reduce debuff duration
      debuff.duration--;

      // Remove expired debuffs
      if (debuff.duration <= 0) {
        // Log that debuff has expired
        const log = document.getElementById("resolution-log");
        const expireMsg = document.createElement("p");
        expireMsg.className = "debuff-expired";
        expireMsg.textContent = `✨ ${debuff.name} has worn off!`;
        log.appendChild(expireMsg);

        // Remove from array
        gameState.playerDebuffs.splice(index, 1);
      }
    });
  }

  // Process any burn effects
  if (gameState.burnEffects && gameState.burnEffects.length > 0) {
    // Apply burn damage to the enemy
    gameState.burnEffects.forEach((burnEffect, index) => {
      const burnDamage = burnEffect.damage;
      gameState.enemy.hp = Math.max(0, gameState.enemy.hp - burnDamage);

      // Log the burn effect
      const log = document.getElementById("resolution-log");
      const burnMsg = document.createElement("p");
      burnMsg.className = "burn-effect";
      burnMsg.textContent = `🔥 Burn effect deals ${burnDamage} damage!`;
      log.appendChild(burnMsg);

      // Reduce burn duration
      burnEffect.duration--;

      // Remove expired burn effects
      if (burnEffect.duration <= 0) {
        gameState.burnEffects.splice(index, 1);
      }
    });

    // Update enemy HP display
    updateHP("enemy", gameState.enemy.hp);

    // Check if enemy died from burn damage
    if (gameState.enemy.hp <= 0) {
      handleVictory();
      return;
    }
  }

  // Disable resolve button during resolution
  document.getElementById("resolve-btn").disabled = true;

  // Get the log container
  const log = document.getElementById("resolution-log");

  // Add a round separator instead of clearing
  const roundSeparator = document.createElement("div");
  roundSeparator.className = "round-separator";
  roundSeparator.innerHTML = `<p class="round-marker">🔄 Round ${gameState.currentRound} 🔄</p>`;
  log.appendChild(roundSeparator);
  log.scrollTop = log.scrollHeight;

  // Compare actions one by one with a delay
  let currentIndex = 0;
  let roundDamageToEnemy = 0;
  let roundDamageToPlayer = 0;

  // Elite Double Trouble ability
  const isDoubleTrouble = gameState.enemy.type.type === "Double Trouble";

  function compareNextAction() {
    if (currentIndex < playerActions.length) {
      const playerAction = playerActions[currentIndex];
      const enemyAction = enemyActions[currentIndex];

      // Update the active comparison display
      const activeComparisonElement = document.getElementById("active-comparison");
      if (activeComparisonElement) {
        // Display the current comparison with animated emoji
        activeComparisonElement.innerHTML = `
          <div class="player-action">${getActionEmoji(playerAction)}</div>
          <div class="vs-text">VS</div>
          <div class="enemy-action">${getActionEmoji(enemyAction)}</div>
        `;
      }

      // Apply move confusion from debuffs if applicable
      let modifiedPlayerAction = playerAction;
      if (gameState.playerDebuffs) {
        const confusionDebuff = gameState.playerDebuffs.find((d) => d.type === "move_confusion");
        if (confusionDebuff && Math.random() < confusionDebuff.value) {
          // 25% chance to change move to a random one
          const moves = ["Rock", "Paper", "Scissors"];
          modifiedPlayerAction = moves[Math.floor(Math.random() * moves.length)];

          // Log the confusion effect
          const log = document.getElementById("resolution-log");
          const confusionMsg = document.createElement("p");
          confusionMsg.className = "debuff-effect";
          confusionMsg.textContent = `🌀 Confusion changes your ${playerAction} to ${modifiedPlayerAction}!`;
          log.appendChild(confusionMsg);
        }
      }

      // Reveal this enemy move with animation
      const enemyActionElement = document.querySelector(`#enemy-actions [data-index="${currentIndex}"]`);
      if (enemyActionElement) {
        enemyActionElement.textContent = emojiMap[enemyAction];
        enemyActionElement.classList.remove("hidden-action");
        enemyActionElement.classList.add("flip-in");
      }

      // Add to player's all actions record
      if (!gameState.playerAllActions) {
        gameState.playerAllActions = [];
      }
      gameState.playerAllActions.push(modifiedPlayerAction);

      // Create a result element for this comparison
      const resultElem = document.createElement("p");
      const log = document.getElementById("resolution-log");

      // Modified damage calculation with NaN protection
      let playerDamage = Number(GAME_CONFIG.baseDamage) || 0;
      let enemyDamage = Number(GAME_CONFIG.baseDamage) || 0;

      // Apply damage reduction debuff if applicable
      let damageMultiplier = 1;
      if (gameState.playerDebuffs) {
        const damageReductionDebuff = gameState.playerDebuffs.find((d) => d.type === "damage_reduction");
        if (damageReductionDebuff) {
          damageMultiplier = 1 - damageReductionDebuff.value; // Reduce damage by debuff value (e.g., 0.25)
        }
      }

      // Apply item effects with fallback to 0
      playerDamage = Math.max(0, calculatePlayerDamage(modifiedPlayerAction, enemyAction)) || 0;
      enemyDamage = Math.max(0, calculateEnemyDamage(modifiedPlayerAction, enemyAction)) || 0;

      // Apply damage reduction from debuff
      playerDamage = Math.floor(playerDamage * damageMultiplier);

      // Ensure we have valid numbers
      if (isNaN(playerDamage)) playerDamage = 0;
      if (isNaN(enemyDamage)) enemyDamage = 0;

      // Determine outcome
      let result;
      let playerWins = false;
      let enemyWins = false;

      // Store round result for Adaptive Learner
      if (!gameState.roundResults) {
        gameState.roundResults = [];
      }

      if (modifiedPlayerAction === enemyAction) {
        result = "Tie!";
        resultElem.className = "tie";
        gameState.roundResults.push("tie");
      } else if (
        (modifiedPlayerAction === "Rock" && enemyAction === "Scissors") ||
        (modifiedPlayerAction === "Paper" && enemyAction === "Rock") ||
        (modifiedPlayerAction === "Scissors" && enemyAction === "Paper")
      ) {
        result = "You win!";
        resultElem.className = "player-win";
        playerWins = true;
        gameState.roundResults.push("win");

        // Apply scaling based on battle number
        // playerDamage += (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;

        // Display effects for conditional modifiers (without re-applying them)
        // The actual damage calculation has already happened in calculatePlayerDamage
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && item.condition === "win" && item.appliesTo === playerAction) {
            // Just display the message without recalculating damage
            if (item.triggerMessage) {
              const effectElem = document.createElement("p");
              effectElem.className = "item-effect";

              // For items that can crit, check the return value for isCrit
              let effectResult = null;
              if (item.name === "Double Dragon" && playerAction === "Rock") {
                // Special handling for Double Dragon message
                effectElem.textContent = item.triggerMessage(playerDamage);
                log.appendChild(effectElem);
              } else if (item.hasCritEffect) {
                // For items with crit effects, only show message if a critical hit occurred
                const wasCriticalHit =
                  gameState.roundInfo &&
                  gameState.roundInfo.lastCriticalHit &&
                  gameState.roundInfo.lastCriticalHit.item === item.name &&
                  gameState.roundInfo.lastCriticalHit.action === playerAction;

                if (wasCriticalHit) {
                  // Only show message if this was actually a critical hit
                  effectElem.className = "item-effect special-relic";
                  effectElem.textContent = item.triggerMessage(playerDamage);
                  log.appendChild(effectElem);
                }
              } else {
                // Standard message display for non-crit effects
                effectElem.textContent = item.triggerMessage(playerDamage);
                log.appendChild(effectElem);
              }
            }
          }
        });

        // Apply any item effects for winning (ACTION MODIFIERS - existing code)
        gameState.player.inventory.forEach((item) => {
          if (item.type === "actionModifier" && item.appliesTo === playerAction) {
            // We don't need to call effect again here since damage is already calculated

            // Check for burn effects
            if (item.applyBurn) {
              gameState.burnEffects.push({
                damage: item.burnDamage,
                duration: item.burnDuration,
              });

              // Log the burn application
              const burnMsg = document.createElement("p");
              burnMsg.className = "burn-applied";
              burnMsg.textContent = `🔥 ${item.name} applied burn effect for ${item.burnDuration} rounds!`;
              log.appendChild(burnMsg);
            }
          }
        });

        // Also apply temporary items (existing code)
        gameState.temporaryItems.forEach((item) => {
          if (item.type === "actionModifier" && item.appliesTo === playerAction) {
            playerDamage = item.effect(playerDamage);
          }
        });

        // Apply the damage to the enemy (existing code)
        gameState.enemy.hp = Math.max(0, gameState.enemy.hp - playerDamage);
        roundDamageToEnemy += playerDamage;

        // Update enemy HP display (existing code)
        updateHP("enemy", gameState.enemy.hp);
      } else {
        result = "Enemy wins!";
        resultElem.className = "enemy-win";
        enemyWins = true;
        gameState.roundResults.push("lose");

        // Calculate enemy damage based on round progression
        // enemyDamage += (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;

        // Apply elite bonus damage if applicable
        if (gameState.enemy.type.isElite) {
          enemyDamage = Math.floor(enemyDamage * 1.2);
        }

        // Apply any defensive item effects
        let originalDamage = enemyDamage;
        // We're NOT displaying messages here anymore - they're already displayed in calculateEnemyDamage
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && item.condition === "lose") {
            // Check if this item applies to all actions or specifically to the PLAYER'S action
            if (item.appliesTo === "All" || item.appliesTo === playerAction) {
              // Do NOT reapply the effect or show messages - both are handled in calculateEnemyDamage
              // This block intentionally left empty to preserve the structure but avoid duplicate effects
            }
          }
        });

        // Check if player has dodge
        if (gameState.player.dodgeNextAttack) {
          enemyDamage = 0;
          gameState.player.dodgeNextAttack = false;

          // Show dodge message
          const dodgeMsg = document.createElement("p");
          dodgeMsg.className = "dodge-effect";
          dodgeMsg.textContent = "💨 Attack dodged!";
          log.appendChild(dodgeMsg);
        }

        // Apply the damage to the player
        gameState.player.hp = Math.max(0, gameState.player.hp - enemyDamage);
        roundDamageToPlayer += enemyDamage;

        // Update player HP display
        updateHP("player", gameState.player.hp);

        // Check if the enemy is a Debilitator and try to apply a debuff
        if (gameState.enemy.type.type === "Debilitator" && gameState.enemy.type.applyDebuff) {
          const appliedDebuff = gameState.enemy.type.applyDebuff(gameState, "lose");

          // If a debuff was applied, log it
          if (appliedDebuff) {
            const debuffMsg = document.createElement("p");
            debuffMsg.className = "enemy-effect";
            debuffMsg.textContent = `☠️ ${gameState.enemy.type.type} applies ${appliedDebuff.name}: ${appliedDebuff.effect}`;
            log.appendChild(debuffMsg);
          }
        }
      }

      // Display the result
      resultElem.innerHTML = `Player: ${emojiMap[modifiedPlayerAction]} vs ${getEnemyName()}: ${emojiMap[enemyAction]} - ${result}`;
      // Only show damage numbers if it's not a tie, and only show the side that takes damage
      if (result !== "Tie!") {
        if (playerWins) {
          // If player wins, only enemy takes damage
          if (playerDamage > 0) {
            resultElem.innerHTML += ` (${playerDamage} damage to enemy)`;
          }
        } else {
          // If enemy wins, only player takes damage
          if (enemyDamage > 0) {
            resultElem.innerHTML += ` (${enemyDamage} damage to player)`;
          }
        }
      }
      log.appendChild(resultElem);
      log.scrollTop = log.scrollHeight;

      // For Double Trouble elite, process the action twice
      if (isDoubleTrouble && playerWins) {
        // Ensure playerDamage is a number
        playerDamage = Number(playerDamage) || 0;

        // Apply damage a second time
        gameState.enemy.hp = Math.max(0, gameState.enemy.hp - playerDamage);
        roundDamageToEnemy += playerDamage;

        // Log the double effect
        const doubleElem = document.createElement("p");
        doubleElem.className = "elite-effect";
        doubleElem.textContent = `⚡ Double Trouble resolves move twice! Additional ${playerDamage} damage!`;
        log.appendChild(doubleElem);

        // Update enemy HP display
        updateHP("enemy", gameState.enemy.hp);
      } else if (isDoubleTrouble && enemyWins) {
        // Ensure enemyDamage is a number
        enemyDamage = Number(enemyDamage) || 0;

        // Apply damage a second time
        gameState.player.hp = Math.max(0, gameState.player.hp - enemyDamage);
        roundDamageToPlayer += enemyDamage;

        // Log the double effect
        const doubleElem = document.createElement("p");
        doubleElem.className = "elite-effect";
        doubleElem.textContent = `⚡ Double Trouble resolves move twice! Additional ${enemyDamage} damage!`;
        log.appendChild(doubleElem);

        // Update player HP display
        updateHP("player", gameState.player.hp);
      }

      // Move to the next action after a delay
      currentIndex++;
      setTimeout(() => {
        // Check for game over after each action
        if (gameState.enemy.hp <= 0) {
          // Handle enemy defeat
          handleVictory();
          return;
        } else if (gameState.player.hp <= 0) {
          // Check if player has a revival item like Phoenix Feather
          const reviveItem = gameState.player.inventory.find((item) => item.type === "defensive" && !item.consumed);

          if (reviveItem && !gameState.usedReviveItem) {
            const revived = reviveItem.effect(gameState);
            if (revived) {
              reviveItem.consumed = true;
              gameState.usedReviveItem = true;

              // Log revival effect
              const reviveElem = document.createElement("p");
              reviveElem.className = "item-effect revival";
              reviveElem.textContent = reviveItem.triggerMessage();
              log.appendChild(reviveElem);

              // Update player HP display
              updateHP("player", gameState.player.hp);

              // Add animation class
              document.getElementById("player-hp-bar").parentElement.classList.add("player-revival");
              setTimeout(() => {
                document.getElementById("player-hp-bar").parentElement.classList.remove("player-revival");
              }, 1500);

              // Continue to next action
              compareNextAction();
            } else {
              handleDefeat();
            }
          } else {
            handleDefeat();
          }
          return;
        } else {
          compareNextAction();
        }
      }, GAME_CONFIG.battleDelay);
    } else {
      // All actions resolved, prepare for the next round
      finishRound();
    }
  }

  // Start comparing actions
  compareNextAction();

  function finishRound() {
    // Disable battle mode now that we're back to preparation phase
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.classList.remove("battle-mode");
    }

    // Hide active comparison element
    const activeComparisonElement = document.getElementById("active-comparison");
    if (activeComparisonElement) {
      activeComparisonElement.classList.add("hidden");
    }

    // Increment round counter
    gameState.currentRound++;
    document.getElementById("round-number").textContent = gameState.currentRound;

    // Log a round separator
    const log = document.getElementById("resolution-log");
    // const roundSeparator = document.createElement("p");
    // roundSeparator.className = "round-separator";
    // roundSeparator.textContent = `---- Round ${gameState.currentRound} ----`;
    // log.appendChild(roundSeparator);

    // Special handling for Berserker enemy - update rage level message
    if (gameState.enemy.type.type === "Berserker" || gameState.enemy.type.type === "Elite Berserker") {
      const healthPercentage = gameState.enemy.hp / gameState.enemy.maxHp;
      const enrageLevel = 1 - healthPercentage;

      if (enrageLevel > 0.3) {
        const rageMsg = document.createElement("p");
        rageMsg.className = "enemy-effect";

        let rageText = "🔥 ";
        if (enrageLevel > 0.7) {
          rageText += "The Berserker is EXTREMELY enraged!";
        } else if (enrageLevel > 0.5) {
          rageText += "The Berserker is highly enraged!";
        } else {
          rageText += "The Berserker grows angry!";
        }

        rageMsg.textContent = rageText;
        log.appendChild(rageMsg);
      }
    }

    // Get new actions for the enemy
    gameState.enemy.actions = gameState.enemy.type.getActions(gameState);

    // Log special messages for certain enemy types
    if (gameState.enemy.type.type === "Adaptive Learner" && gameState.currentRound > 2) {
      const adaptMsg = document.createElement("p");
      adaptMsg.className = "enemy-effect";
      adaptMsg.textContent = "🧠 The Adaptive Learner analyzes your strategy...";
      log.appendChild(adaptMsg);
    } else if (gameState.enemy.type.type === "Predictor" && gameState.playerAllActions && gameState.playerAllActions.length > 5) {
      const predictMsg = document.createElement("p");
      predictMsg.className = "enemy-effect";
      predictMsg.textContent = "👁️ The Predictor anticipates your next move...";
      log.appendChild(predictMsg);
    }

    // Re-enable the action buttons
    document.querySelectorAll("#actions button").forEach((btn) => {
      if (!btn.classList.contains("disabled-by-debuff")) {
        btn.disabled = false;
      }
    });

    // Apply the vampire lifesteal effect if applicable
    gameState.player.inventory.forEach((item) => {
      if (item.isLifesteal && roundDamageToEnemy > 0) {
        const healAmount = Math.floor(roundDamageToEnemy * item.lifestealPercent);
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);

        // Show lifesteal message
        const lifestealMsg = document.createElement("p");
        lifestealMsg.className = "heal-effect";
        lifestealMsg.textContent = `💉 ${item.name} heals you for ${healAmount} HP!`;
        log.appendChild(lifestealMsg);

        // Update player HP display
        updateHP("player", gameState.player.hp);
      }
    });

    // Update inventory display to make Health Potions clickable again
    updateInventoryDisplay();

    // Delay before clearing and recreating enemy moves
    setTimeout(() => {
      // Clear enemy moves with animation
      const enemyActions = document.getElementById("enemy-actions");

      // Add flip-out animation to all actions
      Array.from(enemyActions.children).forEach((actionDiv, index) => {
        actionDiv.classList.add("flip-out");
      });

      // Clear and recreate actions after animation completes
      setTimeout(() => {
        // Clear the element before updating
        enemyActions.innerHTML = "";

        // Reset enemy actions display with new actions
        updateEnemyActionsDisplay();

        // Add flip-in effect to the new action boxes
        setTimeout(() => {
          Array.from(enemyActions.children).forEach((actionDiv) => {
            actionDiv.classList.add("flip-in");
          });
        }, 100);

        // Reset player's planned actions display
        updatePlannedActionsDisplay();
      }, 800);
    }, 500);
  }

  function handleDefeat() {
    // Clear the enemy's actions
    clearEnemyMovesWithAnimation();
    if (gameState.enemy.type.onBattleEnd) {
      gameState.enemy.type.onBattleEnd();
    }

    // Ensure battle mode is turned off
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.classList.remove("battle-mode");
    }

    // Hide active comparison element
    const activeComparisonElement = document.getElementById("active-comparison");
    if (activeComparisonElement) {
      activeComparisonElement.classList.add("hidden");
    }

    // Log defeat message
    const defeatMsg = document.createElement("p");
    defeatMsg.className = "defeat-message";
    defeatMsg.textContent = "💀 DEFEATED! You have been bested by the enemy.";
    log.appendChild(defeatMsg);
    log.scrollTop = log.scrollHeight;

    // End the game
    setTimeout(() => {
      endGame("Defeat! You were overwhelmed by your enemies. Better luck next time!");
    }, 2000);
  }

  // Function to handle battle victory
  function handleVictory() {
    // Clear the enemy's actions
    clearEnemyMovesWithAnimation();
    if (gameState.enemy.type.onBattleEnd) {
      gameState.enemy.type.onBattleEnd();
    }

    // Ensure battle mode is turned off
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.classList.remove("battle-mode");
    }

    // Hide active comparison element
    const activeComparisonElement = document.getElementById("active-comparison");
    if (activeComparisonElement) {
      activeComparisonElement.classList.add("hidden");
    }

    // Log victory message
    const victoryMsg = document.createElement("p");
    victoryMsg.className = "victory-message";

    // Check if it was an elite battle
    const currentNode = gameState.map[gameState.currentNodeIndex];
    const isEliteBattle = currentNode && currentNode.type === NODE_TYPES.ELITE.id;
    const isBossBattle = currentNode && currentNode.isBoss;

    if (isBossBattle) {
      victoryMsg.textContent = "🏆 VICTORY! You have defeated the final boss!";
      document.getElementById("resolution-log").appendChild(victoryMsg);
      document.getElementById("resolution-log").scrollTop = document.getElementById("resolution-log").scrollHeight;

      // End the game with victory
      setTimeout(() => {
        endGame("Victory! You have completed your adventure and defeated all enemies. Congratulations!");
      }, 2000);
      return;
    } else if (isEliteBattle) {
      victoryMsg.textContent = "💪 ELITE VICTORY! You defeated a powerful foe!";
    } else {
      victoryMsg.textContent = "✨ VICTORY! Enemy defeated!";
    }

    document.getElementById("resolution-log").appendChild(victoryMsg);
    document.getElementById("resolution-log").scrollTop = document.getElementById("resolution-log").scrollHeight;

    // Award coins with possible elite bonus
    awardCoins(isEliteBattle);

    // Clear the active debuff after battle completes
    if (gameState.activeDebuff) {
      // Log that the debuff has been removed
      const debuffClearedLog = document.createElement("p");
      debuffClearedLog.className = "item-effect";
      debuffClearedLog.textContent = `😌 ${gameState.activeDebuff.name} debuff has worn off!`;
      document.getElementById("resolution-log").appendChild(debuffClearedLog);
      document.getElementById("resolution-log").scrollTop = document.getElementById("resolution-log").scrollHeight;

      // Remove the debuff
      gameState.activeDebuff = null;

      // Hide the debuff display
      const debuffContainer = document.getElementById("debuff-container");
      if (debuffContainer) {
        debuffContainer.classList.add("hidden");
        debuffContainer.innerHTML = "";
      }

      // Reset any disabled buttons
      document.querySelectorAll("#actions button").forEach((button) => {
        button.classList.remove("disabled-by-debuff");
        button.title = "";
      });
    }

    // Apply post-battle effects
    applyPostBattleEffects();

    // Hide battle screen before showing node selection
    setTimeout(() => {
      // Make sure to hide the battle screen
      document.getElementById("battle-screen").classList.add("hidden");

      // Update available nodes first
      updateAvailableNodes();

      // Then show node selection
      showNodeSelection();
    }, 2000);
  }
}

// Function to get enemy name (type)
function getEnemyName() {
  return gameState.enemy.type.type || "Enemy";
}

// Function to animate HP changes
function animateHPChange(entity) {
  const bar = document.getElementById(`${entity}-hp-bar`);
  bar.classList.add("hp-change");

  // Remove animation class after animation completes
  setTimeout(() => {
    bar.classList.remove("hp-change");
  }, 500);
}

function updateHP(entity, newValue) {
  const maxHP = entity === "player" ? gameState.player.maxHp : gameState.enemy.maxHp;
  const percentage = (newValue / maxHP) * 100;

  document.getElementById(`${entity}-hp`).textContent = `${newValue}/${maxHP}`;
  document.getElementById(`${entity}-hp-bar`).style.width = `${percentage}%`;
}

// End game
function endGame(message) {
  // Copy the resolution log to the game over screen
  const resolutionLog = document.getElementById("resolution-log").innerHTML;
  document.getElementById("battle-screen").classList.add("hidden");
  const gameOver = document.getElementById("game-over");
  gameOver.classList.remove("hidden");
  document.getElementById("game-over-message").textContent = message;

  // Make sure the Start New Adventure button is visible
  const newRunButton = document.querySelector("#game-over button");
  if (newRunButton) {
    newRunButton.style.display = "block";
  }

  // Add a new element to display the final battle log in the game over screen
  const finalLogContainer = document.getElementById("final-battle-log") || document.createElement("div");
  if (!document.getElementById("final-battle-log")) {
    finalLogContainer.id = "final-battle-log";
    gameOver.insertBefore(finalLogContainer, gameOver.querySelector("button"));
  }

  // Add a heading for the final battle log
  finalLogContainer.innerHTML = "<h3>Final Battle Results:</h3>" + resolutionLog;
}

// Start new run
function startNewRun() {
  // Hide the game over screen
  document.getElementById("game-over").classList.add("hidden");

  // Hide the Start New Adventure button (it will reappear when needed)
  const newRunButton = document.querySelector("#game-over button");
  if (newRunButton) {
    newRunButton.style.display = "none";
  }

  // Properly reset game state
  gameState = {
    player: {
      hp: GAME_CONFIG.playerStartingHp,
      maxHp: GAME_CONFIG.playerStartingHp,
      inventory: [],
      plannedActions: [],
      coins: GAME_CONFIG.currency.startingAmount,
      currentNode: 0,
      baseDamage: GAME_CONFIG.baseDamage, // Add base damage tracking
    },
    enemy: {
      hp: ENEMY_TYPES[0].maxHp, // Initialize with first enemy type's HP
      maxHp: ENEMY_TYPES[0].maxHp,
      actions: [],
      type: ENEMY_TYPES[0].type,
      baseDamage: GAME_CONFIG.baseDamage, // Enemy gets their own base damage from config
    },
    runProgress: 0,
    maxBattles: GAME_CONFIG.maxBattles,
    currentRound: 1,
    playerLastRoundActions: null,
    itemSelectionContext: "start",
    activeDebuff: null,
    enemyScaling: {
      baseHp: GAME_CONFIG.enemyScaling.baseHp,
      hpIncreasePerBattle: GAME_CONFIG.enemyScaling.hpIncreasePerBattle,
      baseDamage: GAME_CONFIG.baseDamage,
      damageIncreasePerBattle: GAME_CONFIG.enemyScaling.damageIncreasePerBattle,
    },
    usedReviveItem: false, // Track if a revival item has been used in the current battle
    map: [], // Will store the generated map
    currentNodeIndex: 0, // Current position on the map
    availableNodeChoices: [], // Available nodes to choose from
    playerAllActions: [], // Track all player actions for elite enemy AI
    temporaryItems: [], // Items that are only active for a specific duration
    burnEffects: [], // Track any burn effects applied to enemies
    playerDebuffs: [], // Track any debuffs applied to the player
    adaptiveMemory: null, // Track adaptive memory for Adaptive Learner enemies
    roundResults: [], // Track round results for Adaptive Learner
  };

  // Clear any remaining DOM elements
  document.querySelectorAll(".rest-site-image, .event-image-container").forEach((el) => el.remove());
  console.log("1");

  // Reset the final battle log container if it exists
  const finalLogContainer = document.getElementById("final-battle-log");
  if (finalLogContainer) {
    finalLogContainer.innerHTML = "";
  }

  // Explicitly clear the debuff container and reset UI elements
  const debuffContainer = document.getElementById("debuff-container");
  if (debuffContainer) {
    debuffContainer.classList.add("hidden");
    debuffContainer.innerHTML = "";
  }

  // Reset any disabled buttons
  document.querySelectorAll("#actions button").forEach((button) => {
    button.classList.remove("disabled-by-debuff");
    button.title = "";
  });

  // Remove any event image containers that might persist between runs
  const eventImage = document.getElementById("event-image");
  if (eventImage) {
    eventImage.remove();
    console.log(2);
  }

  // Reset item selection screen back to default state
  const itemSelection = document.getElementById("item-selection");
  itemSelection.removeAttribute("data-context");
  itemSelection.classList.add("hidden");

  // Clear any event choices from previous events
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.className = "";
  itemOptionsContainer.innerHTML = "";

  // Show item selection instead of directly starting battle
  showItemSelection("start");

  // Reset battle log
  const resolutionLog = document.getElementById("resolution-log");
  if (resolutionLog) {
    resolutionLog.innerHTML = "";
  }

  // Clear player inventory display
  document.getElementById("inventory").textContent = "None";

  // Reset HP bars to full
  updateHP("player", gameState.player.hp);
  updateHP("enemy", 0); // Set enemy HP to 0 initially until a battle starts

  // Reset enemy description and name
  document.getElementById("enemy-name").textContent = "Enemy";
  document.getElementById("enemy-description").textContent = "";

  // Reset currency display
  updateCurrencyDisplay();

  // Clear enemy actions display
  const enemyActionsContainer = document.getElementById("enemy-actions");
  if (enemyActionsContainer) {
    enemyActionsContainer.innerHTML = "";
  }

  // Clear debuff display
  setupDebuffDisplay();

  // Generate new map and start the adventure
  generateMap();
  updateMapDisplay();
  showNodeSelection();

  // On first run, show item selection for choosing a relic
  if (!gameState.firstRunCompleted) {
    showItemSelection("start");
    gameState.firstRunCompleted = true;
  }
}

// Helper function to update planned actions display
function updatePlannedActionsDisplay() {
  const plannedDiv = document.getElementById("planned-actions");
  plannedDiv.innerHTML = "";

  // Display planned actions with emojis
  gameState.player.plannedActions.forEach((action, index) => {
    const actionElem = document.createElement("div");
    actionElem.textContent = emojiMap[action];
    actionElem.setAttribute("title", action);
    actionElem.setAttribute("aria-label", action);
    actionElem.onclick = () => removeAction(index);
    plannedDiv.appendChild(actionElem);
  });

  // Add placeholders for empty slots
  for (let i = gameState.player.plannedActions.length; i < 5; i++) {
    const emptyElem = document.createElement("div");
    emptyElem.textContent = "⬜"; // Empty slot emoji
    plannedDiv.appendChild(emptyElem);
  }

  // Update resolve button state
  document.getElementById("resolve-btn").disabled = gameState.player.plannedActions.length !== 5;
}

// Function to update currency display
function updateCurrencyDisplay() {
  const currencyDisplay = document.getElementById("player-currency");
  if (currencyDisplay) {
    currencyDisplay.textContent = gameState.player.coins;
  }
}

// Function to update the UI
function updateUI() {
  // Update player and enemy HP bars
  updateHP("player", gameState.player.hp);
  updateHP("enemy", gameState.enemy.hp);

  // Update round number
  document.getElementById("round-number").textContent = gameState.currentRound;

  // Update currency display
  updateCurrencyDisplay();

  // Update battle information based on current node
  const currentNode = gameState.map[gameState.currentNodeIndex];
  const isBossBattle = currentNode && currentNode.isBoss;
  const isEliteBattle = currentNode && currentNode.type === NODE_TYPES.ELITE.id;

  // Add battle type classes to game container
  const gameContainer = document.getElementById("game-container");
  gameContainer.classList.remove("final-boss", "elite-battle");

  if (isBossBattle) {
    gameContainer.classList.add("final-boss");
  } else if (isEliteBattle) {
    gameContainer.classList.add("elite-battle");
  }

  // Animate the enemy HP bar on battle start to draw attention
  if (gameState.battleJustStarted) {
    document.getElementById("enemy-hp-bar").classList.add("battle-start");
    setTimeout(() => {
      document.getElementById("enemy-hp-bar").classList.remove("battle-start");
    }, 1000);
    gameState.battleJustStarted = false;
  }

  // Update enemy name and description
  const enemyNameElem = document.getElementById("enemy-name");
  const enemyDescElem = document.getElementById("enemy-description");
  if (enemyNameElem) {
    // Ensure we're using the correct property (enemy.type.type or enemy.name)
    enemyNameElem.textContent = gameState.enemy.type ? gameState.enemy.type.type : gameState.enemy.name || "Enemy";
  }
  if (enemyDescElem) {
    // Use the correct enemy description with HTML support for elite abilities
    if (gameState.enemy.type) {
      let description = gameState.enemy.type.description;

      // Add elite ability if present
      // if (gameState.enemy.type.isElite && gameState.enemy.type.eliteAbility) {
      //   description += `<br><br><strong>Elite Ability:</strong> ${gameState.enemy.type.eliteAbility}`;
      // }

      enemyDescElem.innerHTML = description;
    } else {
      enemyDescElem.textContent = gameState.enemy.description || "";
    }
  }

  // Update the enemy actions container
  const enemyActionsContainer = document.getElementById("enemy-actions");
  if (enemyActionsContainer) {
    updateEnemyActionsDisplay();
  }

  // Update inventory display
  updateInventoryDisplay();

  // Update planned actions
  updatePlannedActionsDisplay();

  // Update debuff display
  setupDebuffDisplay();

  // Ensure click sounds are attached to any newly created buttons
  ensureClickSounds();
}

// Function to add player action
function addAction(action) {
  // Check if the action is banned by active debuff
  if (gameState.activeDebuff && gameState.activeDebuff.effect.type === "ban_action" && gameState.activeDebuff.effect.action === action) {
    // Shake the button to indicate it's not allowed
    const button = document.querySelector(`#actions button[aria-label="Select ${action}"]`);
    if (button) {
      button.classList.add("shake");
      setTimeout(() => {
        button.classList.remove("shake");
      }, 500);
    }
    return;
  }

  // Check if only a specific action is allowed
  if (gameState.activeDebuff && gameState.activeDebuff.effect.type === "only_allow_action" && gameState.activeDebuff.effect.action !== action) {
    // Shake the button to indicate it's not allowed
    const button = document.querySelector(`#actions button[aria-label="Select ${action}"]`);
    if (button) {
      button.classList.add("shake");
      setTimeout(() => {
        button.classList.remove("shake");
      }, 500);
    }
    return;
  }

  if (gameState.player.plannedActions.length < 5) {
    gameState.player.plannedActions.push(action);
    // Directly update the planned actions display to avoid redrawing the entire UI
    updatePlannedActionsDisplay();
  }
}

// Function to remove player action at specific index
function removeAction(index) {
  gameState.player.plannedActions.splice(index, 1);
  // Directly update the planned actions display to avoid redrawing the entire UI
  updatePlannedActionsDisplay();
}

// Function to clear all planned actions
function clearAllActions() {
  gameState.player.plannedActions = [];
  // Directly update the planned actions display to avoid redrawing the entire UI
  updatePlannedActionsDisplay();
}

// Function to get random unique items from specified item pool
function getRandomUniqueItems(count, itemPool) {
  // Safeguard against non-iterable or empty itemPool
  if (!itemPool || !Array.isArray(itemPool) || itemPool.length === 0) {
    console.warn("getRandomUniqueItems: itemPool is not valid. Returning empty array.");
    return [];
  }

  const items = [...itemPool]; // Create a copy of the specified item array
  const result = [];

  // Ensure we don't try to get more items than available
  count = Math.min(count, items.length);

  // Randomly select 'count' items
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * items.length);
    result.push(items[randomIndex]);
    // Remove the selected item to avoid duplicates
    items.splice(randomIndex, 1);
  }

  return result;
}

// Modified awardCoins function to handle elite battles
function awardCoins(isEliteBattle) {
  const min = GAME_CONFIG.currency.minRewardPerBattle;
  const max = GAME_CONFIG.currency.maxRewardPerBattle;
  let coinsAwarded = Math.floor(Math.random() * (max - min + 1)) + min;

  // Elite battles give bonus coins
  if (isEliteBattle) {
    coinsAwarded = Math.floor(coinsAwarded * GAME_CONFIG.currency.eliteBattleMultiplier);
  }

  gameState.player.coins += coinsAwarded;

  // Show coins message in log
  const log = document.getElementById("resolution-log");
  const coinsMsg = document.createElement("p");
  coinsMsg.className = "coin-effect";
  coinsMsg.textContent = `💰 Coins: +${coinsAwarded} ${isEliteBattle ? "(Elite Bonus!)" : ""} (Total: ${gameState.player.coins})`;
  log.appendChild(coinsMsg);
  log.scrollTop = log.scrollHeight;

  // Update currency display
  updateCurrencyDisplay();
}

// Function to show item selection screen
function showItemSelection(context) {
  // Clear any previous item selection stuff
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");
  itemSelection.dataset.context = context;

  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("run-map").classList.add("hidden");

  // Set default heading and message
  document.getElementById("item-selection-heading").textContent = "Choose an Item";
  document.getElementById("item-selection-message").textContent = "Select one item to add to your inventory:";

  // Different contexts have different item pools and messages
  let itemPool;
  let itemsToShow = 3;

  switch (context) {
    case "start":
      // Start with choosing a relic
      itemPool = RELICS.filter((relic) => !gameState.player.inventory.some((i) => i.name === relic.name));
      itemsToShow = 3;
      document.getElementById("item-selection-heading").textContent = "Choose a Relic";
      document.getElementById("item-selection-message").textContent = "Select one relic to begin your adventure:";
      break;
    case "treasure":
      // Items from treasure chest - mix of relics and consumables
      const availableRelics = RELICS.filter((relic) => !gameState.player.inventory.some((i) => i.name === relic.name));
      const availableConsumables = ITEMS.filter(
        (item) =>
          item.type === "consumable" &&
          (item.name !== "Health Potion" || gameState.player.inventory.filter((i) => i.name === "Health Potion").length < 3)
      );

      // Combine pools with a higher chance of relics
      itemPool = [...availableRelics, ...availableConsumables];
      itemsToShow = 3;

      document.getElementById("item-selection-heading").textContent = "Treasure Chest";
      document.getElementById("item-selection-message").textContent = "Select one item from the treasure chest:";
      break;
    // ... other cases ...
  }

  // Ensure itemPool is an array and not empty
  if (!itemPool || !Array.isArray(itemPool) || itemPool.length === 0) {
    console.warn(`No valid items found for context: ${context}. Using fallback items.`);

    // Create a set of fallback items based on the context
    if (context === "treasure") {
      // For treasure nodes, offer coins and healing
      itemPool = [
        {
          name: "Lucky Coin",
          description: "A shiny gold coin that brings good fortune. Gain 50 coins immediately.",
          effect: (state) => {
            state.player.currency += 50;
            return "You gained 50 coins!";
          },
          type: "consumable",
          rarity: "rare",
        },
        {
          name: "Health Crystal",
          description: "A glowing crystal that restores 30 HP when used.",
          effect: (state) => {
            const healAmount = Math.min(30, state.player.maxHp - state.player.hp);
            state.player.hp += healAmount;
            return `You healed for ${healAmount} HP!`;
          },
          type: "consumable",
          rarity: "uncommon",
        },
      ];
    } else {
      // Default fallback for any other context
      itemPool = [
        {
          name: "Mystery Box",
          description: "A mysterious box. Who knows what's inside?",
          effect: (state) => {
            state.player.currency += 25;
            return "You found 25 coins inside!";
          },
          type: "consumable",
          rarity: "common",
        },
      ];
    }

    itemsToShow = Math.min(2, itemPool.length);
  }

  // Get random items from the pool
  const items = getRandomUniqueItems(itemsToShow, itemPool);

  // Create item elements
  items.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = "item-option";
    itemElement.className += item.rarity ? ` ${item.rarity}` : " common";

    // For relics, add special styling
    if (item.type === "relic") {
      itemElement.className += " relic";
    }

    const itemName = document.createElement("h3");
    itemName.textContent = item.name;

    const itemEffects = document.createElement("p");

    if (item.description) {
      itemEffects.textContent = item.description;
    }

    itemElement.appendChild(itemName);
    itemElement.appendChild(itemEffects);

    if (item.appliesTo) {
      const appliesTo = document.createElement("div");
      appliesTo.textContent = `Applies to: ${item.appliesTo}`;
      appliesTo.className = "item-applies-to";
      appliesTo.dataset.appliesTo = item.appliesTo;
      itemElement.appendChild(appliesTo);
    }

    itemElement.onclick = () => selectItem(item);
    itemOptionsContainer.appendChild(itemElement);
  });

  // Ensure click sounds are attached to the newly created items
  ensureClickSounds();
}

// Function to handle item selection
function selectItem(item) {
  // Add the selected item to player's inventory
  gameState.player.inventory.push(item);

  // Apply one-time effects for utility items
  if (item.type === "utility" && item.isOneTimeEffect) {
    const result = item.effect(gameState);
    if (result && item.triggerMessage) {
      // Log the effect if it has a message
      const log = document.getElementById("resolution-log");
      const effectElem = document.createElement("p");
      effectElem.className = "item-effect";
      effectElem.textContent = `✨ ${item.triggerMessage()}`;
      log.appendChild(effectElem);
      log.scrollTop = log.scrollHeight;
    }
  }

  // Hide item selection screen
  document.getElementById("item-selection").classList.add("hidden");

  // Continue based on context
  if (gameState.itemSelectionContext === "start") {
    // Start the game with node-based progression
    gameState.map = generateMap();
    gameState.currentNodeIndex = 0;
    updateAvailableNodes();
    updateMapDisplay();
    showNodeSelection();
  } else if (gameState.itemSelectionContext === "victory") {
    // Show node selection after item selection
    showNodeSelection();
  } else if (gameState.itemSelectionContext === "treasure") {
    // Make sure the node is marked as visited and update the map
    const currentNode = gameState.map[gameState.currentNodeIndex];
    if (currentNode) {
      currentNode.visited = true;
      updateAvailableNodes(); // Update available nodes based on new state
      updateMapDisplay();
    }
    showNodeSelection();
  }

  // Update inventory display
  updateInventoryDisplay();
}

// Start game
startNewRun();

// Function to generate the map for the run
function generateMap() {
  const map = [];

  // Create initial node (starting point)
  map.push({
    id: 0,
    type: "start",
    x: 0,
    y: 50,
    connections: [1, 2], // Connect to two initial nodes for branching paths
    visited: true,
  });

  // Create branching nodes
  let currentId = 1;
  const nodeCount = 10; // Total nodes in the run (excluding start)
  const pathWidth = 20; // Vertical spread between paths

  // Create first two nodes after start (first branch)
  for (let i = 1; i <= 2; i++) {
    // Determine node type based on position
    let nodeType = determineNodeType(i);

    // Elite enemies should only appear from node 3 onwards
    if (nodeType === NODE_TYPES.ELITE.id && i < 3) {
      nodeType = NODE_TYPES.BATTLE.id;
    }

    // Create node with y position offset depending on branch
    map.push({
      id: currentId,
      type: nodeType,
      x: 100 / (nodeCount + 1), // First column
      y: i === 1 ? 50 - pathWidth : 50 + pathWidth, // Branch vertical position
      connections: [], // We'll add connections later
      visited: false,
    });

    currentId++;
  }

  // Create remaining nodes with branches
  for (let column = 2; column <= nodeCount; column++) {
    // Last column is always the boss
    const isBoss = column === nodeCount;

    // For the last column, create just one boss node
    if (isBoss) {
      const bossNodeId = currentId;
      map.push({
        id: bossNodeId,
        type: NODE_TYPES.BATTLE.id,
        isBoss: true,
        x: (column * 100) / (nodeCount + 1),
        y: 50, // Center position
        connections: [],
        visited: false,
      });

      // Connect all nodes from the previous column to the boss
      const previousColumnNodes = map.filter((node) => Math.abs(node.x - ((column - 1) * 100) / (nodeCount + 1)) < 0.1);

      previousColumnNodes.forEach((node) => {
        node.connections.push(bossNodeId);
      });

      currentId++;
      continue;
    }

    // For middle columns, create 2 nodes with connections to both previous and next column
    for (let branch = 1; branch <= 2; branch++) {
      let nodeType = determineNodeType(column);

      // Create node
      const nodeId = currentId;
      map.push({
        id: nodeId,
        type: nodeType,
        x: (column * 100) / (nodeCount + 1),
        y: branch === 1 ? 50 - pathWidth : 50 + pathWidth,
        connections: [],
        visited: false,
      });

      // Connect to previous column
      const previousColumnNodes = map.filter((node) => Math.abs(node.x - ((column - 1) * 100) / (nodeCount + 1)) < 0.1);

      // Each node in previous column connects to this node
      previousColumnNodes.forEach((prevNode) => {
        prevNode.connections.push(nodeId);
      });

      currentId++;
    }
  }

  return map;
}

// Helper function to determine node type based on position
function determineNodeType(position) {
  // Calculate probabilities based on position in the journey
  const random = Math.random();

  // First node is always a battle
  if (position === 1) {
    return NODE_TYPES.BATTLE.id;
  }

  // Check if the previous node was non-combat
  // If we have 2 consecutive non-combat nodes already, force a combat node
  if (position > 2) {
    // Get the previous two nodes
    const prevNode = gameState.map.find((node) => node.x === ((position - 1) * 100) / gameState.map.length);
    const prevPrevNode = gameState.map.find((node) => node.x === ((position - 2) * 100) / gameState.map.length);

    // If both previous nodes were non-combat, force a combat node
    if (prevNode && prevPrevNode) {
      const isCombatNode = (type) => type === NODE_TYPES.BATTLE.id || type === NODE_TYPES.ELITE.id;
      const prevIsCombat = isCombatNode(prevNode.type);
      const prevPrevIsCombat = isCombatNode(prevPrevNode.type);

      // If we have 2 consecutive non-combat nodes, force a combat node
      if (!prevIsCombat && !prevPrevIsCombat) {
        return Math.random() < 0.7 ? NODE_TYPES.BATTLE.id : NODE_TYPES.ELITE.id;
      }

      // If we have 1 consecutive non-combat node, reduce chance of another non-combat
      if (!prevIsCombat && prevPrevIsCombat) {
        // 70% chance for combat node
        if (Math.random() < 0.7) {
          return Math.random() < 0.7 ? NODE_TYPES.BATTLE.id : NODE_TYPES.ELITE.id;
        }
      }
    }
  }

  // Get frequencies from GAME_CONFIG
  let battleChance = 0.6 - position * 0.02; // Decrease battle chance slightly as we progress
  let eliteChance = GAME_CONFIG.map.eliteFrequency || 0.15;
  let shopChance = GAME_CONFIG.map.shopFrequency || 0.15;
  let restChance = GAME_CONFIG.map.restFrequency || 0.15;
  let eventChance = GAME_CONFIG.map.eventFrequency || 0.1;
  let treasureChance = GAME_CONFIG.map.treasureFrequency || 0.2;

  // Adjust frequencies based on position if needed
  if (position > 3) {
    eliteChance += 0.05; // Increase elite chance later in the run
  }

  // Normalize probabilities to ensure they sum to 1
  const total = battleChance + eliteChance + shopChance + restChance + eventChance + treasureChance;
  battleChance /= total;
  eliteChance /= total;
  shopChance /= total;
  restChance /= total;
  eventChance /= total;
  // treasureChance is remainder

  // Determine node type based on random value
  let cumulativeChance = 0;

  cumulativeChance += battleChance;
  if (random < cumulativeChance) return NODE_TYPES.BATTLE.id;

  cumulativeChance += eliteChance;
  if (random < cumulativeChance) return NODE_TYPES.ELITE.id;

  cumulativeChance += shopChance;
  if (random < cumulativeChance) return NODE_TYPES.SHOP.id;

  cumulativeChance += restChance;
  if (random < cumulativeChance) return NODE_TYPES.REST.id;

  cumulativeChance += eventChance;
  if (random < cumulativeChance) return NODE_TYPES.EVENT.id;

  return NODE_TYPES.TREASURE.id;
}

// Helper function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Update available nodes based on current position
function updateAvailableNodes() {
  // Clear previous choices
  gameState.availableNodeChoices = [];

  // If we're at the starting point or a node with connections
  if (gameState.map[gameState.currentNodeIndex]) {
    const connections = gameState.map[gameState.currentNodeIndex].connections;
    console.log("Current node:", gameState.currentNodeIndex, "Connections:", connections);

    // Add each connected node as an available choice
    connections.forEach((nodeId) => {
      const node = gameState.map.find((node) => node.id === nodeId);
      if (node && !node.visited) {
        gameState.availableNodeChoices.push(node);
        console.log("Added available node:", node.id, node.type);
      }
    });
  }
}

// Update the map display
function updateMapDisplay() {
  const mapContainer = document.getElementById("node-map-container");

  // Clear current map display
  mapContainer.innerHTML = "";

  // Find current node
  const currentNode = gameState.map[gameState.currentNodeIndex];
  if (!currentNode) return;

  // Create the steps container
  const stepsContainer = document.createElement("div");
  stepsContainer.className = "antd-steps";
  mapContainer.appendChild(stepsContainer);

  // Only show a limited history plus current node in the antd steps
  let nodesToDisplay = [];

  // Add up to 2 visited nodes for history
  const visitedNodes = gameState.map
    .filter((node) => node.visited && node.id !== currentNode.id)
    .sort((a, b) => b.x - a.x)
    .slice(0, 2);

  nodesToDisplay = [...visitedNodes];

  // Add current node
  nodesToDisplay.push(currentNode);

  // Sort nodes by x position
  nodesToDisplay.sort((a, b) => a.x - b.x);

  // Create steps for completed and current nodes
  nodesToDisplay.forEach((node, index) => {
    // Create step item
    const stepItem = document.createElement("div");
    stepItem.className = "antd-step";
    stepItem.setAttribute("data-id", node.id);
    stepItem.setAttribute("data-type", node.type);

    // Set appropriate status
    if (node.id === currentNode.id) {
      stepItem.setAttribute("data-status", "current");
    } else if (node.visited) {
      stepItem.setAttribute("data-status", "finished");
    } else {
      stepItem.setAttribute("data-status", "pending");
    }

    if (node.isBoss) {
      stepItem.setAttribute("data-is-boss", "true");
    }

    // Create step icon container
    const iconContainer = document.createElement("div");
    iconContainer.className = "antd-step-icon";

    // Set node content based on type
    const nodeType = Object.values(NODE_TYPES).find((type) => type.id === node.type);

    // Show checkmark for current nodes and finished nodes, node icon for available nodes
    if (node.visited) {
      const checkmark = document.createElement("span");
      checkmark.className = "antd-step-checkmark";
      checkmark.textContent = "✓";
      iconContainer.appendChild(checkmark);

      // Add small icon to indicate what type of node it was
      const nodeTypeIndicator = document.createElement("span");
      nodeTypeIndicator.className = "antd-step-type-indicator";
      nodeTypeIndicator.textContent = nodeType ? nodeType.icon : "❓";
      iconContainer.appendChild(nodeTypeIndicator);
    } else {
      iconContainer.textContent = nodeType ? nodeType.icon : "❓";
    }

    // Add node title below the icon (visible for current and next nodes)
    if (node.id === currentNode.id) {
      const nodeTitle = document.createElement("div");
      nodeTitle.className = "antd-step-title";
      nodeTitle.textContent = nodeType ? nodeType.name : "Unknown";
      stepItem.appendChild(nodeTitle);
    }

    // Add tooltip
    if (nodeType) {
      const tooltip = document.createElement("div");
      tooltip.className = "node-tooltip";
      tooltip.innerHTML = `<h4>${nodeType.name}</h4>`;
      iconContainer.appendChild(tooltip);
    }

    stepItem.appendChild(iconContainer);

    // Create connecting line (except for last node)
    if (index < nodesToDisplay.length - 1) {
      const line = document.createElement("div");
      line.className = "antd-step-line";

      // If this node is visited or current, mark the line as active
      if (node.visited) {
        line.setAttribute("data-status", "active");
      }

      stepItem.appendChild(line);
    }

    stepsContainer.appendChild(stepItem);
  });

  // If there are available nodes to choose from, create a node options section
  if (gameState.availableNodeChoices.length > 0) {
    // Add a heading that says "Choose your next destination:"
    const choiceHeading = document.createElement("div");
    choiceHeading.className = "node-options-info";
    choiceHeading.textContent = "Choose your next destination:";
    mapContainer.appendChild(choiceHeading);

    // Create a container for node options
    const nodeOptionsContainer = document.createElement("div");
    nodeOptionsContainer.className = "node-options";
    mapContainer.appendChild(nodeOptionsContainer);

    // Create a node option for each available choice
    gameState.availableNodeChoices.forEach((node) => {
      const nodeType = Object.values(NODE_TYPES).find((type) => type.id === node.type);

      const nodeOption = document.createElement("div");
      nodeOption.className = "node-option";
      nodeOption.setAttribute("data-type", node.type);
      if (node.isBoss) {
        nodeOption.setAttribute("data-is-boss", "true");
      }

      // Create icon
      const iconElement = document.createElement("div");
      iconElement.className = "node-option-icon";
      iconElement.textContent = nodeType ? nodeType.icon : "❓";
      nodeOption.appendChild(iconElement);

      // Create details
      const detailsElement = document.createElement("div");
      detailsElement.className = "node-option-details";

      const nameElement = document.createElement("h3");
      nameElement.textContent = nodeType ? nodeType.name : "Unknown";
      detailsElement.appendChild(nameElement);

      const descElement = document.createElement("p");
      descElement.textContent = nodeType ? nodeType.description : "A mysterious location.";
      detailsElement.appendChild(descElement);

      nodeOption.appendChild(detailsElement);

      // Add click handler
      nodeOption.onclick = () => {
        selectNode(node);
      };

      nodeOptionsContainer.appendChild(nodeOption);
    });
  }

  // Ensure click sounds are attached to the map nodes
  ensureClickSounds();
}

// Show node selection screen
function showNodeSelection() {
  // Hide other screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("item-selection").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  // Clean up any event image that might be present
  const eventImage = document.getElementById("event-image");
  if (eventImage) {
    console.log(3);
    eventImage.remove();
  }

  // Reset item selection context
  const itemSelection = document.getElementById("item-selection");
  itemSelection.removeAttribute("data-context");

  // Clear any event choices from previous events
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.className = "";

  // Update map display - this now includes tooltips for each node
  updateMapDisplay();

  // Make run-map visible
  document.getElementById("run-map").classList.remove("hidden");
}

// Select a node from the map
function selectNode(node) {
  // Mark the node as visited
  node.visited = true;

  // Update current node index
  gameState.currentNodeIndex = gameState.map.findIndex((mapNode) => mapNode.id === node.id);

  // Update available nodes based on new position
  updateAvailableNodes();

  // Process the node based on its type
  processCurrentNode();
}

// Process the current node based on its type
function processCurrentNode() {
  const currentNode = gameState.map[gameState.currentNodeIndex];

  if (!currentNode) {
    console.error("Current node not found");
    return;
  }

  // Hide the node-options-info if it exists (cleanup)
  const nodeOptionsInfo = document.querySelector(".node-options-info");
  if (nodeOptionsInfo) {
    nodeOptionsInfo.remove();
  }

  // Hide run-map when entering a node
  document.getElementById("run-map").classList.add("hidden");

  // Process based on node type
  switch (currentNode.type) {
    case NODE_TYPES.BATTLE.id:
    case "start":
      // Show battle screen
      document.getElementById("battle-screen").classList.remove("hidden");

      // Initialize battle
      initBattle(false);
      break;
    case NODE_TYPES.ELITE.id:
      // Show battle screen
      document.getElementById("battle-screen").classList.remove("hidden");

      // Initialize elite battle
      initBattle(true);
      break;
    case NODE_TYPES.SHOP.id:
      // Show shop screen
      showShop();
      break;

    case NODE_TYPES.REST.id:
      // Show rest site options
      showRestSite();
      break;

    case NODE_TYPES.EVENT.id:
      // Show random event
      showEvent();
      break;

    case NODE_TYPES.TREASURE.id:
      // Show treasure chest
      showTreasure();
      break;

    default:
      console.error("Unknown node type:", currentNode.type);
      // Fall back to a battle
      document.getElementById("battle-screen").classList.remove("hidden");
      initBattle(false);
      // Update inventory to make Health Potions clickable
      updateInventoryDisplay();
  }

  // When leaving any screen
  // document.querySelectorAll(".rest-site-image, .event-image-container").forEach((el) => el.remove());
  // console.log(4);
}

// Show shop interface
function showShop() {
  // Hide other screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  // Show the item selection screen
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set context attribute for shop-specific styling
  itemSelection.setAttribute("data-context", "shop");

  const existingOtherImages = document.querySelectorAll(".rest-site-image, .event-image-container, .shop-image-container");
  existingOtherImages.forEach((img) => img.remove());
  // Add shop image container
  // Remove any existing shop image to prevent duplicates
  // const existingShopImage = document.querySelector(".shop-image-container");
  // if (existingShopImage) {
  //   existingShopImage.remove();
  // }

  // const existingRestImage = document.querySelector(".rest-site-image");
  // if (existingRestImage) {
  //   existingRestImage.remove();
  // }

  // const existingEventImage = document.querySelector(".event-image-container");
  // if (existingEventImage) {
  //   existingEventImage.remove();
  // }

  // Create new shop image container
  const shopImageContainer = document.createElement("div");
  shopImageContainer.className = "shop-image-container";
  console.log("Added shop image container");

  // Insert the shop image container into the DOM
  const messageElement = document.getElementById("item-selection-message");
  messageElement.parentNode.insertBefore(shopImageContainer, messageElement.nextSibling);

  // Set up shop UI
  document.getElementById("item-selection-heading").textContent = "Shop";
  document.getElementById("item-selection-message").textContent = `Purchase items with your coins (You have ${gameState.player.coins} coins).`;

  // Clear previous options
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  // Get 4 random shop items
  const shopItems = getRandomUniqueItems(4, SHOP_ITEMS);

  // Display shop items
  shopItems.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = `item-option ${item.rarity || "common"}`;

    const nameElement = document.createElement("h3");
    nameElement.textContent = item.name;
    itemElement.appendChild(nameElement);

    const descElement = document.createElement("p");
    descElement.textContent = item.description;
    itemElement.appendChild(descElement);

    const priceElement = document.createElement("div");
    priceElement.className = "price";
    priceElement.textContent = `${item.price} coins`;
    itemElement.appendChild(priceElement);

    // Disable if player can't afford it
    if (gameState.player.coins < item.price) {
      itemElement.classList.add("disabled");
      itemElement.onclick = () => {
        // Shake to indicate not enough coins
        itemElement.classList.add("shake");
        setTimeout(() => itemElement.classList.remove("shake"), 500);
      };
    } else {
      itemElement.onclick = () => purchaseItem(item);
    }

    itemOptionsContainer.appendChild(itemElement);
  });

  // Add leave shop option
  const leaveElement = document.createElement("div");
  leaveElement.className = "item-option leave-shop";
  leaveElement.textContent = "Leave Shop";
  leaveElement.onclick = () => {
    // Continue to next nodes
    updateAvailableNodes();
    showNodeSelection();
  };

  itemOptionsContainer.appendChild(leaveElement);
}

// Purchase an item from the shop
function purchaseItem(item) {
  // Deduct coins
  gameState.player.coins -= item.price;

  // Add item to inventory
  if (item.temporaryEffect) {
    gameState.temporaryItems.push({ ...item, battlesRemaining: item.duration || 1 });
  } else {
    gameState.player.inventory.push({ ...item });
  }

  // Apply one-time effects
  if (item.oneTimeUse && item.effect) {
    const result = item.effect(gameState);
    if (result && item.triggerMessage) {
      // Log the effect
      const log = document.createElement("p");
      log.className = "item-effect";
      log.textContent = item.triggerMessage(result);
      document.body.appendChild(log);
      setTimeout(() => log.remove(), 3000);
    }
  }

  // Update shop display
  updateCurrencyDisplay();
  updateInventoryDisplay();
  showShop();
}

// Show rest site options
function showRestSite() {
  // Hide other screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  // Show the item selection screen
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set context attribute for rest site-specific styling
  itemSelection.setAttribute("data-context", "rest");

  // Set rest site heading and message
  document.getElementById("item-selection-heading").textContent = "Rest Site";
  document.getElementById("item-selection-message").textContent = "Take a moment to recover and prepare for what lies ahead.";

  // Remove existing images first
  const existingImages = document.querySelectorAll(".rest-site-image, .event-image-container, .shop-image-container");
  existingImages.forEach((img) => img.remove());
  console.log(5);

  // Create rest site image
  const imageContainer = document.createElement("div");
  imageContainer.className = "rest-site-image";

  // insert the image after the message but before the item options
  const message = document.getElementById("item-selection-message");
  message.insertAdjacentElement("afterend", imageContainer);

  // document.getElementById("item-selection").insertAdjacentElement("afterend", imageContainer);

  // Display rest options
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";
  itemOptionsContainer.className = ""; // Remove any event-specific classes

  // Modified healing option creation
  const isFullHealth = gameState.player.hp >= gameState.player.maxHp;
  const healElement = document.createElement("div");
  healElement.className = `rest-option ${isFullHealth ? "disabled" : ""}`;
  healElement.innerHTML = `
    <h3>Rest and Heal</h3>
    <p>Recover ${GAME_CONFIG.rest.healAmount} HP</p>
    <p class="current-hp">Current HP: ${gameState.player.hp}/${gameState.player.maxHp}</p>
    ${isFullHealth ? '<p class="note">Already at full health!</p>' : ""}
  `;

  if (!isFullHealth) {
    healElement.onclick = () => {
      const actualHeal = Math.min(GAME_CONFIG.rest.healAmount, gameState.player.maxHp - gameState.player.hp);
      gameState.player.hp += actualHeal;
      updateHP("player", gameState.player.hp);

      // Create a heal message
      const healMessage = document.createElement("p");
      healMessage.className = "event-result";
      healMessage.textContent = `You healed ${actualHeal} HP!`;

      // Clear options and show the message
      itemOptionsContainer.innerHTML = "";
      itemOptionsContainer.appendChild(healMessage);

      // Automatically remove the message after a delay and show the next node
      setTimeout(() => {
        healMessage.classList.add("fade-out");
        setTimeout(() => {
          updateAvailableNodes();
          showNodeSelection();
        }, 1000);
      }, 2000);
    };
  }

  itemOptionsContainer.appendChild(healElement);

  // Option 2: Upgrade an item
  const upgradeElement = document.createElement("div");
  upgradeElement.className = "rest-option";

  const upgradeTitle = document.createElement("h3");
  upgradeTitle.textContent = "Forge: Upgrade an Item";
  upgradeElement.appendChild(upgradeTitle);

  const upgradeDesc = document.createElement("p");
  upgradeDesc.textContent = `Make one of your items 50% more powerful`;
  upgradeElement.appendChild(upgradeDesc);

  // Disable upgrade if no upgradeable items
  const upgradeableItems = gameState.player.inventory.filter(
    (item) => item.type === "actionModifier" && !item.upgraded && item.effect && typeof item.effect === "function"
  );

  if (upgradeableItems.length === 0) {
    upgradeElement.classList.add("disabled");

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = "No upgradeable items";
    upgradeElement.appendChild(note);

    upgradeElement.onclick = () => {
      upgradeElement.classList.add("shake");
      setTimeout(() => upgradeElement.classList.remove("shake"), 500);
    };
  } else {
    upgradeElement.onclick = () => showUpgradeOptions(upgradeableItems);
  }

  itemOptionsContainer.appendChild(upgradeElement);

  // Option 3: Continue without resting
  const continueElement = document.createElement("div");
  continueElement.className = "rest-option";
  continueElement.innerHTML = "<h3>Continue</h3><p>Move on without resting</p>";
  continueElement.onclick = () => {
    // Continue to next nodes
    updateAvailableNodes();
    showNodeSelection();
  };

  itemOptionsContainer.appendChild(continueElement);
}

// Function to display upgrade options for items at rest sites
function showUpgradeOptions(upgradeableItems) {
  // Get the item options container
  const itemOptionsContainer = document.getElementById("item-options");

  // Clear previous options
  itemOptionsContainer.innerHTML = "";

  // Update heading and message
  document.getElementById("item-selection-heading").textContent = "Forge: Select Item to Upgrade";
  document.getElementById("item-selection-message").textContent = "Choose one item to make 50% more powerful.";

  // Display each upgradeable item as an option
  upgradeableItems.forEach((item, index) => {
    const itemElement = document.createElement("div");
    itemElement.className = "item-option";

    const itemName = document.createElement("h3");
    itemName.textContent = item.name;
    itemElement.appendChild(itemName);

    const itemDesc = document.createElement("p");
    itemDesc.textContent = item.description;
    itemElement.appendChild(itemDesc);

    // Add applies-to info if present
    if (item.appliesTo) {
      const appliesTo = document.createElement("div");
      appliesTo.className = "item-applies-to";
      appliesTo.setAttribute("data-applies-to", item.appliesTo);
      appliesTo.textContent = `Applies to: ${item.appliesTo}`;
      itemElement.appendChild(appliesTo);
    }

    // Add click handler for upgrading
    itemElement.onclick = () => {
      // Make a copy of the item and enhance its effect
      const upgradedItem = { ...item };
      upgradedItem.upgraded = true;

      // Enhance the effect based on item type
      const originalEffect = item.effect;
      upgradedItem.effect = function (param) {
        // Call the original effect and enhance its result
        const result = originalEffect(param);

        // Different handling based on what the effect returns
        if (typeof result === "number") {
          // If effect returns a number (like damage), increase by 50%
          return Math.floor(result * 1.5);
        } else if (typeof result === "object" && result !== null) {
          // If effect returns an object (like damage & crit info)
          const enhancedResult = { ...result };
          if ("finalDamage" in result) {
            enhancedResult.finalDamage = Math.floor(result.finalDamage * 1.5);
          }
          return enhancedResult;
        }

        // Fall back to original result if we don't know how to enhance it
        return result;
      };

      // Update the description to show it's upgraded
      upgradedItem.description = `${item.description} (Upgraded: +50% effect)`;

      // Replace the original item in the inventory
      const itemIndex = gameState.player.inventory.findIndex((i) => i === item);
      if (itemIndex !== -1) {
        gameState.player.inventory[itemIndex] = upgradedItem;
      }

      // Show success message
      const upgradeMessage = document.createElement("p");
      upgradeMessage.className = "event-result";
      upgradeMessage.textContent = `${item.name} has been upgraded! It's now 50% more powerful.`;

      // Clear options and show the message
      itemOptionsContainer.innerHTML = "";
      itemOptionsContainer.appendChild(upgradeMessage);

      // Automatically continue after a delay
      setTimeout(() => {
        upgradeMessage.classList.add("fade-out");
        setTimeout(() => {
          updateAvailableNodes();
          showNodeSelection();
        }, 1000);
      }, 2000);
    };

    itemOptionsContainer.appendChild(itemElement);
  });

  // Add a back button
  const backButton = document.createElement("div");
  backButton.className = "item-option leave-shop";
  backButton.innerHTML = "<h3>Return</h3><p>Go back to rest site options</p>";
  backButton.onclick = () => showRestSite();
  itemOptionsContainer.appendChild(backButton);
}

// Show a random event
function showEvent() {
  // Hide other screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  // Show the item selection screen for events
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set context attribute for event-specific styling
  itemSelection.setAttribute("data-context", "event");

  // Randomly select an event
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

  // Update the heading and description
  document.getElementById("item-selection-heading").textContent = event.name;
  document.getElementById("item-selection-message").textContent = event.description;

  const existingOtherImages = document.querySelectorAll(".rest-site-image, .event-image-container, .shop-image-container");
  existingOtherImages.forEach((img) => img.remove());

  // // Remove any existing images to prevent duplicates or overlap
  // const existingEventImage = itemSelection.querySelector(".event-image-container");
  // if (existingEventImage) {
  //   console.log(6);
  //   existingEventImage.remove();
  // }

  // const existingRestImage = itemSelection.querySelector(".rest-site-image");
  // if (existingRestImage) {
  //   existingRestImage.remove();
  // }

  // const existingShopImage = itemSelection.querySelector(".shop-image-container");
  // if (existingShopImage) {
  //   existingShopImage.remove();
  // }

  // Create and insert the event image
  const imageContainer = document.createElement("div");
  imageContainer.className = "event-image-container";
  imageContainer.setAttribute("data-event", event.type);

  // Insert the image after the message but before the item options
  const message = document.getElementById("item-selection-message");
  message.insertAdjacentElement("afterend", imageContainer);

  // Add console log for debugging
  console.log("Event image container created with type:", event.type);

  // Clear the options container
  const itemOptions = document.getElementById("item-options");
  itemOptions.innerHTML = "";
  itemOptions.className = "event-options";

  // Create a choice element for each choice
  event.choices.forEach((choice) => {
    const choiceElement = document.createElement("div");
    choiceElement.className = "event-choice";
    choiceElement.textContent = choice.text;

    choiceElement.onclick = () => {
      // Apply the choice effect
      const result = choice.effect(gameState);

      // Update UI to reflect changes made by the event
      updateHP("player", gameState.player.hp);
      updateInventoryDisplay();
      updateCurrencyDisplay();

      // Log the effect for debugging
      console.log("Event effect applied:", result);
      console.log("Player state after event:", {
        hp: gameState.player.hp,
        maxHp: gameState.player.maxHp,
        inventory: gameState.player.inventory.map((item) => item.name),
        coins: gameState.player.coins,
      });

      // Show the result message
      const resultMessage = document.createElement("p");
      resultMessage.className = "event-result";
      resultMessage.textContent = result;
      itemOptions.innerHTML = "";
      itemOptions.appendChild(resultMessage);

      // Automatically remove the message after a delay and show the next node
      setTimeout(() => {
        resultMessage.classList.add("fade-out");
        setTimeout(() => {
          updateAvailableNodes();
          showNodeSelection();
        }, 1000);
      }, 2000);
    };

    itemOptions.appendChild(choiceElement);
  });
}

// Process temporary items at the start of battle
function processTemporaryItems() {
  // Remove expired items
  gameState.temporaryItems = gameState.temporaryItems.filter((item) => item.battlesRemaining > 0);

  // Decrement battle counter for remaining items
  gameState.temporaryItems.forEach((item, index) => {
    item.battlesRemaining--;
  });
}

// Apply action replacer effects (from debuffs)
function applyActionReplacerEffects() {
  // Reset any disabled buttons
  document.querySelectorAll("#actions button").forEach((button) => {
    button.classList.remove("disabled-by-debuff");
    button.disabled = false;
    button.title = "";
  });

  // If there's an active debuff that bans actions
  if (gameState.activeDebuff && gameState.activeDebuff.effect.type === "ban_action") {
    const bannedAction = gameState.activeDebuff.effect.action;
    const actionButton = document.querySelector(`#actions button[aria-label="Select ${bannedAction}"]`);

    if (actionButton) {
      actionButton.classList.add("disabled-by-debuff");
      actionButton.disabled = true;
      actionButton.title = `${bannedAction} is disabled by ${gameState.activeDebuff.name}`;
    }
  }

  // If there's an active debuff that only allows specific actions
  if (gameState.activeDebuff && gameState.activeDebuff.effect.type === "only_allow_action") {
    const allowedAction = gameState.activeDebuff.effect.action;

    document.querySelectorAll("#actions button").forEach((button) => {
      const actionLabel = button.getAttribute("aria-label");
      if (actionLabel && actionLabel !== `Select ${allowedAction}` && !button.textContent.includes("🗑️") && !button.textContent.includes("⚔️")) {
        button.classList.add("disabled-by-debuff");
        button.disabled = true;
        button.title = `Only ${allowedAction} is allowed due to ${gameState.activeDebuff.name}`;
      }
    });
  }
}

// Apply post-battle effects from items
function applyPostBattleEffects() {
  // Process temporary items first
  processTemporaryItems();

  // Handle scaling items
  let damageIncrease = 0;

  // Only apply scaling items if the current node is a battle or elite battle
  const currentNode = gameState.map[gameState.currentNodeIndex];
  const isBattleNode = currentNode && (currentNode.type === NODE_TYPES.BATTLE.id || currentNode.type === NODE_TYPES.ELITE.id);

  if (isBattleNode) {
    gameState.player.inventory.forEach((item) => {
      if (item.type === "scaling" && item.appliesTo === "playerBaseDamage") {
        const originalDamage = gameState.player.baseDamage;
        gameState.player.baseDamage = item.effect(gameState.player.baseDamage);
        damageIncrease += gameState.player.baseDamage - originalDamage;
      }
    });

    // Show trigger message if there was an increase
    if (damageIncrease > 0) {
      const logElem = document.createElement("p");
      logElem.textContent = `🏋️‍♂️ Training complete! Your base damage increased by ${damageIncrease}!`;
      logElem.className = "player-effect";
      document.getElementById("resolution-log").appendChild(logElem);
    }
  }

  // Rest of existing post-battle logic...
  // [Keep all other existing code in this function]
}

// Function to update the inventory display
function updateInventoryDisplay() {
  const inventoryElem = document.getElementById("inventory");
  if (!inventoryElem) return;

  if (gameState.player.inventory.length === 0) {
    inventoryElem.textContent = "None";
    return;
  }

  // Clear current inventory display
  inventoryElem.innerHTML = "";

  // Add all inventory items
  gameState.player.inventory.forEach((item, index) => {
    const itemSpan = document.createElement("span");
    itemSpan.className = "inventory-item";
    itemSpan.textContent = item.name;
    itemSpan.title = item.description;

    // Add data attribute for styling based on what the item applies to
    if (item.appliesTo) {
      itemSpan.setAttribute("data-applies-to", item.appliesTo);
    }

    // Add a flag if the item was upgraded
    if (item.upgraded) {
      itemSpan.setAttribute("data-upgraded", "true");
    }

    // Make Health Potions clickable during battle preparation if player is not at max health
    if (
      item.name === "Health Potion" &&
      document.getElementById("battle-screen") &&
      !document.getElementById("battle-screen").classList.contains("hidden") &&
      gameState.player.hp < gameState.player.maxHp
    ) {
      itemSpan.classList.add("usable-item");
      itemSpan.title += " (Click to use)";
      itemSpan.onclick = () => useHealthPotion(index);
    }

    // Add comma separator between items
    if (index < gameState.player.inventory.length - 1) {
      itemSpan.textContent += ", ";
    }

    inventoryElem.appendChild(itemSpan);
  });

  // Also include temporary items
  if (gameState.temporaryItems && gameState.temporaryItems.length > 0) {
    const tempHeader = document.createElement("div");
    tempHeader.className = "inventory-section";
    tempHeader.textContent = "Temporary Items:";
    inventoryElem.appendChild(document.createElement("br"));
    inventoryElem.appendChild(tempHeader);

    gameState.temporaryItems.forEach((item, index) => {
      const itemSpan = document.createElement("span");
      itemSpan.className = "inventory-item temporary";
      itemSpan.textContent = `${item.name} (${item.battlesRemaining} battle${item.battlesRemaining !== 1 ? "s" : ""} left)`;
      itemSpan.title = item.description;

      // Add data attribute for styling
      if (item.appliesTo) {
        itemSpan.setAttribute("data-applies-to", item.appliesTo);
      }

      // Add comma separator between items
      if (index < gameState.temporaryItems.length - 1) {
        itemSpan.textContent += ", ";
      }

      inventoryElem.appendChild(itemSpan);
    });
  }
}

// Function to use a Health Potion during battle preparation
function useHealthPotion(inventoryIndex) {
  // Only allow using potions during battle preparation
  if (document.getElementById("battle-screen").classList.contains("hidden")) {
    return;
  }

  // Don't allow using potions if the resolve button is disabled (battle in progress)
  const resolveBtn = document.getElementById("resolve-btn");
  if (resolveBtn && resolveBtn.disabled && resolveBtn.textContent !== "⚔️ Fight!") {
    // Battle is in progress, can't use potions
    return;
  }

  // Get the potion from inventory
  const potion = gameState.player.inventory[inventoryIndex];

  if (potion.name !== "Health Potion") {
    return;
  }

  // Apply the healing effect
  const healAmount = potion.effect(gameState);

  // Remove the potion from inventory
  gameState.player.inventory.splice(inventoryIndex, 1);

  // Update the HP display
  updateHP("player", gameState.player.hp);

  // Add a message to the battle log
  const log = document.getElementById("resolution-log");
  if (log) {
    const potionMessage = document.createElement("p");
    potionMessage.className = "player-win";
    potionMessage.textContent = `🧪 ${potion.triggerMessage(healAmount)}`;
    log.appendChild(potionMessage);
    log.scrollTop = log.scrollHeight;
  }

  // Update the inventory display
  updateInventoryDisplay();
}

// Function to set up the debuff display
function setupDebuffDisplay() {
  const debuffContainer = document.getElementById("debuff-container");
  if (!debuffContainer) return;

  // Clear current debuff display
  debuffContainer.innerHTML = "";

  // If there's an active debuff, display it
  if (gameState.activeDebuff) {
    debuffContainer.classList.remove("hidden");

    const iconElem = document.createElement("span");
    iconElem.className = "debuff-icon";
    iconElem.textContent = gameState.activeDebuff.icon;
    debuffContainer.appendChild(iconElem);

    const nameElem = document.createElement("span");
    nameElem.className = "debuff-name";
    nameElem.textContent = gameState.activeDebuff.name;
    debuffContainer.appendChild(nameElem);

    const descElem = document.createElement("span");
    descElem.className = "debuff-description";
    descElem.textContent = gameState.activeDebuff.description;
    debuffContainer.appendChild(descElem);
  } else {
    debuffContainer.classList.add("hidden");
  }
}

// Function to update enemy display
function updateEnemyDisplay() {
  // Update enemy name
  document.getElementById("enemy-name").textContent = gameState.enemy.type.type;

  // Update the enemy description
  const enemyDescriptionElem = document.getElementById("enemy-description");
  if (enemyDescriptionElem) {
    // Display only the base description without the elite ability text
    enemyDescriptionElem.textContent = gameState.enemy.type.description;
    enemyDescriptionElem.className = "enemy-desc";
  }

  // Update the enemy actions container
  const enemyActionsContainer = document.getElementById("enemy-actions");
  enemyActionsContainer.innerHTML = ""; // Clear existing actions

  // Add hidden actions for enemy
  for (let i = 0; i < 5; i++) {
    const actionDiv = document.createElement("div");
    actionDiv.className = "hidden-action";
    actionDiv.textContent = "?";
    actionDiv.dataset.index = i;
    enemyActionsContainer.appendChild(actionDiv);
  }
}

// Function to update enemy actions display
function updateEnemyActionsDisplay() {
  const enemyActionsContainer = document.getElementById("enemy-actions");
  enemyActionsContainer.innerHTML = "";

  // Add hidden actions without animation
  for (let i = 0; i < 5; i++) {
    const actionDiv = document.createElement("div");
    actionDiv.className = "hidden-action";
    actionDiv.textContent = "?";
    actionDiv.dataset.index = i;
    enemyActionsContainer.appendChild(actionDiv);
  }
}

// Function to clear enemy moves with animation
function clearEnemyMovesWithAnimation() {
  const enemyActions = document.getElementById("enemy-actions");
  // Simply clear immediately without animations
  enemyActions.innerHTML = "";
  updateEnemyActionsDisplay();
}

// Function to clear the battle log
function clearBattleLog() {
  const log = document.getElementById("resolution-log");
  if (log) {
    // Add confirmation using browser's built-in confirm
    if (confirm("Are you sure you want to clear the entire battle log?")) {
      log.innerHTML = "";
    }
  }
}

// Add these functions near the top of game.js
function calculatePlayerDamage(playerAction, enemyAction) {
  // Use player's individual base damage
  let baseDamage = gameState.player.baseDamage;

  // Apply scaling effects first
  gameState.player.inventory.forEach((item) => {
    if (item.type === "scaling" && item.appliesTo === "baseDamage") {
      baseDamage = item.effect(baseDamage);
    }
  });

  // Determine the outcome of the round
  const result = determineRoundWinner(playerAction, enemyAction);

  // If it's a tie, there's no damage
  if (result === "tie") {
    return 0;
  }

  // Apply Shielded enemy's blocking if applicable (for player hits on enemy)
  if (result === "win" && gameState.enemy.type.type === "Shielded" && gameState.enemy.type.hasShield && gameState.enemy.type.shieldBlock) {
    // Check if shield blocks the attack completely
    if (gameState.enemy.type.shieldBlock(playerAction)) {
      // Log the shield block
      const log = document.getElementById("resolution-log");
      if (log) {
        const blockMsg = document.createElement("p");
        blockMsg.className = "enemy-effect";
        blockMsg.textContent = `🛡️ Shield completely blocks your ${playerAction} attack!`;
        log.appendChild(blockMsg);
      }
      return 0; // Attack completely blocked
    }
    // Partial damage reduction
    else if (gameState.enemy.type.damageReduction) {
      // Initialize finalDamage now as we'll use it for shield calculations
      let finalDamage = baseDamage;
      const reducedDamage = Math.floor(finalDamage * (1 - gameState.enemy.type.damageReduction));

      // Log the damage reduction
      const log = document.getElementById("resolution-log");
      if (log) {
        const reduceMsg = document.createElement("p");
        reduceMsg.className = "enemy-effect";
        reduceMsg.textContent = `🛡️ Shield reduces damage from ${finalDamage} to ${reducedDamage}!`;
        log.appendChild(reduceMsg);
      }

      return reducedDamage;
    }
  }

  // Track if a critical hit occurred
  let hadCriticalHit = false;

  // Initialize finalDamage
  let finalDamage = baseDamage;

  // Apply action modifier effects (items that boost a specific action)
  gameState.player.inventory.forEach((item) => {
    if (item.type === "actionModifier" && item.appliesTo === playerAction) {
      // Ensure we're working with numbers
      const effectResult = Number(item.effect(finalDamage)) || 0;
      if (!isNaN(effectResult)) {
        finalDamage = effectResult;
      }
    }
  });

  // Process conditional modifiers only if the condition is met
  // (for winner effects, only process if player won)
  if (result === "win") {
    // Flag to track applied effects
    const appliedEffects = new Set();

    gameState.player.inventory.forEach((item) => {
      if (item.type === "conditionalModifier" && item.condition === "win" && item.appliesTo === playerAction && !appliedEffects.has(item.name)) {
        // Mark this effect as applied
        appliedEffects.add(item.name);

        // Get effect result - either a number or an object with finalDamage
        const effectResult = item.effect(finalDamage, gameState);

        // Handle both object returns and direct number returns
        if (effectResult && typeof effectResult === "object") {
          if ("finalDamage" in effectResult) {
            finalDamage = Number(effectResult.finalDamage) || 0;
          }

          // Check if this was a critical hit
          if (effectResult.isCrit) {
            hadCriticalHit = true;

            // Store critical hit info in gameState for this round
            if (!gameState.roundInfo) gameState.roundInfo = {};
            gameState.roundInfo.lastCriticalHit = {
              item: item.name,
              action: playerAction,
            };
          }
        } else {
          // If not an object, treat as direct damage value
          const numericResult = Number(effectResult) || 0;
          if (!isNaN(numericResult)) {
            finalDamage = numericResult;
          }
        }
      }
    });
  }

  // Ensure the final damage is a number and not NaN
  if (isNaN(finalDamage)) {
    finalDamage = 0;
  }

  // Return the final calculated damage (minimum 0)
  return Math.max(0, finalDamage);
}

function calculateEnemyDamage(playerAction, enemyAction) {
  // Use enemy's individual base damage
  let baseDamage = gameState.enemy.baseDamage;

  // Initialize damage with base damage
  let damage = baseDamage;

  // Determine the outcome of the round from player's perspective
  const result = determineRoundWinner(playerAction, enemyAction);

  // Apply enemy scaling
  damage += (gameState.runProgress - 1) * GAME_CONFIG.enemyScaling.damageIncreasePerBattle;

  // Apply elite bonus damage if applicable
  if (gameState.enemy.type.isElite) {
    damage = Math.floor(damage * 1.2);
  }

  // Apply Berserker damage multiplier if applicable (only when player loses)
  if (
    (gameState.enemy.type.type === "Berserker" || gameState.enemy.type.type === "Elite Berserker") &&
    gameState.enemy.type.getDamageMultiplier &&
    result === "lose" // Only apply when player loses the round
  ) {
    const multiplier = gameState.enemy.type.getDamageMultiplier(gameState);
    damage = Math.floor(damage * multiplier);

    // Log the berserker's damage increase
    const log = document.getElementById("resolution-log");
    if (log) {
      const rageMsg = document.createElement("p");
      rageMsg.className = "enemy-effect";
      rageMsg.textContent = `🔥 ${gameState.enemy.type.type} rage increases damage to ${damage}!`;
      log.appendChild(rageMsg);
    }
  }

  // Apply conditional modifiers from player items
  if (result === "lose") {
    const log = document.getElementById("resolution-log");
    gameState.player.inventory.forEach((item) => {
      if (item.type === "conditionalModifier" && item.condition === "lose") {
        // Check if this item applies to all actions or specifically to the PLAYER'S action
        if (item.appliesTo === "All" || item.appliesTo === playerAction) {
          // Apply effect (pass gameState to all effects)
          damage = item.effect(damage, gameState);

          // Show trigger message
          if (item.triggerMessage && log) {
            const effectElem = document.createElement("p");
            effectElem.className = "item-effect";
            effectElem.textContent = item.triggerMessage(damage);
            log.appendChild(effectElem);
          }
        }
      }
    });
  }

  return !isNaN(damage) ? Number(damage) : 0;
}

// Show treasure chest with item options
function showTreasure() {
  // Call the main item selection function with treasure context
  showItemSelection("treasure");

  // Add treasure-specific image
  const itemSelection = document.getElementById("item-selection");

  // Set data context attribute for styling
  itemSelection.setAttribute("data-context", "treasure");

  // Create and insert the treasure image
  const existingOtherImages = document.querySelectorAll(".rest-site-image, .event-image-container, .shop-image-container");
  existingOtherImages.forEach((img) => img.remove());

  // Create and insert the treasure image
  const imageContainer = document.createElement("div");
  imageContainer.className = "event-image-container";
  imageContainer.setAttribute("data-event", "treasure");

  // Insert the image after the message but before the item options
  const message = document.getElementById("item-selection-message");
  message.insertAdjacentElement("afterend", imageContainer);

  // Add console log for debugging
  console.log("Treasure chest opened");
}

// Add new function for generating roasts
function generateRoast(gameState) {
  // Get player's most used move
  const moves = gameState.playerMoveCounts || { Rock: 0, Paper: 0, Scissors: 0 };
  const mostUsedMove = Object.entries(moves).reduce((a, b) => (a[1] > b[1] ? a : b))[0];

  // Get random player item for roasting
  const items = gameState.player.inventory.map((i) => i.name);
  const randomItem = items.length > 0 ? items[Math.floor(Math.random() * items.length)] : "basic skills";

  const roasts = [
    `Using ${mostUsedMove} again? Your creativity died with Vine.`,
    `${randomItem || "Nothing"} in your inventory? My grandma's grocery list is scarier.`,

    // Gaming skill insults
    "You play like someone who unironically says 'GG EZ' after being carried.",
    "Your strategy has more holes than NFT project roadmaps.",
    "Is your attack plan AI-generated? Because it lacks human intelligence.",
    "You fight like someone who pre-orders AAA games then complains.",

    // Meta insults
    "Your deck composition screams 'I get my builds from TikTok tutorials'.",
    "Using that item? Name one person who asked. I'll wait.",
    "Your moveset is the RPS equivalent of pineapple on pizza.",
    "You're getting styled on harder than Cyberpunk's launch version.",

    // Psychological warfare
    "The only thing you're winning is your family's disappointment race.",
    "You're about as threatening as a 'We need to talk' text.",
    "Your gameplay makes me wish climate change would hurry up.",
    "I'd call you trash but at least trash gets taken out.",

    // Existential dread
    "When you lose this, what's your excuse? 'Wasn't trying' or 'Game's broken'?",
    "Imagine paying full price for this game just to get humiliated.",
    "Your ancestors are watching this and applying for retroactive abortions.",
    "You're the reason some species eat their young.",

    "First time? (Don't answer, we know)",
    "Still here? Your persistence is almost... sad.",
    "This is getting awkward... for you",
    "At this point you're just a glutton for punishment",
    "I'm starting to feel bad... psych! L + ratio",
  ];

  // Insert customizations into roast template
  let usedRoasts = gameState.usedRoasts || [];
  let availableRoasts = roasts.filter((roast) => !usedRoasts.includes(roast));

  if (availableRoasts.length === 0) {
    // If all roasts have been used, reset the used roasts list
    gameState.usedRoasts = [];
    availableRoasts = roasts;
  }

  let roast = availableRoasts[Math.floor(Math.random() * availableRoasts.length)];
  gameState.usedRoasts.push(roast);

  // Just return the roast text - the caller will decide how to display it
  return roast;
}

// After elements are added to DOM, ensure click sounds are attached
function ensureClickSounds() {
  if (window.audioController) {
    window.audioController.attachButtonSounds();
  }
}

// Helper function to get emoji for an action
function getActionEmoji(action) {
  switch (action) {
    case "Rock":
      return "✊";
    case "Paper":
      return "✋";
    case "Scissors":
      return "✌️";
    default:
      return "❓";
  }
}

// Toast notification system
function showToast(message, type = "info", title = "", duration = 5000) {
  const toastContainer = document.getElementById("toast-container");

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;

  // Create toast content
  let icon = "";
  switch (type) {
    case "success":
      icon = "✅";
      break;
    case "error":
      icon = "❌";
      break;
    case "roast":
      icon = "🔥";
      break;
    default:
      icon = "ℹ️";
  }

  let toastContent = "";
  if (title) {
    toastContent += `<div class="toast-title"><span class="toast-icon">${icon}</span>${title}</div>`;
  }
  toastContent += `<p class="toast-message">${message}</p>`;
  toastContent += `<span class="toast-close" onclick="this.parentElement.remove()">✖</span>`;
  toastContent += `<div class="toast-progress"><div class="toast-progress-bar"></div></div>`;

  toast.innerHTML = toastContent;

  // Add to container
  toastContainer.appendChild(toast);

  // Show with animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, duration);

  return toast;
}

// Function to show a roast as a toast notification
function showRoastToast(roastMessage) {
  return showToast(roastMessage, "roast", "💔 Emotional Damage!", 8000);
}

// Global function to handle Roaster insults
window.handleRoasterInsult = function (gameState) {
  // Generate a roast
  const roast = generateRoast(gameState);

  // Show as toast notification with Roaster prefix
  showToast(`${roast}`, "roast", "Emotional Damage!", 8000);

  // Don't add to battle log to keep it cleaner

  // Add debuff with a chance if not already applied
  if (Math.random() < 0.3 && (!gameState.playerDebuffs || !gameState.playerDebuffs.some((d) => d.id === "emotional_damage"))) {
    if (!gameState.playerDebuffs) gameState.playerDebuffs = [];
    gameState.playerDebuffs.push(DEBUFFS.find((d) => d.id === "emotional_damage"));
  }
};

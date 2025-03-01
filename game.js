// Add this near the top with other constants
const emojiMap = {
  Rock: "✊",
  Paper: "✋",
  Scissors: "✌️",
};

// Game state
let gameState = {
  player: {
    hp: GAME_CONFIG.playerStartingHp,
    maxHp: GAME_CONFIG.playerStartingHp,
    inventory: [], // No starting item, will be chosen
    plannedActions: [],
    coins: GAME_CONFIG.currency.startingAmount, // Player's currency
  },
  enemy: {
    hp: 100,
    maxHp: 100,
    actions: [],
    type: "Basic",
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

  // Select enemy type based on node type
  let enemyTypeIndex = 0; // Default to Basic (index 0)
  let enemyType;

  const currentNode = gameState.map[gameState.currentNodeIndex];

  if (currentNode && currentNode.type === NODE_TYPES.ELITE.id) {
    // Select a random elite enemy
    const eliteEnemies = ENEMY_TYPES.filter((enemy) => enemy.isElite);
    enemyType = eliteEnemies[Math.floor(Math.random() * eliteEnemies.length)];
  } else if (gameState.runProgress === gameState.maxBattles || (currentNode && currentNode.isBoss)) {
    enemyTypeIndex = 2; // Boss type (index 2)
    enemyType = ENEMY_TYPES[enemyTypeIndex];
  } else {
    // Regular enemy - either Basic or Mimic
    enemyTypeIndex = Math.random() < 0.5 ? 0 : 1; // 50% chance for each
    enemyType = ENEMY_TYPES[enemyTypeIndex];
  }

  // Calculate scaled HP based on runProgress
  const scaledHp = Math.floor(enemyType.maxHp + (gameState.runProgress - 1) * gameState.enemyScaling.hpIncreasePerBattle);

  gameState.enemy = {
    hp: scaledHp,
    maxHp: scaledHp,
    type: enemyType, // Store the enemy type object
    actions: enemyType.getActions(gameState), // Set actions for the first round
  };

  // Clear all planned actions
  gameState.player.plannedActions = [];

  // Update the UI to reflect the new battle
  updateEnemyDisplay();
  updateUI();

  // Randomly apply a debuff with a certain chance
  if (Math.random() < GAME_CONFIG.debuffChance && !gameState.activeDebuff) {
    const availableDebuffs = DEBUFFS.filter((debuff) => !gameState.player.inventory.some((item) => item.name === "Lucky Charm"));
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

  // Store player's actions for this round (for mimic enemies)
  gameState.playerLastRoundActions = [...playerActions];

  // Store all player actions for elite enemy AI
  if (!gameState.playerAllActions) {
    gameState.playerAllActions = [];
  }
  gameState.playerAllActions = gameState.playerAllActions.concat(playerActions);

  // Clear planned actions for both player and enemy
  gameState.player.plannedActions = [];

  // Apply any round-based debuff effects
  if (gameState.activeDebuff && gameState.activeDebuff.roundEffect) {
    gameState.activeDebuff.roundEffect(gameState);
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
      gameState.playerAllActions.push(playerAction);

      // Create a result element for this comparison
      const resultElem = document.createElement("p");

      // Determine outcome
      let result;
      let damage = 0;
      let playerWins = false;
      let enemyWins = false;

      if (playerAction === enemyAction) {
        result = "Tie!";
        resultElem.className = "tie";
      } else if (
        (playerAction === "Rock" && enemyAction === "Scissors") ||
        (playerAction === "Paper" && enemyAction === "Rock") ||
        (playerAction === "Scissors" && enemyAction === "Paper")
      ) {
        result = "You win!";
        resultElem.className = "player-win";
        playerWins = true;

        // Calculate base damage
        damage = GAME_CONFIG.baseDamage;

        // Apply scaling based on battle number
        damage += (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;

        // Apply any item effects for winning (CONDITIONAL RELIC EFFECTS)
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && item.condition === "win") {
            if (item.appliesTo === playerAction) {
              const effectResult = item.effect(damage, gameState); // Get the result object
              damage = effectResult.finalDamage; // Use finalDamage from result
              if (item.triggerMessage && effectResult.isCrit) {
                // Check effectResult.isCrit before showing message
                const effectElem = document.createElement("p");
                effectElem.className = "item-effect special-relic";
                effectElem.textContent = item.triggerMessage(damage);
                log.appendChild(effectElem);
              }
            } else if (item.appliesTo === "All") {
              // Handle "All" type relics if needed (like Vampire Blade - though it might be better handled elsewhere)
              if (item.effect) {
                damage = item.effect(damage, gameState); // Apply effect even if not action-specific
              }
              if (item.triggerMessage) {
                const effectElem = document.createElement("p");
                effectElem.className = "item-effect special-relic";
                effectElem.textContent = item.triggerMessage(damage);
                log.appendChild(effectElem);
              }
            }
          }
        });

        // Apply any item effects for winning (ACTION MODIFIERS - existing code)
        gameState.player.inventory.forEach((item) => {
          if (item.type === "actionModifier" && item.appliesTo === playerAction) {
            damage = item.effect(damage);

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
            damage = item.effect(damage);
          }
        });

        // Apply the damage to the enemy (existing code)
        gameState.enemy.hp = Math.max(0, gameState.enemy.hp - damage);
        roundDamageToEnemy += damage;

        // Update enemy HP display (existing code)
        updateHP("enemy", gameState.enemy.hp);
      } else {
        result = "Enemy wins!";
        resultElem.className = "enemy-win";
        enemyWins = true;

        // Calculate enemy damage based on round progression
        damage = GAME_CONFIG.baseDamage;

        // Apply scaling based on battle number
        damage += (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;

        // Apply elite bonus damage if applicable
        if (gameState.enemy.type.isElite) {
          damage = Math.floor(damage * 1.2);
        }

        // Apply any defensive item effects
        let originalDamage = damage;
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && item.condition === "lose" && (item.appliesTo === "All" || item.appliesTo === playerAction)) {
            damage = item.effect(damage, gameState);

            // Show trigger message if provided
            if (item.triggerMessage) {
              const effectElem = document.createElement("p");
              effectElem.className = "item-effect";
              effectElem.textContent = item.triggerMessage(originalDamage);
              log.appendChild(effectElem);
            }
          }
        });

        // Check if player has dodge
        if (gameState.player.dodgeNextAttack) {
          damage = 0;
          gameState.player.dodgeNextAttack = false;

          // Show dodge message
          const dodgeMsg = document.createElement("p");
          dodgeMsg.className = "dodge-effect";
          dodgeMsg.textContent = "💨 Attack dodged!";
          log.appendChild(dodgeMsg);
        }

        // Apply the damage to the player
        gameState.player.hp = Math.max(0, gameState.player.hp - damage);
        roundDamageToPlayer += damage;

        // Update player HP display
        updateHP("player", gameState.player.hp);
      }

      // Display the result
      resultElem.innerHTML = `Player: ${emojiMap[playerAction]} vs ${getEnemyName()}: ${emojiMap[enemyAction]} - ${result}`;
      if (damage > 0) {
        resultElem.innerHTML += ` (${damage} damage)`;
      }
      log.appendChild(resultElem);
      log.scrollTop = log.scrollHeight;

      // For Double Trouble elite, process the action twice
      if (isDoubleTrouble && playerWins) {
        // Apply damage a second time
        gameState.enemy.hp = Math.max(0, gameState.enemy.hp - damage);
        roundDamageToEnemy += damage;

        // Log the double effect
        const doubleElem = document.createElement("p");
        doubleElem.className = "elite-effect";
        doubleElem.textContent = `⚡ Double Trouble resolves move twice! Additional ${damage} damage!`;
        log.appendChild(doubleElem);

        // Update enemy HP display
        updateHP("enemy", gameState.enemy.hp);
      } else if (isDoubleTrouble && enemyWins) {
        // Apply damage a second time
        gameState.player.hp = Math.max(0, gameState.player.hp - damage);
        roundDamageToPlayer += damage;

        // Log the double effect
        const doubleElem = document.createElement("p");
        doubleElem.className = "elite-effect";
        doubleElem.textContent = `⚡ Double Trouble resolves move twice! Additional ${damage} damage!`;
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
    // Increment round counter
    gameState.currentRound++;
    document.getElementById("round-number").textContent = gameState.currentRound;

    // Get new actions for the enemy
    gameState.enemy.actions = gameState.enemy.type.getActions(gameState);

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

  document.getElementById(`${entity}-hp`).textContent = newValue;
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
  gameState = {
    player: {
      hp: GAME_CONFIG.playerStartingHp,
      maxHp: GAME_CONFIG.playerStartingHp,
      inventory: [], // Empty inventory, will pick item
      plannedActions: [],
      coins: GAME_CONFIG.currency.startingAmount, // Player's currency
    },
    enemy: { hp: 100, maxHp: 100, actions: [], type: "Basic" },
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
  };

  // Instead of clearing, add a marker for a new game
  const log = document.getElementById("resolution-log");
  if (log) {
    // Only clear if starting a fresh game
    if (log.innerHTML.includes("🏁 Game Over 🏁") || log.innerHTML === "") {
      log.innerHTML = "";
    } else {
      // Add a divider for a new run
      const divider = document.createElement("div");
      divider.className = "battle-log-divider";
      divider.innerHTML = "<p class='new-run-marker'>🔄 New Adventure Started 🔄</p>";
      log.appendChild(divider);
      log.scrollTop = log.scrollHeight;
    }
  }

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

  // Add battle-start class to trigger animations
  document.getElementById("enemy-hp-bar").classList.add("battle-start");
  // Remove class after animation completes
  setTimeout(() => {
    document.getElementById("enemy-hp-bar").classList.remove("battle-start");
  }, 2000);

  // Update the enemy name and description
  const enemyNameElem = document.getElementById("enemy-name");
  const enemyDescElem = document.getElementById("enemy-description");

  enemyNameElem.textContent = `${gameState.enemy.type.type} Enemy`;
  enemyDescElem.textContent = gameState.enemy.type.description;

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

  // Update planned actions display
  updatePlannedActionsDisplay();

  // Update inventory display
  updateInventoryDisplay();

  // Set up debuff display
  setupDebuffDisplay();
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
  // Set the context (start = new game, victory = after winning a battle)
  gameState.itemSelectionContext = context;

  // Hide battle screen and game over screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  // Show item selection screen
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Remove special event attribute if it exists
  itemSelection.removeAttribute("data-event");

  // Determine which pool to use and set appropriate heading
  let itemPool = ITEMS;
  let heading = "";
  let description = "";

  if (context === "start") {
    // At the start, player selects a relic
    itemPool = RELICS;
    heading = "Choose Your Starting Relic";
    description = "Select one powerful relic to begin your adventure:";
  } else if (context === "victory") {
    // After normal battles, player selects a normal item
    itemPool = ITEMS;
    heading = "Choose Your Reward";
    description = "Select one item as your battle reward:";
  }

  // Update heading and description
  document.getElementById("item-selection-heading").textContent = heading;
  document.getElementById("item-selection-message").textContent = description;

  // Get random unique items from the appropriate pool
  const itemOptions = getRandomUniqueItems(3, itemPool);

  // Display items
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  itemOptions.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = "item-option";
    if (context === "start") {
      itemElement.classList.add("relic"); // Add relic class for styling
    }
    itemElement.onclick = () => selectItem(item);

    const nameElement = document.createElement("h3");
    nameElement.textContent = item.name;
    itemElement.appendChild(nameElement);

    const descElement = document.createElement("p");
    descElement.textContent = item.description;
    itemElement.appendChild(descElement);

    // Only add the "Affects:" element for items that have an appliesTo property
    // and are not utility, defensive, or scaling types that affect all moves
    if (item.appliesTo && !["utility", "defensive", "scaling"].includes(item.type)) {
      const appliesToElement = document.createElement("div");
      appliesToElement.className = "item-applies-to";
      appliesToElement.setAttribute("data-applies-to", item.appliesTo);
      appliesToElement.textContent = `Affects: ${item.appliesTo}`;
      itemElement.appendChild(appliesToElement);
    }

    itemOptionsContainer.appendChild(itemElement);
  });
}

// Function to handle item selection
function selectItem(item) {
  // Add the selected item to player's inventory
  gameState.player.inventory.push(item);

  // Apply one-time effects for utility items
  if (item.type === "utility" && item.isOneTimeEffect) {
    const result = item.effect();
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
    connections: [1], // Connect to first encounter node
    visited: true,
  });

  // Create sequential nodes
  let currentId = 1;
  const nodeCount = 10; // Total nodes in the run (excluding start)

  // Create nodes in a horizontal line
  for (let i = 1; i <= nodeCount; i++) {
    // Determine node type based on position
    let nodeType = determineNodeType(i);

    // Elite enemies should only appear from node 3 onwards
    if (nodeType === NODE_TYPES.ELITE.id && i < 3) {
      nodeType = NODE_TYPES.BATTLE.id;
    }

    // Last node is always a boss
    const isBoss = i === nodeCount;
    if (isBoss) {
      nodeType = NODE_TYPES.BATTLE.id;
    }

    // Create node
    map.push({
      id: currentId,
      type: isBoss ? NODE_TYPES.BATTLE.id : nodeType,
      isBoss: isBoss,
      x: (i * 100) / (nodeCount + 1), // Spread horizontally
      y: 50, // All at same vertical level
      connections: i < nodeCount ? [currentId + 1] : [], // Connect to next node if not the last
      visited: false,
    });

    // Add incoming connection
    if (i > 0) {
      if (!map[currentId].incomingConnections) {
        map[currentId].incomingConnections = [];
      }
      map[currentId].incomingConnections.push(currentId - 1);
    }

    currentId++;
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

  // Create a distribution that changes as player progresses
  let battleChance = 0.4 - position * 0.01; // Decrease battle chance slightly as we progress
  let eliteChance = 0.1 + position * 0.02; // Increase elite chance as we progress
  let shopChance = 0.15;
  let restChance = 0.15 + position * 0.01; // Slightly increase rest chance
  let eventChance = 0.2;

  // Normalize probabilities to ensure they sum to 1
  const total = battleChance + eliteChance + shopChance + restChance + eventChance;
  battleChance /= total;
  eliteChance /= total;
  shopChance /= total;
  restChance /= total;
  // eventChance is remainder

  // Determine node type based on random value
  if (random < battleChance) {
    return NODE_TYPES.BATTLE.id;
  } else if (random < battleChance + eliteChance) {
    return NODE_TYPES.ELITE.id;
  } else if (random < battleChance + eliteChance + shopChance) {
    return NODE_TYPES.SHOP.id;
  } else if (random < battleChance + eliteChance + shopChance + restChance) {
    return NODE_TYPES.REST.id;
  } else {
    return NODE_TYPES.EVENT.id;
  }
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

  // Find previous node (if exists)
  let previousNode = null;
  if (currentNode.incomingConnections && currentNode.incomingConnections.length > 0) {
    const previousNodeId = currentNode.incomingConnections[0];
    previousNode = gameState.map.find((node) => node.id === previousNodeId);
  }

  // Find next possible nodes
  const nextNodes = [];
  if (currentNode.connections && currentNode.connections.length > 0) {
    currentNode.connections.forEach((nodeId) => {
      const node = gameState.map.find((n) => n.id === nodeId);
      if (node) {
        nextNodes.push(node);
      }
    });
  }

  // Calculate horizontal positions
  const nodeSpacing = 33; // percentage of container width
  const centerPosition = 50;
  let previousX = centerPosition - nodeSpacing;
  let currentX = centerPosition;

  // Draw paths first
  // Previous to current path (if previous exists)
  if (previousNode) {
    const path = document.createElement("div");
    path.className = "node-path active";

    // Set path properties
    path.style.width = `${nodeSpacing}%`;
    path.style.left = `${previousX}%`;
    path.style.top = `50%`;
    path.style.transform = `rotate(0deg)`; // Horizontal path

    mapContainer.appendChild(path);
  }

  // Current to next paths
  nextNodes.forEach((node, index) => {
    const path = document.createElement("div");
    path.className = "node-path";

    // For multiple next nodes, spread them out
    const nextX = currentX + nodeSpacing;
    const nextY = 50 + (index - (nextNodes.length - 1) / 2) * 20;

    // Calculate angle if not perfectly horizontal
    const angle = nextY !== 50 ? Math.atan2(nextY - 50, nodeSpacing) * (180 / Math.PI) : 0;

    // Set path properties
    path.style.width = `${Math.sqrt(Math.pow(nodeSpacing, 2) + Math.pow(nextY - 50, 2))}%`;
    path.style.left = `${currentX}%`;
    path.style.top = `50%`;
    path.style.transform = `rotate(${angle}deg)`;

    mapContainer.appendChild(path);
  });

  // Draw nodes
  // Draw previous node (if exists)
  if (previousNode) {
    const nodeElem = document.createElement("div");
    nodeElem.className = "map-node";
    nodeElem.setAttribute("data-type", previousNode.type);
    nodeElem.setAttribute("data-id", previousNode.id);
    nodeElem.setAttribute("data-visited", "true");

    if (previousNode.isBoss) {
      nodeElem.setAttribute("data-is-boss", "true");
    }

    // Position the node
    nodeElem.style.left = `${previousX}%`;
    nodeElem.style.top = `50%`;
    nodeElem.style.transform = `translate(-50%, -50%)`;

    // Set node content based on type
    const nodeType = Object.values(NODE_TYPES).find((type) => type.id === previousNode.type);
    nodeElem.textContent = nodeType ? nodeType.icon : "❓";

    // Add tooltip
    if (nodeType) {
      const tooltip = document.createElement("div");
      tooltip.className = "node-tooltip";
      tooltip.innerHTML = `<h4>${nodeType.name}</h4><p>${nodeType.description}</p>`;
      nodeElem.appendChild(tooltip);
    }

    mapContainer.appendChild(nodeElem);
  }

  // Draw current node
  const currentNodeElem = document.createElement("div");
  currentNodeElem.className = "map-node";
  currentNodeElem.setAttribute("data-type", currentNode.type);
  currentNodeElem.setAttribute("data-id", currentNode.id);
  currentNodeElem.setAttribute("data-visited", "true");
  currentNodeElem.setAttribute("data-current", "true");

  if (currentNode.isBoss) {
    currentNodeElem.setAttribute("data-is-boss", "true");
  }

  // Position the node
  currentNodeElem.style.left = `${currentX}%`;
  currentNodeElem.style.top = `50%`;
  currentNodeElem.style.transform = `translate(-50%, -50%)`;

  // Set node content based on type
  const currentNodeType = Object.values(NODE_TYPES).find((type) => type.id === currentNode.type);
  currentNodeElem.textContent = currentNodeType ? currentNodeType.icon : "❓";

  // Add tooltip
  if (currentNodeType) {
    const tooltip = document.createElement("div");
    tooltip.className = "node-tooltip";
    tooltip.innerHTML = `<h4>${currentNodeType.name}</h4><p>${currentNodeType.description}</p>`;
    currentNodeElem.appendChild(tooltip);
  }

  mapContainer.appendChild(currentNodeElem);

  // Draw next nodes
  nextNodes.forEach((node, index) => {
    const nodeElem = document.createElement("div");
    nodeElem.className = "map-node";
    nodeElem.setAttribute("data-type", node.type);
    nodeElem.setAttribute("data-id", node.id);

    if (node.isBoss) {
      nodeElem.setAttribute("data-is-boss", "true");
    }

    // Position the node based on index
    const nextX = currentX + nodeSpacing;
    const nextY = 50 + (index - (nextNodes.length - 1) / 2) * 20;

    nodeElem.style.left = `${nextX}%`;
    nodeElem.style.top = `${nextY}%`;
    nodeElem.style.transform = `translate(-50%, -50%)`;

    // Set node content based on type
    const nodeType = Object.values(NODE_TYPES).find((type) => type.id === node.type);
    nodeElem.textContent = nodeType ? nodeType.icon : "❓";

    // Add tooltip
    if (nodeType) {
      const tooltip = document.createElement("div");
      tooltip.className = "node-tooltip";
      tooltip.innerHTML = `<h4>${nodeType.name}</h4><p>${nodeType.description}</p>`;
      nodeElem.appendChild(tooltip);
    }

    mapContainer.appendChild(nodeElem);

    // Add click handler to next nodes
    if (gameState.availableNodeChoices.find((choice) => choice.id === node.id)) {
      nodeElem.setAttribute("data-available", "true");
      nodeElem.onclick = () => {
        // Clear any existing animations
        document.querySelectorAll('.map-node[data-current="true"]').forEach((n) => n.removeAttribute("data-current"));
        selectNode(node);
      };
    }
  });
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

    default:
      console.error("Unknown node type:", currentNode.type);
      // Fall back to a battle
      document.getElementById("battle-screen").classList.remove("hidden");
      initBattle(false);
  }
}

// Show shop interface
function showShop() {
  // Hide other screens and show item selection
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set shop heading
  document.getElementById("item-selection-heading").textContent = "Shop";
  document.getElementById(
    "item-selection-message"
  ).textContent = `Select an item to purchase with your coins (You have ${gameState.player.coins} coins):`;

  // Get 4 random shop items
  const shopItems = getRandomUniqueItems(4, SHOP_ITEMS);

  // Display shop items
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

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

  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set rest site heading
  document.getElementById("item-selection-heading").textContent = "Rest Site";
  document.getElementById("item-selection-message").textContent = "Choose one option:";

  // Display rest options
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  // Option 1: Heal
  const healElement = document.createElement("div");
  healElement.className = "rest-option";

  const healTitle = document.createElement("h3");
  healTitle.textContent = "Rest and Heal";
  healElement.appendChild(healTitle);

  const healDesc = document.createElement("p");
  const healAmount = GAME_CONFIG.rest.healAmount;
  healDesc.textContent = `Restore ${healAmount} HP`;
  healElement.appendChild(healDesc);

  const currentHp = document.createElement("div");
  currentHp.className = "current-hp";
  currentHp.textContent = `Current HP: ${gameState.player.hp}/${gameState.player.maxHp}`;
  healElement.appendChild(currentHp);

  // Disable heal if at max HP
  if (gameState.player.hp >= gameState.player.maxHp) {
    healElement.classList.add("disabled");
    healElement.onclick = () => {
      healElement.classList.add("shake");
      setTimeout(() => healElement.classList.remove("shake"), 500);
    };
  } else {
    healElement.onclick = () => {
      // Heal player
      const actualHealAmount = Math.min(healAmount, gameState.player.maxHp - gameState.player.hp);
      gameState.player.hp += actualHealAmount;

      // Update HP display
      updateHP("player", gameState.player.hp);

      // Show healing message
      const log = document.createElement("p");
      log.className = "heal-effect special-heal";
      log.textContent = `❤️ You rest and recover ${actualHealAmount} HP!`;
      document.body.appendChild(log);
      setTimeout(() => log.remove(), 3000);

      // Continue to next nodes
      updateAvailableNodes();
      showNodeSelection();
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

// Show upgrade options for items
function showUpgradeOptions(upgradeableItems) {
  // Update rest site heading
  document.getElementById("item-selection-heading").textContent = "Upgrade an Item";
  document.getElementById("item-selection-message").textContent = "Select one item to upgrade:";

  // Display upgradeable items
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  upgradeableItems.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = "item-option";

    const nameElement = document.createElement("h3");
    nameElement.textContent = item.name;
    itemElement.appendChild(nameElement);

    const descElement = document.createElement("p");
    descElement.textContent = item.description;
    itemElement.appendChild(descElement);

    // Add "Upgrade to" description
    const upgradeEffectElement = document.createElement("p");
    upgradeEffectElement.className = "upgrade-effect";

    // Determine the upgraded effect
    if (item.description.includes("damage by")) {
      // Extract the damage number
      const damageMatch = item.description.match(/by (\d+)/);
      if (damageMatch && damageMatch[1]) {
        const currentDamage = parseInt(damageMatch[1]);
        const upgradedDamage = Math.floor(currentDamage * GAME_CONFIG.rest.upgradeEffect);
        upgradeEffectElement.textContent = `Upgrade to: Increases damage by ${upgradedDamage}`;
      }
    } else {
      upgradeEffectElement.textContent = "Upgrade to: 50% more effective";
    }

    itemElement.appendChild(upgradeEffectElement);

    itemElement.onclick = () => upgradeItem(item);

    itemOptionsContainer.appendChild(itemElement);
  });

  // Add back button
  const backElement = document.createElement("div");
  backElement.className = "item-option leave-shop";
  backElement.textContent = "Go Back";
  backElement.onclick = () => showRestSite();

  itemOptionsContainer.appendChild(backElement);
}

// Upgrade an item
function upgradeItem(item) {
  // Create upgraded version of the item
  const originalEffect = item.effect;

  // Upgrade the effect function
  item.effect = (value) => {
    const originalResult = originalEffect(value);
    if (typeof originalResult === "number") {
      return Math.floor(originalResult * GAME_CONFIG.rest.upgradeEffect);
    }
    return originalResult;
  };

  // Mark as upgraded
  item.upgraded = true;

  // Update the description
  if (item.description.includes("damage by")) {
    // Extract the damage number
    const damageMatch = item.description.match(/by (\d+)/);
    if (damageMatch && damageMatch[1]) {
      const currentDamage = parseInt(damageMatch[1]);
      const upgradedDamage = Math.floor(currentDamage * GAME_CONFIG.rest.upgradeEffect);
      item.description = item.description.replace(/by \d+/, `by ${upgradedDamage}`);
    }
  } else {
    item.description += " (Upgraded)";
  }

  // Show upgrade message
  const log = document.createElement("p");
  log.className = "item-effect";
  log.textContent = `🔨 ${item.name} has been upgraded!`;
  document.body.appendChild(log);
  setTimeout(() => log.remove(), 3000);

  // Update inventory display
  updateInventoryDisplay();

  // Continue to next nodes
  updateAvailableNodes();
  showNodeSelection();
}

// Show a random event
function showEvent() {
  // Hide other screens
  document.getElementById("battle-screen").classList.add("hidden");
  document.getElementById("game-over").classList.add("hidden");

  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Set context attribute for event-specific styling
  itemSelection.setAttribute("data-context", "event");

  // Select a random event
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

  // Set event heading
  document.getElementById("item-selection-heading").textContent = event.name;
  document.getElementById("item-selection-message").textContent = event.description;

  // Display event image
  let eventImageId = "event-image";

  // Always remove any existing event image to prevent duplicates or stale images
  let existingEventImage = document.getElementById(eventImageId);
  if (existingEventImage) {
    existingEventImage.remove();
  }

  // Create a fresh event image container
  const eventImage = document.createElement("div");
  eventImage.id = eventImageId;
  eventImage.className = "event-image-container";

  // Insert after the message and before options
  const message = document.getElementById("item-selection-message");
  message.parentNode.insertBefore(eventImage, message.nextSibling);

  // Set event type for image selection
  const eventType = event.name.toLowerCase().replace(/\s+/g, "_");
  eventImage.setAttribute("data-event", eventType);

  // Display event choices
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";
  itemOptionsContainer.className = "event-choices"; // Add class for event styling

  event.choices.forEach((choice) => {
    const choiceElement = document.createElement("div");
    choiceElement.className = "event-choice";
    choiceElement.textContent = choice.text;

    choiceElement.onclick = () => {
      // Apply choice effect
      const resultMessage = choice.effect(gameState);

      // Show result message
      const log = document.createElement("p");
      log.className = "event-effect";
      log.textContent = resultMessage;
      document.body.appendChild(log);

      // Automatically remove the message after a delay
      setTimeout(() => {
        log.style.opacity = "0";
        setTimeout(() => {
          if (log && log.parentNode) {
            log.parentNode.removeChild(log);
          }
        }, 1000); // Wait for fade out animation before removing
      }, 5000); // Show for 5 seconds

      // Add a brief flash effect to the selected choice
      choiceElement.classList.add("selected");

      // Disable all choice buttons after selection
      document.querySelectorAll(".event-choice").forEach((btn) => {
        btn.style.pointerEvents = "none";
        if (btn !== choiceElement) {
          btn.style.opacity = "0.5";
        }
      });

      // Update displays
      updateHP("player", gameState.player.hp);
      updateCurrencyDisplay();
      updateInventoryDisplay();

      // Continue to next nodes after short delay
      setTimeout(() => {
        updateAvailableNodes();
        showNodeSelection();
      }, 2000);
    };

    itemOptionsContainer.appendChild(choiceElement);
  });
}

// Process temporary items at the start of battle
function processTemporaryItems() {
  // Remove expired items
  gameState.temporaryItems = gameState.temporaryItems.filter((item) => item.battlesRemaining > 0);

  // Decrement battle counter for remaining items
  gameState.temporaryItems.forEach((item) => {
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
  // Look for items with postBattleEffect
  gameState.player.inventory.forEach((item) => {
    if (item.type === "postBattleEffect") {
      const effectResult = item.effect(gameState);

      // Display trigger message if there is one
      if (item.triggerMessage && document.getElementById("resolution-log")) {
        const msgElem = document.createElement("p");
        msgElem.className = "item-effect";
        msgElem.textContent = item.triggerMessage(effectResult);
        document.getElementById("resolution-log").appendChild(msgElem);
        document.getElementById("resolution-log").scrollTop = document.getElementById("resolution-log").scrollHeight;
      }
    }
  });

  // Update HP display to reflect any changes
  updateHP("player", gameState.player.hp);
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
    // Check for elite ability
    let description = gameState.enemy.type.description;

    if (gameState.enemy.type.isElite) {
      description += `<br><br><strong>Elite Ability:</strong> ${gameState.enemy.type.eliteAbility}`;
    }

    // Update the description directly
    enemyDescriptionElem.innerHTML = description;
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

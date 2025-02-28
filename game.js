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
};

// Initialize game
function initBattle() {
  gameState.runProgress++;
  gameState.currentRound = 1; // Reset round for each battle

  // Reset the used revival item flag for the new battle
  gameState.usedReviveItem = false;

  // Reset the consumed state for defensive items
  gameState.player.inventory.forEach((item) => {
    if (item.type === "defensive") {
      item.consumed = false;
    }
  });

  // Select enemy type: Boss on final battle, otherwise Basic
  let enemyTypeIndex = 0; // Default to Basic (index 0)

  if (gameState.runProgress === gameState.maxBattles) {
    enemyTypeIndex = 2; // Boss type (index 2)
  }

  const enemyType = ENEMY_TYPES[enemyTypeIndex];

  // Calculate scaled HP based on runProgress
  const scaledHp = enemyType.maxHp + (gameState.runProgress - 1) * gameState.enemyScaling.hpIncreasePerBattle;

  gameState.enemy = {
    hp: scaledHp,
    maxHp: scaledHp,
    type: enemyType, // Store the enemy type object
    actions: enemyType.getActions(gameState), // Set actions for the first round
  };
  gameState.player.plannedActions = [];

  // Reset active debuff from previous battle
  gameState.activeDebuff = null;

  // Explicitly clear the debuff container to ensure it's not displayed
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

  // Random chance to apply a debuff
  if (Math.random() < GAME_CONFIG.debuffChance) {
    // Select a random debuff
    const randomDebuff = DEBUFFS[Math.floor(Math.random() * DEBUFFS.length)];
    gameState.activeDebuff = randomDebuff;

    // Apply the debuff effect
    if (gameState.activeDebuff.applyEffect) {
      gameState.activeDebuff.applyEffect(gameState);
    }

    // Show debuff notification
    showDebuffNotification(randomDebuff);
  }

  updateUI();
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

function resolveRound() {
  const log = document.getElementById("resolution-log");
  log.innerHTML = ""; // Clear the log at the start of a new round
  document.getElementById("resolve-btn").disabled = true;

  // Apply debuff round effects if there's an active debuff
  if (gameState.activeDebuff && gameState.activeDebuff.roundEffect) {
    gameState.activeDebuff.roundEffect(gameState);
  }

  // Apply action replacer effects (like Mirror Amulet)
  applyActionReplacerEffects();

  let delay = 0;
  let battleEnded = false; // Flag to track if battle has ended early

  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      // Skip if battle already ended
      if (battleEnded) return;

      const playerAction = gameState.player.plannedActions[i];
      const enemyAction = gameState.enemy.actions[i];
      let playerDmg = GAME_CONFIG.baseDamage;

      // Calculate scaled enemy damage based on runProgress
      let enemyDmg = gameState.enemyScaling.baseDamage + (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;

      // Reveal enemy action
      const enemyActionElem = document.querySelector(`#enemy-actions div[data-index="${i}"]`);
      enemyActionElem.textContent = emojiMap[enemyAction];
      enemyActionElem.classList.remove("hidden-action");
      enemyActionElem.classList.add("revealed-action");

      // Apply base item effects
      gameState.player.inventory.forEach((item) => {
        if (item.type === "actionModifier" && item.appliesTo === playerAction) {
          playerDmg = item.effect(playerDmg);
        }
      });

      // Determine winner
      let result = "";
      if (playerAction === enemyAction) {
        result = "Tie!";
      } else if (
        (playerAction === "Rock" && enemyAction === "Scissors") ||
        (playerAction === "Scissors" && enemyAction === "Paper") ||
        (playerAction === "Paper" && enemyAction === "Rock")
      ) {
        // Player wins - apply conditional win modifiers
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && (item.appliesTo === playerAction || item.appliesTo === "All") && item.condition === "win") {
            const oldDamage = playerDmg;
            playerDmg = item.effect(playerDmg);

            // Log item effect if damage was modified, but skip lifesteal items for now
            if (playerDmg !== oldDamage && item.triggerMessage && !item.isLifesteal) {
              logItemEffect(item.triggerMessage(playerDmg), item.type);
            }
          }
        });

        // Apply enemy damage first
        gameState.enemy.hp -= playerDmg;

        // Now apply lifesteal effects after all damage calculations are complete
        gameState.player.inventory.forEach((item) => {
          if (item.isLifesteal && (item.appliesTo === playerAction || item.appliesTo === "All") && item.condition === "win") {
            // Calculate lifesteal based on the final damage value
            const lifestealAmount = Math.floor(playerDmg * item.lifestealPercent);

            // Apply healing
            const oldHp = gameState.player.hp;
            gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + lifestealAmount);
            const actualHeal = gameState.player.hp - oldHp;

            // Update UI
            updateHP("player", gameState.player.hp);

            // Log the lifesteal effect
            if (item.triggerMessage) {
              logItemEffect(item.triggerMessage(playerDmg), item.type);
            }
          }
        });

        result = `Player wins! ${getEnemyName()} takes ${playerDmg} damage.`;
        animateHPChange("enemy");
      } else {
        // Enemy wins - apply conditional lose modifiers
        gameState.player.inventory.forEach((item) => {
          if (item.type === "conditionalModifier" && (item.appliesTo === playerAction || item.appliesTo === "All") && item.condition === "lose") {
            const oldDamage = enemyDmg;
            enemyDmg = item.effect(enemyDmg);

            // Log item effect if damage was modified
            if (enemyDmg !== oldDamage && item.triggerMessage) {
              logItemEffect(item.triggerMessage(enemyDmg), item.type);
            }
          }
        });

        gameState.player.hp -= enemyDmg;
        result = `${getEnemyName()} wins! Player takes ${enemyDmg} damage.`;
        animateHPChange("player");
      }

      // Update the HP bars immediately after damage
      updateHP("player", Math.max(0, gameState.player.hp));
      updateHP("enemy", Math.max(0, gameState.enemy.hp));

      let resultClass = "";
      if (result.includes("Player wins")) {
        resultClass = "player-win";
      } else if (result.includes("wins! Player takes")) {
        resultClass = "enemy-win";
      } else {
        resultClass = "tie";
      }

      // Create a new paragraph element for the result - ONLY showing the result line
      const resultElem = document.createElement("p");
      resultElem.className = resultClass;
      resultElem.innerHTML = `Player: ${emojiMap[playerAction]} vs ${getEnemyName()}: ${emojiMap[enemyAction]} - ${result}`;
      log.appendChild(resultElem);

      // Scroll to the bottom of the log
      log.scrollTop = log.scrollHeight;

      // Check if battle should end early
      if (gameState.player.hp <= 0 || gameState.enemy.hp <= 0) {
        if (gameState.player.hp <= 0) {
          // Check for revival items like Phoenix Feather
          const reviveItem = gameState.player.inventory.find((item) => item.type === "defensive" && !item.consumed);

          if (reviveItem && !gameState.usedReviveItem) {
            // Try to use the revival item
            const revived = reviveItem.effect(gameState);

            if (revived) {
              // Mark the item as consumed for this battle
              reviveItem.consumed = true;
              gameState.usedReviveItem = true;

              // Log the revival
              const reviveMsg = document.createElement("p");
              reviveMsg.className = "item-effect revival";
              reviveMsg.textContent = `✨ ${reviveItem.triggerMessage()}`;
              log.appendChild(reviveMsg);
              log.scrollTop = log.scrollHeight;

              // Update HP display
              updateHP("player", gameState.player.hp);

              // Continue with the battle without ending it
              return;
            }
          }

          // Player was defeated (and not revived)
          const defeatMsg = document.createElement("p");
          defeatMsg.className = "enemy-win victory-message";
          defeatMsg.textContent = "You have been defeated!";
          log.appendChild(defeatMsg);
          log.scrollTop = log.scrollHeight;

          battleEnded = true;

          // Add delay to show enemy moves before game over screen
          setTimeout(async () => {
            // Clear enemy moves with animation
            await clearEnemyMovesWithAnimation();
            endGame("You have been defeated!");
          }, 1500);
        } else {
          // Enemy was defeated
          battleEnded = true;

          // Store the player's actions from this round
          gameState.playerLastRoundActions = gameState.player.plannedActions.slice();

          if (gameState.runProgress === gameState.maxBattles) {
            // Award bonus coins for completing all battles
            const bonusCoins = 500;
            gameState.player.coins += bonusCoins;

            const victoryMsg = document.createElement("p");
            victoryMsg.className = "player-win victory-message";
            victoryMsg.textContent = "You completed all 20 levels!";
            log.appendChild(victoryMsg);

            const coinsMsg = document.createElement("p");
            coinsMsg.className = "coin-effect";
            coinsMsg.textContent = `💰 BONUS COINS: +${bonusCoins} (Total: ${gameState.player.coins})`;
            log.appendChild(coinsMsg);

            log.scrollTop = log.scrollHeight;

            // Add delay to show enemy moves before game over screen
            setTimeout(async () => {
              // Clear enemy moves with animation
              await clearEnemyMovesWithAnimation();
              endGame("Congratulations! You completed all 20 levels!");
            }, 1500);
          } else {
            // Normal enemy defeated - show victory message
            const victoryElem = document.createElement("p");
            victoryElem.className = "player-win victory-message";

            // Check if this is a special event battle (every 5th battle)
            if (gameState.runProgress % 5 === 0) {
              victoryElem.innerHTML = "Victory! Special reward available!";
            } else {
              victoryElem.innerHTML = "Victory! Choose your reward item!";
            }

            log.appendChild(victoryElem);

            // Scroll to the bottom of the log
            log.scrollTop = log.scrollHeight;

            // Add delay to show enemy moves before item selection
            setTimeout(async () => {
              // Clear enemy moves with animation
              await clearEnemyMovesWithAnimation();

              // Check if this is a special event battle (every 5th battle)
              if (gameState.runProgress % 5 === 0) {
                showSpecialEvent();
              } else {
                // Regular item selection for normal battles
                showItemSelection("victory");
              }
            }, 2000);
          }
        }
      } else if (i === 4) {
        // This was the last action and nobody died
        setTimeout(async () => {
          // Store the player's actions from this round
          gameState.playerLastRoundActions = gameState.player.plannedActions.slice();

          // Pause to show completed enemy moves for this round
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Clear enemy moves with animation before starting next round
          await clearEnemyMovesWithAnimation();

          // Next round
          gameState.currentRound++;
          gameState.player.plannedActions = []; // Clear player actions
          // Generate new enemy actions for the next round
          gameState.enemy.actions = gameState.enemy.type.getActions(gameState);
          updateUI();
        }, 500);
      }
    }, delay);
    delay += GAME_CONFIG.battleDelay;
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
  };

  // Clear the resolution log when starting a new game
  document.getElementById("resolution-log").innerHTML = "";

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

  // Update progress indicators
  document.getElementById("level-indicator").textContent = gameState.runProgress;
  document.getElementById("progress-fill").style.width = `${(gameState.runProgress / gameState.maxBattles) * 100}%`;

  // Update round number
  document.getElementById("round-number").textContent = gameState.currentRound;

  // Update currency display
  updateCurrencyDisplay();

  // Update run progress text
  const runProgressElem = document.getElementById("run-progress");
  let difficultyIndicator = "";

  // Add difficulty indicator based on run progress
  if (gameState.runProgress > 1) {
    const hpIncrease = (gameState.runProgress - 1) * gameState.enemyScaling.hpIncreasePerBattle;
    const dmgIncrease = (gameState.runProgress - 1) * gameState.enemyScaling.damageIncreasePerBattle;
    difficultyIndicator = ` (HP +${hpIncrease}, DMG +${dmgIncrease})`;

    // Set data attribute for CSS pseudo-element
    runProgressElem.setAttribute("data-difficulty", `+${hpIncrease} HP, +${dmgIncrease} DMG`);
  } else {
    // Clear data attribute for first battle
    runProgressElem.removeAttribute("data-difficulty");
  }

  // Add final boss indicator if on final battle
  const gameContainer = document.getElementById("game-container");
  if (gameState.runProgress === gameState.maxBattles) {
    runProgressElem.textContent = `Final Boss Battle`;
    gameContainer.classList.add("final-boss");
  } else {
    runProgressElem.textContent = `Battle ${gameState.runProgress}`;
    gameContainer.classList.remove("final-boss");
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

const emojiMap = {
  Rock: "✊",
  Paper: "✋",
  Scissors: "✌️",
};

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

// Function to award coins after battle victory
function awardCoins() {
  const min = GAME_CONFIG.currency.minRewardPerBattle;
  const max = GAME_CONFIG.currency.maxRewardPerBattle;
  const coinsAwarded = Math.floor(Math.random() * (max - min + 1)) + min;

  gameState.player.coins += coinsAwarded;

  // Show coins message in log
  const log = document.getElementById("resolution-log");
  const coinsMsg = document.createElement("p");
  coinsMsg.className = "coin-effect";
  coinsMsg.textContent = `💰 Coins: +${coinsAwarded} (Total: ${gameState.player.coins})`;
  log.appendChild(coinsMsg);
  log.scrollTop = log.scrollHeight;

  // Update currency display
  updateCurrencyDisplay();
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
    // Start the first battle
    document.getElementById("battle-screen").classList.remove("hidden");
    initBattle();
  } else {
    // Award coins after victory (before applying other effects)
    awardCoins();

    // Apply post-battle effects (like healing)
    applyPostBattleEffects();

    // Heal the player after battle victory
    const healAmount = 40;
    const oldHp = gameState.player.hp;
    gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
    const actualHealAmount = gameState.player.hp - oldHp;

    // Show healing message in log
    const log = document.getElementById("resolution-log");
    const healMsg = document.createElement("p");
    healMsg.className = "heal-effect";
    healMsg.textContent = `💚 Battle Rest: Recovered ${actualHealAmount} HP!`;
    log.appendChild(healMsg);
    log.scrollTop = log.scrollHeight;

    // Continue to next battle after victory
    document.getElementById("battle-screen").classList.remove("hidden");
    initBattle();
  }
}

// Function to apply post-battle effects from items
function applyPostBattleEffects() {
  const log = document.getElementById("resolution-log");

  // Find and apply all post-battle effect items
  gameState.player.inventory.forEach((item) => {
    if (item.type === "postBattleEffect") {
      const healAmount = item.effect(gameState);

      // Log the effect if it has a message
      if (item.triggerMessage) {
        const effectElem = document.createElement("p");
        effectElem.className = "heal-effect";
        effectElem.textContent = `✨ ${item.triggerMessage(healAmount)}`;
        log.appendChild(effectElem);
        log.scrollTop = log.scrollHeight;
      }

      // Update the HP display
      updateHP("player", gameState.player.hp);
    }

    // Apply scaling items (like Training Manual)
    if (item.type === "scaling" && item.appliesTo === "baseDamage") {
      gameState.enemyScaling.baseDamage = item.effect(gameState.enemyScaling.baseDamage);

      // Log the effect if it has a message
      if (item.triggerMessage) {
        const effectElem = document.createElement("p");
        effectElem.className = "item-effect";
        effectElem.textContent = `✨ ${item.triggerMessage()}`;
        log.appendChild(effectElem);
        log.scrollTop = log.scrollHeight;
      }
    }
  });
}

// Helper function to update inventory display
function updateInventoryDisplay() {
  // Update inventory with descriptions as tooltips
  const inventoryList = document.getElementById("inventory");
  inventoryList.innerHTML = "";

  if (gameState.player.inventory.length === 0) {
    inventoryList.textContent = "None";
  } else {
    // Count occurrences of each item by name
    const itemCounts = {};
    gameState.player.inventory.forEach((item) => {
      if (itemCounts[item.name]) {
        itemCounts[item.name].count++;
      } else {
        itemCounts[item.name] = {
          item: item,
          count: 1,
        };
      }
    });

    // Display each unique item with count
    const uniqueItems = Object.values(itemCounts);
    uniqueItems.forEach((itemData, index) => {
      const item = itemData.item;
      const count = itemData.count;

      const itemElem = document.createElement("span");
      itemElem.className = "inventory-item";
      itemElem.textContent = item.name + (count > 1 ? ` (×${count})` : "");
      itemElem.setAttribute("title", item.description || "");
      itemElem.setAttribute("data-applies-to", item.appliesTo);

      // Add a comma if not the last item
      if (index < uniqueItems.length - 1) {
        itemElem.textContent += ", ";
      }

      inventoryList.appendChild(itemElem);
    });
  }
}

// Helper function to set up debuff display
function setupDebuffDisplay() {
  // Update active debuff display
  const debuffContainer = document.getElementById("debuff-container");
  if (debuffContainer) {
    if (gameState.activeDebuff) {
      // Show debuff container and update its content
      debuffContainer.classList.remove("hidden");
      const debuff = gameState.activeDebuff;
      debuffContainer.innerHTML = `
        <span class="debuff-icon">${debuff.icon}</span>
        <span class="debuff-name">${debuff.name}</span>
        <span class="debuff-description">${debuff.description}</span>
      `;

      // Highlight disabled action buttons if applicable
      if (debuff.effect.type === "ban_action") {
        document.querySelectorAll("#actions button").forEach((button) => {
          if (button.getAttribute("aria-label") === `Select ${debuff.effect.action}`) {
            button.classList.add("disabled-by-debuff");
            button.title = `${debuff.name}: Can't use ${debuff.effect.action}`;
          } else {
            button.classList.remove("disabled-by-debuff");
            button.title = "";
          }
        });
      } else if (debuff.effect.type === "only_allow_action") {
        document.querySelectorAll("#actions button").forEach((button) => {
          if (
            button.getAttribute("aria-label") !== `Select ${debuff.effect.action}` &&
            button.getAttribute("aria-label") &&
            button.getAttribute("aria-label").startsWith("Select")
          ) {
            button.classList.add("disabled-by-debuff");
            button.title = `${debuff.name}: Can only use ${debuff.effect.action}`;
          } else {
            button.classList.remove("disabled-by-debuff");
            button.title = "";
          }
        });
      } else {
        // Reset all button classes if no action restrictions
        document.querySelectorAll("#actions button").forEach((button) => {
          button.classList.remove("disabled-by-debuff");
          button.title = "";
        });
      }
    } else {
      // Hide debuff container when no active debuff
      debuffContainer.classList.add("hidden");
      // Clear the content as well to ensure it doesn't show anything
      debuffContainer.innerHTML = "";
      // Reset all button classes
      document.querySelectorAll("#actions button").forEach((button) => {
        button.classList.remove("disabled-by-debuff");
        button.title = "";
      });
    }
  }
}

// Function to clear enemy moves with animation
function clearEnemyMovesWithAnimation() {
  const enemyMoves = document.querySelectorAll("#enemy-actions div");

  // First, remove any existing animation classes
  enemyMoves.forEach((move) => {
    move.classList.remove("flip-out", "revealed-action");
    // Force a reflow to ensure animations restart properly
    void move.offsetWidth;
  });

  // Then add the flip-out animation class
  enemyMoves.forEach((move) => {
    move.classList.add("flip-out");
  });

  // Return a promise that resolves after the animation completes
  // Add extra time to account for the staggered delays (0.4s for last item + 0.8s animation time + 0.3s buffer)
  return new Promise((resolve) => {
    setTimeout(() => {
      // Reset the enemy move elements to their hidden state after animation
      enemyMoves.forEach((move) => {
        move.classList.remove("flip-out", "revealed-action");
        move.classList.add("hidden-action");
        move.textContent = "?";
      });
      resolve();
    }, 1500);
  });
}

// Add this new function to handle item effect logging
function logItemEffect(message, itemType = null) {
  const log = document.getElementById("resolution-log");
  const effectElem = document.createElement("p");
  effectElem.className = "item-effect";

  // Add specific class based on the message content or item type
  if (itemType) {
    effectElem.classList.add(`${itemType}-effect`);
  } else if (message.includes("Shield")) {
    effectElem.classList.add("shield-effect");
  } else if (message.includes("Thorns")) {
    effectElem.classList.add("thornmail-effect");
  } else if (message.includes("Training")) {
    effectElem.classList.add("training-effect");
  } else if (message.includes("Mirrored")) {
    effectElem.classList.add("mirror-effect");
  }

  effectElem.textContent = `✨ ${message}`;
  log.appendChild(effectElem);
  log.scrollTop = log.scrollHeight;
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
      appliesToElement.textContent = `Affects: ${item.appliesTo}`;
      appliesToElement.setAttribute("data-applies-to", item.appliesTo);
      itemElement.appendChild(appliesToElement);
    }

    itemOptionsContainer.appendChild(itemElement);
  });
}

// Function to show special event choices after every 5th battle
function showSpecialEvent() {
  // Hide battle screen
  document.getElementById("battle-screen").classList.add("hidden");

  // Show item selection screen (we'll repurpose this screen)
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.remove("hidden");

  // Add the special event attribute for CSS styling
  itemSelection.setAttribute("data-event", "special");

  // Update heading and description
  document.getElementById("item-selection-heading").textContent = "Special Event!";
  document.getElementById("item-selection-message").textContent = "Choose one reward:";

  // Set up the two choices in the options container
  const itemOptionsContainer = document.getElementById("item-options");
  itemOptionsContainer.innerHTML = "";

  // Choice 1: Restore 100 HP
  const healChoice = document.createElement("div");
  healChoice.className = "item-option special-event";
  healChoice.onclick = () => selectSpecialReward("heal");

  const healIcon = document.createElement("div");
  healIcon.className = "special-event-icon";
  healIcon.innerHTML = "❤️";

  const healTitle = document.createElement("h3");
  healTitle.textContent = "Restore Health";

  const healDesc = document.createElement("p");
  healDesc.textContent = "Restore 100 HP to your character";

  healChoice.appendChild(healIcon);
  healChoice.appendChild(healTitle);
  healChoice.appendChild(healDesc);

  // Choice 2: Random Relic
  const relicChoice = document.createElement("div");
  relicChoice.className = "item-option special-event relic";
  relicChoice.onclick = () => selectSpecialReward("relic");

  const relicIcon = document.createElement("div");
  relicIcon.className = "special-event-icon";
  relicIcon.innerHTML = "✨";

  const relicTitle = document.createElement("h3");
  relicTitle.textContent = "Random Relic";

  const relicDesc = document.createElement("p");
  relicDesc.textContent = "Receive a random powerful relic";

  relicChoice.appendChild(relicIcon);
  relicChoice.appendChild(relicTitle);
  relicChoice.appendChild(relicDesc);

  // Add both choices to the container
  itemOptionsContainer.appendChild(healChoice);
  itemOptionsContainer.appendChild(relicChoice);
}

// Function to handle special reward selection
function selectSpecialReward(choice) {
  // Hide the item selection screen
  const itemSelection = document.getElementById("item-selection");
  itemSelection.classList.add("hidden");

  // Remove special event attribute
  itemSelection.removeAttribute("data-event");

  // Show the battle screen again
  document.getElementById("battle-screen").classList.remove("hidden");

  // Get the resolution log for messages
  const log = document.getElementById("resolution-log");

  if (choice === "heal") {
    // Heal the player by 100 HP
    const oldHp = gameState.player.hp;
    gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + 100);
    const actualHealAmount = gameState.player.hp - oldHp;

    // Log the healing
    const healMsg = document.createElement("p");
    healMsg.className = "heal-effect special-heal";
    healMsg.textContent = `❤️ Major Restoration: Recovered ${actualHealAmount} HP!`;
    log.appendChild(healMsg);
    log.scrollTop = log.scrollHeight;

    // Update HP display
    updateHP("player", gameState.player.hp);

    // Add a pulsing animation to the player HP bar
    const playerHpBar = document.getElementById("player-hp-bar");
    playerHpBar.classList.add("major-heal");
    setTimeout(() => {
      playerHpBar.classList.remove("major-heal");
    }, 2000);
  } else if (choice === "relic") {
    // Select a random relic
    const availableRelics = [...RELICS];

    // Filter out relics the player already has
    const playerRelicNames = gameState.player.inventory.filter((item) => RELICS.some((relic) => relic.name === item.name)).map((item) => item.name);

    // Remove relics the player already has
    const uniqueRelics = availableRelics.filter((relic) => !playerRelicNames.includes(relic.name));

    // If all relics are collected, just pick any random one
    const relicPool = uniqueRelics.length > 0 ? uniqueRelics : availableRelics;

    // Get a random relic
    const randomRelic = relicPool[Math.floor(Math.random() * relicPool.length)];

    // Add relic to inventory
    gameState.player.inventory.push(randomRelic);

    // Log the relic acquisition
    const relicMsg = document.createElement("p");
    relicMsg.className = "item-effect special-relic";
    relicMsg.textContent = `✨ Obtained Relic: ${randomRelic.name}!`;
    log.appendChild(relicMsg);

    const relicDesc = document.createElement("p");
    relicDesc.className = "item-effect";
    relicDesc.textContent = `✨ ${randomRelic.description}`;
    log.appendChild(relicDesc);

    log.scrollTop = log.scrollHeight;

    // Update inventory display
    updateInventoryDisplay();
  }

  // Continue to next battle
  initBattle();
}

// Function to apply action replacer effects (like Mirror Amulet)
function applyActionReplacerEffects() {
  const actionReplacers = gameState.player.inventory.filter((item) => item.type === "actionReplacer" && item.appliesTo === "All");

  if (actionReplacers.length > 0 && gameState.player.plannedActions.length > 0) {
    actionReplacers.forEach((item) => {
      // Create a copy of player actions before modification for comparison
      const originalActions = [...gameState.player.plannedActions];

      // Apply the action replacer effect
      const newActions = item.effect([...gameState.player.plannedActions], [...gameState.enemy.actions]);

      // Update the player's actions if they were changed
      if (newActions && JSON.stringify(newActions) !== JSON.stringify(originalActions)) {
        gameState.player.plannedActions = newActions;

        // Log the effect
        if (item.triggerMessage) {
          const log = document.getElementById("resolution-log");
          const effectElem = document.createElement("p");
          effectElem.className = "item-effect mirror-effect";
          effectElem.textContent = `✨ ${item.triggerMessage()}`;
          log.appendChild(effectElem);
          log.scrollTop = log.scrollHeight;

          // Add visual cue to the first move that was mirrored
          setTimeout(() => {
            const firstMoveElement = document.querySelector("#planned-actions div:first-child");
            if (firstMoveElement) {
              firstMoveElement.classList.add("mirrored-move");
              // Remove the class after animation completes
              setTimeout(() => {
                firstMoveElement.classList.remove("mirrored-move");
              }, 1500);
            }
          }, 300);
        }

        // Update the UI to show the new actions
        updatePlannedActionsDisplay();
      }
    });
  }
}

// Start game
startNewRun();

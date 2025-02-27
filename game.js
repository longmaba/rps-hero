// Game state
let gameState = {
  player: {
    hp: GAME_CONFIG.playerStartingHp,
    maxHp: GAME_CONFIG.playerStartingHp,
    inventory: [ITEMS[GAME_CONFIG.startingItem]],
    plannedActions: [],
  },
  enemy: {
    hp: 100,
    maxHp: 100,
    actions: [],
    type: "Basic",
  },
  runProgress: 0,
  maxBattles: GAME_CONFIG.maxBattles, // Final boss at battle 3
};

// Initialize game
function initBattle() {
  gameState.runProgress++;
  gameState.currentRound = 1; // Reset round for each battle

  // Always use the Basic enemy type (index 0)
  const enemyType = ENEMY_TYPES[0];

  gameState.enemy = {
    hp: enemyType.maxHp,
    maxHp: enemyType.maxHp,
    type: enemyType, // Store the enemy type object
    actions: enemyType.getActions(gameState), // Set actions for the first round
  };
  gameState.player.plannedActions = [];
  updateUI();
}

function resolveRound() {
  const log = document.getElementById("resolution-log");
  log.innerHTML = ""; // Clear the log at the start of a new round
  document.getElementById("resolve-btn").disabled = true;

  let delay = 0;
  let battleEnded = false; // Flag to track if battle has ended early

  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      // Skip if battle already ended
      if (battleEnded) return;

      const playerAction = gameState.player.plannedActions[i];
      const enemyAction = gameState.enemy.actions[i];
      let playerDmg = GAME_CONFIG.baseDamage;
      let enemyDmg = GAME_CONFIG.baseDamage;

      // Reveal enemy action
      const enemyActionElem = document.querySelector(`#enemy-actions div[data-index="${i}"]`);
      enemyActionElem.textContent = emojiMap[enemyAction];
      enemyActionElem.classList.remove("hidden-action");
      enemyActionElem.classList.add("revealed-action");

      // Apply item effects
      gameState.player.inventory.forEach((item) => {
        if (item.appliesTo === playerAction) playerDmg = item.effect(playerDmg);
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
        gameState.enemy.hp -= playerDmg;
        result = `Player wins! ${getEnemyName()} takes ${playerDmg} damage.`;
        // Add animation class to enemy HP bar
        animateHPChange("enemy");
      } else {
        gameState.player.hp -= enemyDmg;
        result = `${getEnemyName()} wins! Player takes ${enemyDmg} damage.`;
        // Add animation class to player HP bar
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
        battleEnded = true;

        // Store the player's actions from this round
        gameState.playerLastRoundActions = gameState.player.plannedActions.slice();

        setTimeout(() => {
          if (gameState.player.hp <= 0) {
            // Player was defeated
            const defeatMsg = document.createElement("p");
            defeatMsg.className = "enemy-win victory-message";
            defeatMsg.textContent = "You have been defeated!";
            log.appendChild(defeatMsg);
            log.scrollTop = log.scrollHeight;

            // Add delay to show enemy moves before game over screen
            setTimeout(async () => {
              // Clear enemy moves with animation
              await clearEnemyMovesWithAnimation();
              endGame("You have been defeated!");
            }, 1500);
          } else {
            // Enemy was defeated
            if (gameState.runProgress === gameState.maxBattles) {
              const victoryMsg = document.createElement("p");
              victoryMsg.className = "player-win victory-message";
              victoryMsg.textContent = "You completed all 20 levels!";
              log.appendChild(victoryMsg);
              log.scrollTop = log.scrollHeight;

              // Add delay to show enemy moves before game over screen
              setTimeout(async () => {
                // Clear enemy moves with animation
                await clearEnemyMovesWithAnimation();
                endGame("Congratulations! You completed all 20 levels!");
              }, 1500);
            } else {
              // Normal enemy defeated
              const newItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
              gameState.player.inventory.push(newItem);

              // Create a victory message element
              const victoryElem = document.createElement("p");
              victoryElem.className = "player-win victory-message";
              victoryElem.innerHTML = `Victory! Gained item: ${newItem.name}`;
              log.appendChild(victoryElem);

              // Scroll to the bottom of the log
              log.scrollTop = log.scrollHeight;

              // Add delay to show enemy moves before next battle
              setTimeout(async () => {
                // Clear enemy moves with animation
                await clearEnemyMovesWithAnimation();
                initBattle();
              }, 2000);
            }
          }
        }, 800);
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
      inventory: [ITEMS[GAME_CONFIG.startingItem]],
      plannedActions: [],
    },
    enemy: { hp: 100, maxHp: 100, actions: [], type: "Basic" },
    runProgress: 0,
    maxBattles: GAME_CONFIG.maxBattles,
    currentRound: 1,
    playerLastRoundActions: null, // Track the previous round's actions
  };
  document.getElementById("battle-screen").classList.remove("hidden");
  document.getElementById("game-over").classList.add("hidden");
  // Clear the resolution log when starting a new game
  document.getElementById("resolution-log").innerHTML = "";
  // Reset the final battle log container if it exists
  const finalLogContainer = document.getElementById("final-battle-log");
  if (finalLogContainer) {
    finalLogContainer.innerHTML = "";
  }
  initBattle();
}

// Add an action
function addAction(action) {
  if (gameState.player.plannedActions.length < 5) {
    gameState.player.plannedActions.push(action);
    updateUI();
  }
}

// Remove a specific action
function removeAction(index) {
  gameState.player.plannedActions.splice(index, 1);
  updateUI();
}

// Clear all actions
function clearAllActions() {
  gameState.player.plannedActions = [];
  updateUI();
}

const emojiMap = {
  Rock: "✊",
  Paper: "✋",
  Scissors: "✌️",
};

// Update UI with clickable actions
function updateUI() {
  // Update HP text and bars
  updateHP("player", Math.max(0, gameState.player.hp));
  updateHP("enemy", Math.max(0, gameState.enemy.hp));

  // Update enemy name in the UI
  document.getElementById("enemy-name").textContent = getEnemyName();

  // Update enemy description
  const enemyDescription = document.getElementById("enemy-description");
  if (gameState.enemy.type.description) {
    enemyDescription.textContent = gameState.enemy.type.description;
    enemyDescription.classList.remove("hidden");
  } else {
    enemyDescription.classList.add("hidden");
  }

  document.getElementById("run-progress").textContent = `Battle ${gameState.runProgress}`;
  document.getElementById("round-number").textContent = gameState.currentRound;

  // Update progress bar for 20 levels
  const progressPercent = (gameState.runProgress / gameState.maxBattles) * 100;
  document.getElementById("progress-fill").style.width = `${progressPercent}%`;
  document.getElementById("level-indicator").textContent = gameState.runProgress;

  // Update inventory with descriptions as tooltips
  const inventoryList = document.getElementById("inventory");
  inventoryList.innerHTML = "";

  if (gameState.player.inventory.length === 0) {
    inventoryList.textContent = "None";
  } else {
    gameState.player.inventory.forEach((item, index) => {
      const itemElem = document.createElement("span");
      itemElem.textContent = item.name;
      itemElem.className = "inventory-item";
      itemElem.setAttribute("title", item.description || "");
      itemElem.setAttribute("data-applies-to", item.appliesTo);

      // Add a comma if not the last item
      if (index < gameState.player.inventory.length - 1) {
        itemElem.textContent += ", ";
      }

      inventoryList.appendChild(itemElem);
    });
  }

  // Set up enemy action placeholders
  const enemyActionsDiv = document.getElementById("enemy-actions");
  enemyActionsDiv.innerHTML = "";

  // Create hidden placeholders for enemy actions
  for (let i = 0; i < 5; i++) {
    const actionElem = document.createElement("div");
    actionElem.textContent = "?";
    actionElem.classList.add("hidden-action");
    actionElem.setAttribute("data-index", i);
    enemyActionsDiv.appendChild(actionElem);
  }

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
  document.getElementById("resolve-btn").disabled = gameState.player.plannedActions.length !== 5;

  // Update run map
  document.querySelectorAll(".step").forEach((step, index) => {
    step.classList.toggle("current", index + 1 === gameState.runProgress);
  });
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

// Start game
startNewRun();

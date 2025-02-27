// Game state
let gameState = {
  player: {
    hp: 100,
    maxHp: 100,
    inventory: [{ name: "Obsidian Rock", type: "actionModifier", appliesTo: "Rock", effect: (dmg) => dmg + 10 }],
    plannedActions: [],
  },
  enemy: {
    hp: 100,
    maxHp: 100,
    actions: [],
    type: "Basic",
  },
  runProgress: 0,
  maxBattles: 3, // Final boss at battle 3
};

// Item pool
const items = [
  { name: "Obsidian Rock", type: "actionModifier", appliesTo: "Rock", effect: (dmg) => dmg + 10 },
  { name: "Sharp Scissors", type: "actionModifier", appliesTo: "Scissors", effect: (dmg) => dmg + 5 },
  { name: "Thick Paper", type: "actionModifier", appliesTo: "Paper", effect: (dmg) => dmg + 5 },
];

// Enemy types
const enemyTypes = [
  {
    type: "Basic",
    getActions: () =>
      Array(5)
        .fill()
        .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]),
  },
  {
    type: "Mimic",
    getActions: (gameState) =>
      gameState.playerLastRoundActions
        ? [...gameState.playerLastRoundActions] // Copy previous round's actions
        : Array(5)
            .fill()
            .map(() => ["Rock", "Paper", "Scissors"][Math.floor(Math.random() * 3)]), // Random if no previous actions
  },
  {
    type: "Boss",
    getActions: () => ["Rock", "Rock", "Paper", "Paper", "Scissors"],
    maxHp: 150,
  },
];

// Initialize game
function initBattle() {
  gameState.runProgress++;
  gameState.currentRound = 1; // Add this to reset round for each battle
  const isBoss = gameState.runProgress === gameState.maxBattles;
  const enemyType = isBoss ? enemyTypes[2] : enemyTypes[Math.floor(Math.random() * 2)];
  gameState.enemy = {
    hp: isBoss ? enemyType.maxHp : 100,
    maxHp: isBoss ? enemyType.maxHp : 100,
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
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const playerAction = gameState.player.plannedActions[i];
      const enemyAction = gameState.enemy.actions[i];
      let playerDmg = 20;
      let enemyDmg = 20;

      // Create action comparison element for animation
      const actionCompare = document.createElement("div");
      actionCompare.classList.add("battle-compare");
      actionCompare.innerHTML = `<span class="player-action">${emojiMap[playerAction]}</span> VS <span class="enemy-action">${emojiMap[enemyAction]}</span>`;
      log.appendChild(actionCompare);

      // Apply shake animation
      actionCompare.classList.add("battle-shake");

      // Remove the animation class after it completes to allow it to be reapplied
      setTimeout(() => {
        actionCompare.classList.remove("battle-shake");
      }, 500);

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

      // Add result after a small delay to show after the animation
      setTimeout(() => {
        // Create a new paragraph element for the result
        const resultElem = document.createElement("p");
        resultElem.className = resultClass;
        resultElem.innerHTML = `Player: ${emojiMap[playerAction]} vs ${getEnemyName()}: ${emojiMap[enemyAction]} - ${result}`;
        log.appendChild(resultElem);

        // Scroll to the bottom of the log
        log.scrollTop = log.scrollHeight;
      }, 300);

      if (i === 4) {
        setTimeout(() => {
          // Store the player's actions from this round
          gameState.playerLastRoundActions = gameState.player.plannedActions.slice();

          if (gameState.player.hp <= 0) {
            endGame("You have been defeated!");
          } else if (gameState.enemy.hp <= 0) {
            if (gameState.runProgress === gameState.maxBattles) {
              endGame("You defeated the Boss and won the run!");
            } else {
              const newItem = items[Math.floor(Math.random() * items.length)];
              gameState.player.inventory.push(newItem);

              // Create a victory message element
              const victoryElem = document.createElement("p");
              victoryElem.className = "player-win victory-message";
              victoryElem.innerHTML = `Victory! Gained item: ${newItem.name}`;
              log.appendChild(victoryElem);

              // Scroll to the bottom of the log
              log.scrollTop = log.scrollHeight;

              initBattle();
            }
          } else {
            // Next round
            gameState.currentRound++;
            gameState.player.plannedActions = []; // Clear player actions
            // Generate new enemy actions for the next round
            gameState.enemy.actions = gameState.enemy.type.getActions(gameState);
            updateUI();
          }
        }, 500);
      }
    }, delay);
    delay += 1000;
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
    player: { hp: 100, maxHp: 100, inventory: [items[0]], plannedActions: [] },
    enemy: { hp: 100, maxHp: 100, actions: [], type: "Basic" },
    runProgress: 0,
    maxBattles: 3,
    currentRound: 1, // Add this
    playerLastRoundActions: null, // Add this to track the previous round's actions
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

  document.getElementById("run-progress").textContent = `Battle ${gameState.runProgress}`;
  document.getElementById("round-number").textContent = gameState.currentRound;
  document.getElementById("inventory").textContent = gameState.player.inventory.map((i) => i.name).join(", ") || "None";

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

// Start game
startNewRun();

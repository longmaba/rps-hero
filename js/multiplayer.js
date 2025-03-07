/**
 * multiplayer.js
 * Main multiplayer game logic for RPS Roguelike
 */

// Main battle state
let battleState = null;

// Items pool for selection (simplified version from config.js)
const MULTIPLAYER_ITEMS = [
  // Common items
  {
    name: "Rock Enhancer",
    rarity: "common",
    type: "actionModifier",
    appliesTo: "Rock",
    description: "Your Rock attacks deal +2 damage",
    effect: (damage) => damage + 2,
  },
  {
    name: "Paper Enhancer",
    rarity: "common",
    type: "actionModifier",
    appliesTo: "Paper",
    description: "Your Paper attacks deal +2 damage",
    effect: (damage) => damage + 2,
  },
  {
    name: "Scissors Enhancer",
    rarity: "common",
    type: "actionModifier",
    appliesTo: "Scissors",
    description: "Your Scissors attacks deal +2 damage",
    effect: (damage) => damage + 2,
  },
  {
    name: "Small Health Potion",
    rarity: "common",
    type: "consumable",
    appliesTo: "All",
    description: "Restore 15 HP",
    effect: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 15);
      return true;
    },
  },
  // Uncommon items
  {
    name: "Rock Expert",
    rarity: "uncommon",
    type: "actionModifier",
    appliesTo: "Rock",
    description: "Your Rock attacks deal +4 damage",
    effect: (damage) => damage + 4,
  },
  {
    name: "Paper Expert",
    rarity: "uncommon",
    type: "actionModifier",
    appliesTo: "Paper",
    description: "Your Paper attacks deal +4 damage",
    effect: (damage) => damage + 4,
  },
  {
    name: "Scissors Expert",
    rarity: "uncommon",
    type: "actionModifier",
    appliesTo: "Scissors",
    description: "Your Scissors attacks deal +4 damage",
    effect: (damage) => damage + 4,
  },
  {
    name: "Medium Health Potion",
    rarity: "uncommon",
    type: "consumable",
    appliesTo: "All",
    description: "Restore 25 HP",
    effect: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 25);
      return true;
    },
  },
  // Rare items
  {
    name: "Rock Master",
    rarity: "rare",
    type: "actionModifier",
    appliesTo: "Rock",
    description: "Your Rock attacks deal +7 damage",
    effect: (damage) => damage + 7,
  },
  {
    name: "Paper Master",
    rarity: "rare",
    type: "actionModifier",
    appliesTo: "Paper",
    description: "Your Paper attacks deal +7 damage",
    effect: (damage) => damage + 7,
  },
  {
    name: "Scissors Master",
    rarity: "rare",
    type: "actionModifier",
    appliesTo: "Scissors",
    description: "Your Scissors attacks deal +7 damage",
    effect: (damage) => damage + 7,
  },
  {
    name: "Large Health Potion",
    rarity: "rare",
    type: "consumable",
    appliesTo: "All",
    description: "Restore 40 HP",
    effect: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 40);
      return true;
    },
  },
];

// DOM elements
let elements = {};
// Item selection timers
let itemSelectionTimer = null;
let itemTimeRemaining = 10;
// Countdown timer
let countdownTimer = null;

/**
 * Initialize the multiplayer game
 */
function initMultiplayer() {
  // Store DOM elements for later use
  cacheElements();

  // Set up event listeners
  setupEventListeners();

  // Initialize UI
  updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);

  // Show information about Firebase fallback if needed
  if (!useFirebase) {
    const notificationDiv = document.createElement("div");
    notificationDiv.className = "firebase-notification";
    notificationDiv.innerHTML =
      "<p>⚠️ Firebase database connection not available. Using direct peer connections instead. " +
      "Make sure you share the exact room code with your opponent.</p>";

    const connectionPanel = document.getElementById("connection-panel");
    connectionPanel.insertBefore(notificationDiv, connectionPanel.firstChild);
  }
}

/**
 * Cache DOM elements for quick access
 */
function cacheElements() {
  elements = {
    // Connection UI
    connectionPanel: document.getElementById("connection-panel"),
    createRoomSection: document.getElementById("create-room"),
    joinRoomSection: document.getElementById("join-room"),
    roomCodeDisplay: document.getElementById("room-code-display"),
    roomCode: document.getElementById("room-code"),
    roomCodeInput: document.getElementById("room-code-input"),
    createRoomBtn: document.getElementById("generate-room-btn"),
    joinRoomBtn: document.getElementById("join-battle-btn"),
    copyRoomCodeBtn: document.getElementById("copy-room-code"),
    connectionStatus: document.getElementById("connection-status"),
    statusMessage: document.getElementById("status-message"),
    waitingMessage: document.getElementById("connection-waiting"),

    // Battle UI
    multiplayerBattle: document.getElementById("multiplayer-battle"),
    playerName: document.getElementById("player-name"),
    opponentName: document.getElementById("opponent-name"),
    playerHP: document.getElementById("player-hp"),
    opponentHP: document.getElementById("opponent-hp"),
    playerHPBar: document.getElementById("player-hp-bar"),
    opponentHPBar: document.getElementById("opponent-hp-bar"),

    // Round info
    roundNumber: document.getElementById("round-number"),
    inventory: document.getElementById("inventory"),

    // Action buttons
    rockBtn: document.getElementById("rock-btn"),
    paperBtn: document.getElementById("paper-btn"),
    scissorsBtn: document.getElementById("scissors-btn"),
    clearBtn: document.getElementById("clear-btn"),
    lockBtn: document.getElementById("lock-btn"),
    unlockBtn: document.getElementById("unlock-btn"),
    actions: document.getElementById("actions"),

    // Planned actions
    plannedActions: document.getElementById("planned-actions"),
    opponentActions: document.getElementById("opponent-actions"),

    // Countdown
    countdownDisplay: document.getElementById("countdown-display"),
    countdown: document.getElementById("countdown"),

    // Battle log
    battleLog: document.getElementById("battle-log"),
    clearLogBtn: document.getElementById("clear-log-btn"),

    // Item selection
    itemSelection: document.getElementById("item-selection"),
    itemTimer: document.getElementById("item-timer"),
    itemOptions: document.getElementById("item-options"),
    itemSelectionMessage: document.getElementById("item-selection-message"),

    // Game over
    gameOver: document.getElementById("game-over"),
    gameOverMessage: document.getElementById("game-over-message"),
    rematchBtn: document.getElementById("rematch-btn"),
    returnLobbyBtn: document.getElementById("return-lobby-btn"),
  };

  // Initialize unlock button as hidden
  elements.unlockBtn.classList.add("hidden");
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Room creation and joining
  elements.createRoomBtn.addEventListener("click", createRoom);
  elements.joinRoomBtn.addEventListener("click", joinRoom);
  elements.copyRoomCodeBtn.addEventListener("click", copyRoomCode);

  // Battle controls
  elements.rockBtn.addEventListener("click", () => addAction("Rock"));
  elements.paperBtn.addEventListener("click", () => addAction("Paper"));
  elements.scissorsBtn.addEventListener("click", () => addAction("Scissors"));
  elements.clearBtn.addEventListener("click", clearAllActions);
  elements.lockBtn.addEventListener("click", lockMoves);
  elements.unlockBtn.addEventListener("click", unlockMoves);

  // Log controls
  elements.clearLogBtn.addEventListener("click", clearBattleLog);

  // Game over controls
  elements.rematchBtn.addEventListener("click", requestRematch);
  elements.returnLobbyBtn.addEventListener("click", returnToLobby);

  // Peer communication events
  document.addEventListener("peer-connected", handlePeerConnected);
  document.addEventListener("peer-data", (e) => handleIncomingData(e.detail));
  document.addEventListener("peer-disconnected", handlePeerDisconnected);
}

/**
 * Creates a new room
 */
function createRoom() {
  // Initialize as host
  initializeAsHost();

  // Show waiting message
  elements.waitingMessage.classList.remove("hidden");

  // Update connection status
  updateConnectionStatus(CONNECTION_STATUS.WAITING);
}

/**
 * Joins a room using the input code
 */
function joinRoom() {
  const code = elements.roomCodeInput.value.trim().toUpperCase();

  if (!code || code.length !== ROOM_CODE_LENGTH) {
    alert("Please enter a valid room code");
    return;
  }

  // Update connection status
  updateConnectionStatus(CONNECTION_STATUS.CONNECTING);

  // Initialize as guest
  initializeAsGuest(code);
}

/**
 * Handles when a peer connection is established
 */
function handlePeerConnected() {
  console.log("Peer connected!");

  // Hide connection panel and show battle UI
  elements.connectionPanel.classList.add("hidden");
  elements.multiplayerBattle.classList.remove("hidden");
  // Initialize battle
  initBattle();
}

/**
 * Handles incoming data from the peer
 * @param {Object} data - The data received
 */
function handleIncomingData(data) {
  console.log("Received data:", data);

  if (!data || !data.type) return;

  switch (data.type) {
    case "state-update":
      handleStateUpdate(data.changes);
      break;

    case "move-selection":
      handleMoveSelection(data.moves, data.peerId);
      break;

    case "move-lock":
      handleMoveLock(data.locked, data.peerId);
      break;

    case "move-unlock":
      handleMoveUnlock(data.peerId);
      break;

    case "item-selected":
      handleItemSelection(data.item, data.peerId);
      break;

    case "rematch-request":
      handleRematchRequest();
      break;

    case "rematch-accept":
      handleRematchAccept();
      break;

    case "return-to-lobby":
      handleReturnToLobby();
      break;

    case "chat-message":
      // Optional: handle chat messages
      break;

    case "item-used":
      handleItemUsed(data);
      break;
  }
}

/**
 * Handles a peer disconnection
 */
function handlePeerDisconnected() {
  alert("Your opponent has disconnected. Returning to lobby.");
  returnToLobby();
}

/**
 * Initializes a new battle
 */
function initBattle() {
  // Reset battle state
  battleState = {
    round: 1,
    phase: BATTLE_PHASE.MOVE_SELECTION,

    // Player data
    player1HP: 100,
    player1MaxHP: 100,
    player1Moves: [],
    player1Locked: false,
    player1Inventory: [],
    player1Modifiers: [],
    player1BaseDamage: 10,

    // Enemy data
    player2HP: 100,
    player2MaxHP: 100,
    player2Moves: [],
    player2Locked: false,
    player2Inventory: [],
    player2Modifiers: [],
    player2BaseDamage: 10,

    // Game state
    countdown: null,
    winner: null,
    itemSelection: null,
  };

  // Hide connection panel
  elements.connectionPanel.classList.add("hidden");

  // Show battle UI
  elements.multiplayerBattle.classList.remove("hidden");
  elements.gameOver.classList.add("hidden");

  // Set player names
  elements.playerName.textContent = isHost ? "Player 1 (You)" : "Player 2 (You)";
  elements.opponentName.textContent = isHost ? "Player 2" : "Player 1";

  // Clear battle log
  clearBattleLog();

  // Update UI
  updateBattleUI();
  updateActionButtons();
  updatePlannedActions();
  updateOpponentActions();
}

/**
 * Updates the UI based on current battle state
 */
function updateBattleUI() {
  // Set player data based on if we're host or guest
  const isPlayerOne = isHost;

  // Update HP values and bars
  if (isPlayerOne) {
    elements.playerHP.textContent = battleState.player1HP;
    elements.playerHPBar.style.width = `${(battleState.player1HP / battleState.player1MaxHP) * 100}%`;
    elements.opponentHP.textContent = battleState.player2HP;
    elements.opponentHPBar.style.width = `${(battleState.player2HP / battleState.player2MaxHP) * 100}%`;
  } else {
    elements.playerHP.textContent = battleState.player2HP;
    elements.playerHPBar.style.width = `${(battleState.player2HP / battleState.player2MaxHP) * 100}%`;
    elements.opponentHP.textContent = battleState.player1HP;
    elements.opponentHPBar.style.width = `${(battleState.player1HP / battleState.player1MaxHP) * 100}%`;
  }

  // Update round number
  elements.roundNumber.textContent = battleState.round;

  // Update inventory display
  updateInventoryDisplay();

  // Update action buttons based on phase
  updateActionButtons();
}

/**
 * Updates the inventory display
 */
function updateInventoryDisplay() {
  const inventory = isHost ? battleState.player1Inventory : battleState.player2Inventory;

  if (inventory.length === 0) {
    elements.inventory.textContent = "None";
    return;
  }

  // Clear inventory container first
  elements.inventory.innerHTML = "";

  // Create a usable item display for each item
  inventory.forEach((item, index) => {
    const itemSpan = document.createElement("span");
    itemSpan.className = "inventory-item";
    itemSpan.dataset.appliesTo = item.appliesTo;
    itemSpan.textContent = item.name;
    itemSpan.title = item.description;

    // If it's a consumable, make it clickable
    if (item.type === "consumable") {
      itemSpan.classList.add("consumable");
      itemSpan.addEventListener("click", () => useInventoryItem(index));
    }

    // Add a comma separator if not the last item
    if (index < inventory.length - 1) {
      itemSpan.textContent += ", ";
    }

    elements.inventory.appendChild(itemSpan);
  });
}

/**
 * Uses an inventory item
 * @param {number} index - The index of the item in the inventory
 */
function useInventoryItem(index) {
  // Can only use items during move selection phase
  if (battleState.phase !== BATTLE_PHASE.MOVE_SELECTION) {
    addBattleLog("Can't use items now - wait for your turn!");
    return;
  }

  // Get the player's inventory
  const inventory = isHost ? battleState.player1Inventory : battleState.player2Inventory;

  // Check if the index is valid
  if (index < 0 || index >= inventory.length) {
    console.error("Invalid inventory index:", index);
    return;
  }

  const item = inventory[index];

  // Only consumable items can be used directly
  if (item.type !== "consumable") {
    addBattleLog(`${item.name} is used automatically during battle.`);
    return;
  }

  // Create a temporary player object that matches what the effect function expects
  const playerObj = {
    hp: isHost ? battleState.player1HP : battleState.player2HP,
    maxHp: isHost ? battleState.player1MaxHP : battleState.player2MaxHP,
  };

  // Apply the effect
  const effectResult = item.effect(playerObj);

  // Update the battle state with the new HP
  if (isHost) {
    battleState.player1HP = playerObj.hp;
  } else {
    battleState.player2HP = playerObj.hp;
  }

  // Remove the item from inventory
  if (isHost) {
    battleState.player1Inventory.splice(index, 1);
  } else {
    battleState.player2Inventory.splice(index, 1);
  }

  // Update UI
  updateBattleUI();

  // Log the use
  addBattleLog(`You used ${item.name}!`);

  // Inform the opponent
  sendToPeer({
    type: "item-used",
    itemName: item.name,
    newHP: playerObj.hp,
    peerId: myPeerId,
  });
}

/**
 * Updates action buttons based on current phase
 */
function updateActionButtons() {
  const phase = battleState.phase;
  const playerLocked = isHost ? battleState.player1Locked : battleState.player2Locked;

  // Hide/show elements based on phase
  elements.countdownDisplay.classList.toggle("hidden", phase !== BATTLE_PHASE.COUNTDOWN);
  elements.itemSelection.classList.toggle("hidden", phase !== BATTLE_PHASE.ITEM_SELECTION);

  // Toggle the visibility of the game over screen
  if (!elements.gameOver.classList.contains("hidden") && battleState.winner !== null) {
    elements.gameOver.classList.remove("hidden");
  }

  // Disable/enable action buttons
  const disableActions = phase !== BATTLE_PHASE.MOVE_SELECTION || playerLocked;
  elements.rockBtn.disabled = disableActions;
  elements.paperBtn.disabled = disableActions;
  elements.scissorsBtn.disabled = disableActions;
  elements.clearBtn.disabled = disableActions;

  // Update the lock button state
  if (playerLocked) {
    // If locked, show as "Unlock"
    elements.lockBtn.innerHTML = "🔓 Unlock";
    elements.lockBtn.classList.add("unlock-btn");

    // Disable unlock button if:
    // 1. During countdown phase with <= 3 seconds left
    // 2. During battle resolution phase
    // 3. When battle has ended

    if (
      (phase === BATTLE_PHASE.COUNTDOWN && battleState.countdown <= 3) ||
      phase === BATTLE_PHASE.RESOLUTION ||
      phase === BATTLE_PHASE.ITEM_SELECTION ||
      battleState.winner !== null
    ) {
      elements.lockBtn.disabled = true;
    } else {
      // Only allow unlocking during move selection phase
      elements.lockBtn.disabled = phase !== BATTLE_PHASE.MOVE_SELECTION;
    }
  } else {
    // If unlocked, show as "Lock In"
    elements.lockBtn.innerHTML = "🔒 Lock In";
    elements.lockBtn.classList.remove("unlock-btn");

    // Lock button should only be enabled during move selection phase and if player has moves
    elements.lockBtn.disabled =
      phase !== BATTLE_PHASE.MOVE_SELECTION || (isHost ? battleState.player1Moves.length === 0 : battleState.player2Moves.length === 0);
  }
}

/**
 * Adds a move to the player's planned actions
 * @param {string} action - The action to add (Rock, Paper, Scissors)
 */
function addAction(action) {
  if (!SharedBattle.isValidMove(action)) {
    console.error("Invalid move:", action);
    return;
  }

  // Check if already at max moves (5)
  const currentMoves = isHost ? battleState.player1Moves : battleState.player2Moves;
  if (currentMoves.length >= 5) {
    console.log("Maximum of 5 moves allowed");
    return;
  }

  // Add move to local state
  if (isHost) {
    battleState.player1Moves.push(action);
  } else {
    battleState.player2Moves.push(action);
  }

  // Update UI
  updatePlannedActions();

  // Try to send update to peer, handle failure gracefully
  const sendSuccess = sendToPeer({
    type: "move-selection",
    moves: isHost ? battleState.player1Moves : battleState.player2Moves,
    peerId: myPeerId,
  });

  // If failed to send, show notification
  if (!sendSuccess) {
    // Show temporary notification
    const notification = document.createElement("div");
    notification.className = "connection-notification";
    notification.innerHTML =
      "<p>⚠️ Connection issue: Your move was saved locally but may not have been sent to your opponent. Waiting for connection...</p>";

    // Add to battle area temporarily
    elements.battleArea.insertAdjacentElement("afterbegin", notification);

    // Remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Enable lock button
  elements.lockBtn.disabled = false;
}

/**
 * Updates the planned actions display
 */
function updatePlannedActions() {
  const moves = isHost ? battleState.player1Moves : battleState.player2Moves;

  // Clear current display
  elements.plannedActions.innerHTML = "";

  // Create 5 empty slots
  for (let i = 0; i < 5; i++) {
    const moveDiv = document.createElement("div");

    // If we have a move for this slot, fill it
    if (i < moves.length) {
      moveDiv.textContent = ACTION_EMOJI[moves[i]];
      moveDiv.title = moves[i];
      moveDiv.dataset.action = moves[i];
      moveDiv.dataset.index = i;
      moveDiv.addEventListener("click", () => removeAction(i));
    } else {
      // Empty slot
      moveDiv.classList.add("empty-slot");
    }

    elements.plannedActions.appendChild(moveDiv);
  }
}

/**
 * Removes an action from the player's planned actions
 * @param {number} index - The index of the action to remove
 */
function removeAction(index) {
  // Can't remove actions if locked
  if ((isHost && battleState.player1Locked) || (!isHost && battleState.player2Locked)) {
    return;
  }

  // Remove from local state
  if (isHost) {
    battleState.player1Moves.splice(index, 1);
  } else {
    battleState.player2Moves.splice(index, 1);
  }

  // Update UI
  updatePlannedActions();

  // Send update to peer
  sendToPeer({
    type: "move-selection",
    moves: isHost ? battleState.player1Moves : battleState.player2Moves,
    peerId: myPeerId,
  });

  // Disable lock button if no moves
  if ((isHost && battleState.player1Moves.length === 0) || (!isHost && battleState.player2Moves.length === 0)) {
    elements.lockBtn.disabled = true;
  }
}

/**
 * Clears all actions
 */
function clearAllActions() {
  // Can't clear if locked
  if ((isHost && battleState.player1Locked) || (!isHost && battleState.player2Locked)) {
    return;
  }

  // Clear local state
  if (isHost) {
    battleState.player1Moves = [];
  } else {
    battleState.player2Moves = [];
  }

  // Update UI
  updatePlannedActions();

  // Send update to peer
  sendToPeer({
    type: "move-selection",
    moves: [],
    peerId: myPeerId,
  });

  // Disable lock button
  elements.lockBtn.disabled = true;
}

/**
 * Locks in the player's moves
 */
function lockMoves() {
  // Get the current lock state
  const isLocked = isHost ? battleState.player1Locked : battleState.player2Locked;

  // If already locked, unlock instead
  if (isLocked) {
    unlockMoves();
    return;
  }

  // Set local lock state
  if (isHost) {
    battleState.player1Locked = true;
  } else {
    battleState.player2Locked = true;
  }

  // Send lock signal to peer
  sendToPeer({
    type: "move-lock",
    locked: true,
    peerId: myPeerId,
    timestamp: Date.now(), // Add timestamp for deduplication
  });

  // Disable move buttons
  elements.rockBtn.disabled = true;
  elements.paperBtn.disabled = true;
  elements.scissorsBtn.disabled = true;
  elements.clearBtn.disabled = true;

  // Change lockBtn to "Unlock"
  elements.lockBtn.innerHTML = "🔓 Unlock";
  elements.lockBtn.classList.add("unlock-btn");

  // Check if both players are locked
  checkBothPlayersLocked();
}

/**
 * Unlocks the player's moves
 */
function unlockMoves() {
  // Only allow unlocking if countdown has more than 3 seconds left
  if (battleState.phase === BATTLE_PHASE.COUNTDOWN && battleState.countdown <= 3) {
    alert("Cannot unlock when less than 3 seconds remain!");
    return;
  }

  // Only allowed during countdown phase or move selection phase
  if (battleState.phase !== BATTLE_PHASE.COUNTDOWN && battleState.phase !== BATTLE_PHASE.MOVE_SELECTION) {
    return;
  }

  // Set local unlock state
  if (isHost) {
    battleState.player1Locked = false;
  } else {
    battleState.player2Locked = false;
  }

  // Send unlock signal to peer
  sendToPeer({
    type: "move-unlock",
    peerId: myPeerId,
    timestamp: Date.now(), // Add timestamp for deduplication
  });

  // Enable move buttons
  elements.rockBtn.disabled = false;
  elements.paperBtn.disabled = false;
  elements.scissorsBtn.disabled = false;
  elements.clearBtn.disabled = false;

  // Change button back to "Lock In"
  elements.lockBtn.innerHTML = "🔒 Lock In";
  elements.lockBtn.classList.remove("unlock-btn");
  elements.lockBtn.disabled = isHost ? battleState.player1Moves.length === 0 : battleState.player2Moves.length === 0;

  // If in countdown phase, return to move selection and stop the countdown
  if (battleState.phase === BATTLE_PHASE.COUNTDOWN) {
    // Stop the countdown timer
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    battleState.phase = BATTLE_PHASE.MOVE_SELECTION;
    battleState.countdown = null;

    // Update UI
    updateActionButtons();
    elements.countdownDisplay.classList.add("hidden");

    // Add battle log message
    addBattleLog("You unlocked your moves. Returning to move selection.");
  }
}

/**
 * Checks if both players have locked in their moves
 */
function checkBothPlayersLocked() {
  if (battleState.player1Locked && battleState.player2Locked) {
    // Start countdown
    startCountdown();
  }
}

/**
 * Starts the countdown before round resolution
 */
function startCountdown() {
  // Clear any existing countdown timer
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  // Set phase to countdown
  battleState.phase = BATTLE_PHASE.COUNTDOWN;
  battleState.countdown = 5;

  // Show countdown display with info about unlock limit
  elements.countdownDisplay.classList.remove("hidden");
  elements.countdown.textContent = battleState.countdown;

  // Update unlock button text in countdown display to show the 3-second limit
  elements.unlockBtn.innerHTML = "🔓 Unlock (until 3s left)";

  // Also update the action unlock button if it exists
  const unlockActionBtn = document.getElementById("unlock-action-btn");
  if (unlockActionBtn) {
    unlockActionBtn.innerHTML = "🔓 Unlock (until 3s left)";
  }

  // Start countdown timer
  countdownTimer = setInterval(() => {
    battleState.countdown--;
    elements.countdown.textContent = battleState.countdown;

    // Disable unlock buttons when 3 seconds or less remain
    if (battleState.countdown <= 3) {
      elements.unlockBtn.disabled = true;
      if (unlockActionBtn) {
        unlockActionBtn.disabled = true;
      }

      // Update all action buttons state when we reach 3 seconds or less
      updateActionButtons();
    }

    // When countdown reaches 0, resolve the round
    if (battleState.countdown <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      resolveRound();
    }
  }, 1000);
}

/**
 * Resolves the current round
 */
function resolveRound() {
  // Set phase to resolution
  battleState.phase = BATTLE_PHASE.RESOLUTION;

  // Hide countdown display and unlock buttons
  elements.countdownDisplay.classList.add("hidden");
  elements.unlockBtn.classList.add("hidden");
  const unlockActionBtn = document.getElementById("unlock-action-btn");
  if (unlockActionBtn) {
    unlockActionBtn.classList.add("hidden");
  }

  // Disable all action buttons including lock/unlock during resolution
  elements.rockBtn.disabled = true;
  elements.paperBtn.disabled = true;
  elements.scissorsBtn.disabled = true;
  elements.clearBtn.disabled = true;
  elements.lockBtn.disabled = true;

  // Update all UI elements to reflect the new state
  updateActionButtons();

  // // Debug log for modifiers
  // console.log("Current modifiers state:");
  // console.log("Player 1 modifiers:", battleState.player1Modifiers);
  // console.log("Player 2 modifiers:", battleState.player2Modifiers);

  // Get moves from both players
  const player1Moves = [...battleState.player1Moves];
  const player2Moves = [...battleState.player2Moves];

  // Show opponent's moves (replace hidden markers with actual moves)
  revealOpponentMoves();

  // Add a delay before resolving to allow players to see the moves
  setTimeout(() => {
    // Get current battle state
    const currentState = {
      player1HP: battleState.player1HP,
      player2HP: battleState.player2HP,
      player1BaseDamage: battleState.player1BaseDamage,
      player2BaseDamage: battleState.player2BaseDamage,
      player1Modifiers: battleState.player1Modifiers,
      player2Modifiers: battleState.player2Modifiers,
    };

    // // Debug log for currentState
    // console.log("Current battle state:", currentState);
    // console.log("Player 1 modifiers count:", currentState.player1Modifiers.length);
    // console.log("Player 2 modifiers count:", currentState.player2Modifiers.length);

    // Highlight and compare moves one by one with a delay
    compareMovesSequentially(player1Moves, player2Moves, currentState);
  }, 1500); // Add 1.5 second delay to show move comparison
}

/**
 * Compares moves one by one with appropriate delays
 * @param {Array} player1Moves - Array of player 1's moves
 * @param {Array} player2Moves - Array of player 2's moves
 * @param {Object} currentState - Current battle state
 */
function compareMovesSequentially(player1Moves, player2Moves, currentState) {
  // Keep track of total hp changes for both players
  let totalResults = {
    player1RemainingHP: currentState.player1HP,
    player2RemainingHP: currentState.player2HP,
    logs: [],
  };

  // Determine how many comparisons we'll do (max of player1Moves and player2Moves lengths)
  const maxMoves = Math.max(player1Moves.length, player2Moves.length);

  // We'll compare one set of moves at a time
  let currentIndex = 0;

  // Debug log to show what modifiers are available
  // console.log("Before compare - Player 1 modifiers:", currentState.player1Modifiers);
  // console.log("Before compare - Player 2 modifiers:", currentState.player2Modifiers);

  // Function to compare the next set of moves
  function compareNextMoves() {
    if (currentIndex >= maxMoves) {
      // All moves compared, finish up
      finishRoundResolution(totalResults);
      return;
    }

    // Get the current moves to compare (might be undefined if one player has fewer moves)
    const move1 = player1Moves[currentIndex] || null;
    const move2 = player2Moves[currentIndex] || null;

    // Highlight the current moves being compared
    highlightMoves(currentIndex);

    // If either move is null, we don't compare and just move on
    if (move1 === null || move2 === null) {
      addBattleLog(`${currentIndex + 1}: ${move1 || "No move"} vs ${move2 || "No move"} - No comparison`);

      // Move to the next comparison after a delay
      currentIndex++;
      setTimeout(compareNextMoves, 1000);
      return;
    }

    // Make sure the modifiers are properly passed
    const battleStateForComparison = {
      player1HP: totalResults.player1RemainingHP,
      player2HP: totalResults.player2RemainingHP,
      player1BaseDamage: currentState.player1BaseDamage,
      player2BaseDamage: currentState.player2BaseDamage,
      player1Modifiers: Array.isArray(currentState.player1Modifiers) ? [...currentState.player1Modifiers] : [],
      player2Modifiers: Array.isArray(currentState.player2Modifiers) ? [...currentState.player2Modifiers] : [],
    };

    // // Debug log battle state we're passing
    // console.log(`Comparing move ${currentIndex + 1}: ${move1} vs ${move2}`);
    // console.log(`Player 1 modifiers count: ${battleStateForComparison.player1Modifiers.length}`);
    // console.log(`Player 2 modifiers count: ${battleStateForComparison.player2Modifiers.length}`);

    // Compare these two moves
    const result = SharedBattle.compareOneMoveSet(move1, move2, battleStateForComparison);

    // Update the total results
    totalResults.player1RemainingHP = result.player1RemainingHP;
    totalResults.player2RemainingHP = result.player2RemainingHP;
    totalResults.logs = totalResults.logs.concat(result.logs);

    // Log this comparison's results
    result.logs.forEach((log) => {
      addBattleLog(log);
    });

    // Update UI to show current HP
    updateHPDisplay(totalResults.player1RemainingHP, totalResults.player2RemainingHP);

    // Move to the next comparison after a delay
    currentIndex++;
    setTimeout(compareNextMoves, 1500);
  }

  // Start comparing moves
  compareNextMoves();
}

/**
 * Updates HP display during sequential move resolution
 * @param {number} player1HP - Player 1's current HP
 * @param {number} player2HP - Player 2's current HP
 */
function updateHPDisplay(player1HP, player2HP) {
  // Update HP text
  elements.playerHP.textContent = isHost ? player1HP : player2HP;
  elements.opponentHP.textContent = isHost ? player2HP : player1HP;

  // Update HP bars
  const player1Percent = (player1HP / battleState.player1MaxHP) * 100;
  const player2Percent = (player2HP / battleState.player2MaxHP) * 100;

  elements.playerHPBar.style.width = isHost ? `${player1Percent}%` : `${player2Percent}%`;
  elements.opponentHPBar.style.width = isHost ? `${player2Percent}%` : `${player1Percent}%`;
}

/**
 * Highlights the moves being compared
 * @param {number} index - Index of the moves being compared
 */
function highlightMoves(index) {
  // Remove any existing highlights
  document.querySelectorAll(".current-comparison").forEach((el) => {
    el.classList.remove("current-comparison");
  });

  // Get all move divs
  const playerMoves = elements.plannedActions.querySelectorAll("div");
  const opponentMoves = elements.opponentActions.querySelectorAll("div");

  // Add highlight to current moves if they exist
  if (index < playerMoves.length) {
    playerMoves[index].classList.add("current-comparison");
  }

  if (index < opponentMoves.length) {
    opponentMoves[index].classList.add("current-comparison");
  }

  // Add audio feedback if available
  if (typeof playSound === "function") {
    try {
      playSound("comparison");
    } catch (e) {
      // Ignore if sound doesn't exist or can't be played
      console.log("Sound effect not available");
    }
  }
}

/**
 * Finishes the round resolution
 * @param {Object} results - The final results of the round
 */
function finishRoundResolution(results) {
  // Update battle state with final results
  battleState.player1HP = results.player1RemainingHP;
  battleState.player2HP = results.player2RemainingHP;

  // Update UI
  updateBattleUI();

  // Add round summary
  addBattleLog("--- Round Complete ---");

  // Reset moves and locks
  battleState.player1Moves = [];
  battleState.player2Moves = [];
  battleState.player1Locked = false;
  battleState.player2Locked = false;

  // Clear planned actions display
  updatePlannedActions();
  updateOpponentActions();

  // Check for win/loss
  if (battleState.player1HP <= 0 || battleState.player2HP <= 0) {
    handleBattleEnd();
    return;
  }

  // Show item selection after a delay
  setTimeout(() => {
    // Increment round number
    battleState.round++;

    // Update UI
    elements.roundNumber.textContent = battleState.round;

    // Show item selection
    showItemSelection();
  }, 2000);
}

/**
 * Reveals the opponent's actual moves
 */
function revealOpponentMoves() {
  const opponentMoves = isHost ? battleState.player2Moves : battleState.player1Moves;

  // Clear current display
  elements.opponentActions.innerHTML = "";

  // Add each move with its actual value
  opponentMoves.forEach((move) => {
    const moveDiv = document.createElement("div");
    moveDiv.className = "opponent-move";
    moveDiv.textContent = ACTION_EMOJI[move];
    moveDiv.title = move;

    elements.opponentActions.appendChild(moveDiv);
  });
}

/**
 * Adds a message to the battle log
 * @param {string} message - The message to add
 */
function addBattleLog(message) {
  const logEntry = document.createElement("p");
  logEntry.innerHTML = message;
  elements.battleLog.appendChild(logEntry);
  elements.battleLog.scrollTop = elements.battleLog.scrollHeight;
}

/**
 * Clears the battle log
 */
function clearBattleLog() {
  elements.battleLog.innerHTML = "";
}

/**
 * Shows the item selection UI
 */
function showItemSelection() {
  // Set phase to item selection
  battleState.phase = BATTLE_PHASE.ITEM_SELECTION;

  // Generate random items (3 for each player)
  const player1Items = SharedBattle.getRandomItems(3, MULTIPLAYER_ITEMS);
  const player2Items = SharedBattle.getRandomItems(3, MULTIPLAYER_ITEMS);

  // Store in state
  battleState.itemSelection = {
    player1Options: player1Items,
    player2Options: player2Items,
    player1Selected: null,
    player2Selected: null,
    timeRemaining: 10,
  };

  // Show item selection UI
  elements.itemSelection.classList.remove("hidden");
  elements.itemTimer.textContent = 10;

  // Clear previous options
  elements.itemOptions.innerHTML = "";

  // Display items for the current player
  const playerItems = isHost ? player1Items : player2Items;

  playerItems.forEach((item, index) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = `item-option ${item.rarity}`;
    itemDiv.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="item-applies-to" data-applies-to="${item.appliesTo}">
        ${item.appliesTo === "All" ? "All moves" : `${item.appliesTo} only`}
      </div>
    `;
    itemDiv.addEventListener("click", () => selectItem(item));

    elements.itemOptions.appendChild(itemDiv);
  });

  // Start timer
  itemTimeRemaining = 10;
  itemSelectionTimer = setInterval(() => {
    itemTimeRemaining--;
    elements.itemTimer.textContent = itemTimeRemaining;

    // When timer reaches 0, select random item
    if (itemTimeRemaining <= 0) {
      clearInterval(itemSelectionTimer);

      // Check if itemSelection still exists
      if (!battleState || !battleState.itemSelection) {
        console.error("Item selection state is null or undefined");
        return;
      }

      // Select random item if none selected
      const needsRandomSelection = (isHost && !battleState.itemSelection.player1Selected) || (!isHost && !battleState.itemSelection.player2Selected);

      if (needsRandomSelection) {
        const randomItem = playerItems[Math.floor(Math.random() * playerItems.length)];
        selectItem(randomItem);
      }
    }
  }, 1000);
}

/**
 * Selects an item from the item selection
 * @param {Object} item - The selected item
 */
function selectItem(item) {
  // Stop timer
  clearInterval(itemSelectionTimer);

  // Check if itemSelection exists
  if (!battleState || !battleState.itemSelection) {
    console.error("Item selection state is null or undefined in selectItem");
    return;
  }

  // Create a serializable copy of the item without function properties
  const itemCopy = {
    name: item.name,
    rarity: item.rarity,
    type: item.type,
    appliesTo: item.appliesTo,
    description: item.description,
    // Note: we don't copy the 'effect' function as it can't be serialized
  };

  // Store selection (with original item that has the effect function)
  if (isHost) {
    battleState.itemSelection.player1Selected = item;
    battleState.player1Inventory.push({ ...item });
  } else {
    battleState.itemSelection.player2Selected = item;
    battleState.player2Inventory.push({ ...item });
  }

  // Send selection to peer (without the function property)
  try {
    sendToPeer({
      type: "item-selected",
      item: itemCopy, // Send the copy without function
      peerId: myPeerId,
      timestamp: Date.now(), // Add timestamp for deduplication
    });
  } catch (error) {
    console.error("Error sending data:", error);
  }

  // Hide item selection
  elements.itemSelection.classList.add("hidden");

  // Update inventory display
  updateInventoryDisplay();

  // Add to modifiers if applicable
  if (item.type === "actionModifier") {
    if (isHost) {
      console.log(`Adding modifier ${item.name} to player1Modifiers with effect function: ${typeof item.effect}`);
      battleState.player1Modifiers.push({ ...item });
    } else {
      console.log(`Adding modifier ${item.name} to player2Modifiers with effect function: ${typeof item.effect}`);
      battleState.player2Modifiers.push({ ...item });
    }
  }

  // Check if both players have selected items
  checkBothPlayersSelectedItems();
}

/**
 * Handles when an opponent selects an item
 * @param {Object} item - The selected item
 * @param {string} peerId - The peer ID of the selector
 */
function handleItemSelection(item, peerId) {
  // Debug log to track when this function is called
  console.log(`handleItemSelection called with item=${item.name}, peerId=${peerId}`);

  // Check if itemSelection exists
  if (!battleState || !battleState.itemSelection) {
    console.error("Item selection state is null or undefined in handleItemSelection");

    // If battle state exists, recreate itemSelection
    if (battleState) {
      console.log("Recreating item selection state");
      battleState.itemSelection = {
        player1Options: [],
        player2Options: [],
        player1Selected: null,
        player2Selected: null,
        timeRemaining: 0,
      };
    } else {
      return; // Can't continue if battle state doesn't exist
    }
  }

  // Find the full item from our items list to get the effect function
  const fullItem = MULTIPLAYER_ITEMS.find((i) => i.name === item.name && i.rarity === item.rarity);

  if (!fullItem) {
    console.error("Could not find matching item:", item);
    return;
  }

  // Debug log to check if effect function exists
  console.log(`Found matching item: ${fullItem.name}, has effect function: ${!!fullItem.effect}`);

  // Create a deep copy to ensure the effect function is not lost during serialization
  const itemWithEffect = { ...fullItem };

  // Check if this item was already added (prevent duplicates)
  if (isHost) {
    // Check if the player already has this item in their modifiers
    const existingModifier = battleState.player2Modifiers.find((mod) => mod.name === itemWithEffect.name && mod.rarity === itemWithEffect.rarity);

    // Only update if the item isn't already in modifiers
    if (!existingModifier) {
      battleState.itemSelection.player2Selected = itemWithEffect;
      battleState.player2Inventory.push(itemWithEffect);

      // Add to modifiers if applicable
      if (itemWithEffect.type === "actionModifier") {
        console.log(`Adding ${itemWithEffect.name} to player2Modifiers (effect function: ${typeof itemWithEffect.effect})`);
        battleState.player2Modifiers.push(itemWithEffect);
      }
    } else {
      console.log(`Item ${itemWithEffect.name} already exists in player2Modifiers, not adding duplicate`);
    }
  } else {
    // Check if the player already has this item in their modifiers
    const existingModifier = battleState.player1Modifiers.find((mod) => mod.name === itemWithEffect.name && mod.rarity === itemWithEffect.rarity);

    // Only update if the item isn't already in modifiers
    if (!existingModifier) {
      battleState.itemSelection.player1Selected = itemWithEffect;
      battleState.player1Inventory.push(itemWithEffect);

      // Add to modifiers if applicable
      if (itemWithEffect.type === "actionModifier") {
        console.log(`Adding ${itemWithEffect.name} to player1Modifiers (effect function: ${typeof itemWithEffect.effect})`);
        battleState.player1Modifiers.push(itemWithEffect);
      }
    } else {
      console.log(`Item ${itemWithEffect.name} already exists in player1Modifiers, not adding duplicate`);
    }
  }

  // Update inventory display
  updateInventoryDisplay();

  // Check if both players have selected items
  checkBothPlayersSelectedItems();
}

/**
 * Checks if both players have selected items
 */
function checkBothPlayersSelectedItems() {
  // Check if itemSelection exists
  if (!battleState || !battleState.itemSelection) {
    console.error("Item selection state is null or undefined in checkBothPlayersSelectedItems");
    return;
  }

  // We need both selections to proceed
  const player1Selected = battleState.itemSelection.player1Selected;
  const player2Selected = battleState.itemSelection.player2Selected;

  if (player1Selected && player2Selected) {
    // Both players have selected items, return to move selection
    battleState.phase = BATTLE_PHASE.MOVE_SELECTION;
    updateActionButtons();

    // // Add selection to battle log
    // addBattleLog(`Player 1 selected: ${player1Selected.name}`);
    // addBattleLog(`Player 2 selected: ${player2Selected.name}`);

    // Reset item selection state after a delay to ensure all processing is complete
    // This ensures no race conditions when accessing itemSelection
    setTimeout(() => {
      // Only reset if the battle is still in move selection phase
      if (battleState && battleState.phase === BATTLE_PHASE.MOVE_SELECTION) {
        battleState.itemSelection = null;
      }
    }, 1000); // Longer delay to ensure all operations complete
  }
}

/**
 * Handles the end of a battle
 */
function handleBattleEnd() {
  // Set phase to game over
  battleState.phase = BATTLE_PHASE.GAME_OVER;

  // Determine winner
  let winMessage = "";
  if (battleState.player1HP <= 0 && battleState.player2HP <= 0) {
    battleState.winner = "tie";
    winMessage = "It's a tie! Both players were defeated.";
  } else if (battleState.player1HP <= 0) {
    battleState.winner = "player2";
    winMessage = isHost ? "You lost! Your opponent wins." : "You win! Your opponent was defeated.";
  } else {
    battleState.winner = "player1";
    winMessage = isHost ? "You win! Your opponent was defeated." : "You lost! Your opponent wins.";
  }

  // Log the result
  addBattleLog("--- BATTLE ENDED ---");
  addBattleLog(winMessage);

  // Wait a moment before showing game over screen
  setTimeout(() => {
    // Update game over message
    elements.gameOverMessage.textContent = winMessage;

    // Show game over screen
    elements.gameOver.classList.remove("hidden");
  }, 2000);
}

/**
 * Sends a rematch request to the opponent
 */
function requestRematch() {
  // Disable button to prevent multiple requests
  elements.rematchBtn.disabled = true;
  elements.rematchBtn.textContent = "Waiting for opponent...";

  // Send rematch request to peer
  sendToPeer({
    type: "rematch-request",
    peerId: myPeerId,
  });
}

/**
 * Handles a rematch request from opponent
 */
function handleRematchRequest() {
  // Show rematch notification
  elements.gameOverMessage.textContent = "Your opponent wants a rematch! Accept?";

  // Change rematch button text
  elements.rematchBtn.textContent = "Accept Rematch";

  // Enable button if it was disabled
  elements.rematchBtn.disabled = false;

  // Change button function to accept rematch
  elements.rematchBtn.onclick = function () {
    handleRematchAccept();

    // Send acceptance to peer
    sendToPeer({
      type: "rematch-accept",
      peerId: myPeerId,
    });
  };
}

/**
 * Handles acceptance of a rematch
 */
function handleRematchAccept() {
  // Reset for new battle
  resetForNewBattle();
}

/**
 * Resets for a new battle
 */
function resetForNewBattle() {
  // Hide game over
  elements.gameOver.classList.add("hidden");
  // Initialize new battle
  initBattle();
}

/**
 * Returns to the lobby
 */
function returnToLobby() {
  // Send return to lobby message to peer
  sendToPeer({
    type: "return-to-lobby",
  });

  // Return to lobby
  returnToLobbyUI();
}

/**
 * Handles a return to lobby request
 */
function handleReturnToLobby() {
  // Return to lobby
  returnToLobbyUI();
}

/**
 * Updates the UI to return to lobby
 */
function returnToLobbyUI() {
  // Hide battle UI
  elements.multiplayerBattle.classList.add("hidden");
  elements.gameOver.classList.add("hidden");
  elements.itemSelection.classList.add("hidden");
  elements.countdownDisplay.classList.add("hidden");

  // Remove the unlock action button if it exists
  const unlockActionBtn = document.getElementById("unlock-action-btn");
  if (unlockActionBtn) {
    unlockActionBtn.remove();
  }

  // Show connection panel
  elements.connectionPanel.classList.remove("hidden");

  // Reset UI elements
  updateConnectionStatus(CONNECTION_STATUS.CONNECTED);
  clearBattleLog();
}

/**
 * Handles move selection from the opponent
 * @param {Array} moves - The opponent's moves
 * @param {string} peerId - The peer ID of the selector
 */
function handleMoveSelection(moves, peerId) {
  // Update battle state with opponent's moves
  if (isHost) {
    battleState.player2Moves = moves;
  } else {
    battleState.player1Moves = moves;
  }

  // Update opponent's actions display
  updateOpponentActions();
}

/**
 * Updates the opponent's actions display
 */
function updateOpponentActions() {
  const moves = isHost ? battleState.player2Moves : battleState.player1Moves;

  // Clear current display
  elements.opponentActions.innerHTML = "";

  // Create 5 empty slots
  for (let i = 0; i < 5; i++) {
    const moveDiv = document.createElement("div");

    // If opponent has a move for this slot, show hidden marker
    if (i < moves.length) {
      moveDiv.className = "hidden-action";
      moveDiv.textContent = "?";
    } else {
      // Empty slot
      moveDiv.classList.add("empty-slot");
    }

    elements.opponentActions.appendChild(moveDiv);
  }
}

/**
 * Handles move lock from the opponent
 * @param {boolean} locked - Whether the opponent locked their moves
 * @param {string} peerId - The peer ID of the locker
 */
function handleMoveLock(locked, peerId) {
  // Debug log to track when this function is called
  console.log(`handleMoveLock called with locked=${locked}, peerId=${peerId}`);

  // Track the previous lock state
  const wasAlreadyLocked = isHost ? battleState.player2Locked : battleState.player1Locked;

  // Update battle state with opponent's lock
  if (isHost) {
    battleState.player2Locked = locked;
  } else {
    battleState.player1Locked = locked;
  }

  // Only add log message if this is a new lock (not already locked)
  if (!wasAlreadyLocked && locked) {
    addBattleLog("Opponent locked in their moves.");
  }

  // Update UI to reflect new state
  updateActionButtons();

  // Check if both players are locked
  checkBothPlayersLocked();
}

/**
 * Handles move unlock from the opponent
 * @param {string} peerId - The peer ID of the unlocker
 */
function handleMoveUnlock(peerId) {
  // Update battle state with opponent's unlock
  if (isHost) {
    battleState.player2Locked = false;
  } else {
    battleState.player1Locked = false;
  }

  // If in countdown phase, return to move selection
  if (battleState.phase === BATTLE_PHASE.COUNTDOWN) {
    // Stop the countdown timer
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    battleState.phase = BATTLE_PHASE.MOVE_SELECTION;
    battleState.countdown = null;

    // Update UI
    updateActionButtons();
    elements.countdownDisplay.classList.add("hidden");
    addBattleLog("Opponent unlocked their moves. Returning to move selection.");
  } else {
    addBattleLog("Opponent unlocked their moves.");
  }

  // Re-enable unlock buttons if they were disabled
  elements.unlockBtn.disabled = false;
  const unlockActionBtn = document.getElementById("unlock-action-btn");
  if (unlockActionBtn) {
    unlockActionBtn.disabled = false;
  }
}

/**
 * Handles a state update from the peer
 * @param {Object} changes - The state changes
 */
function handleStateUpdate(changes) {
  // Merge changes into battle state
  battleState = { ...battleState, ...changes };

  // Update UI
  updateBattleUI();
}

/**
 * Copies the room code to the clipboard
 */
function copyRoomCode() {
  const roomCode = elements.roomCode.textContent;

  if (!roomCode) {
    return; // No room code to copy
  }

  // Use the Clipboard API if available
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(roomCode)
      .then(() => {
        // Visual feedback
        elements.copyRoomCodeBtn.textContent = "✓";
        elements.copyRoomCodeBtn.classList.add("success");

        // Reset after a moment
        setTimeout(() => {
          elements.copyRoomCodeBtn.textContent = "📋";
          elements.copyRoomCodeBtn.classList.remove("success");
        }, 1500);
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        alert("Failed to copy room code. Please copy it manually.");
      });
  } else {
    // Fallback for browsers without clipboard API
    const textarea = document.createElement("textarea");
    textarea.value = roomCode;
    textarea.style.position = "fixed"; // Avoid scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        // Visual feedback
        elements.copyRoomCodeBtn.textContent = "✓";
        elements.copyRoomCodeBtn.classList.add("success");

        // Reset after a moment
        setTimeout(() => {
          elements.copyRoomCodeBtn.textContent = "📋";
          elements.copyRoomCodeBtn.classList.remove("success");
        }, 1500);
      } else {
        alert("Failed to copy room code. Please copy it manually.");
      }
    } catch (err) {
      console.error("Could not copy text: ", err);
      alert("Failed to copy room code. Please copy it manually.");
    }

    document.body.removeChild(textarea);
  }
}

/**
 * Handles an opponent using an item
 * @param {Object} data - The item use data
 */
function handleItemUsed(data) {
  // Update the opponent's HP
  if (isHost) {
    battleState.player2HP = data.newHP;
  } else {
    battleState.player1HP = data.newHP;
  }

  // Update UI
  updateBattleUI();

  // Log the use
  addBattleLog(`Opponent used ${data.itemName}!`);
}

// Initialize the multiplayer when the page loads
document.addEventListener("DOMContentLoaded", initMultiplayer);

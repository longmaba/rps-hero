/**
 * shared-battle.js
 * Extracted battle logic from game.js to be shared between single player and multiplayer modes
 */

// Action emoji mapping
const ACTION_EMOJI = {
  Rock: "✊",
  Paper: "✋",
  Scissors: "✌️",
};

// Game states
const BATTLE_PHASE = {
  MOVE_SELECTION: "move-selection",
  COUNTDOWN: "countdown",
  RESOLUTION: "resolution",
  ITEM_SELECTION: "item-selection",
};

/**
 * Core battle logic shared between single and multiplayer modes
 */
class SharedBattle {
  /**
   * Determines the winner of a single move comparison
   * @param {string} action1 - The first player's action (Rock, Paper, or Scissors)
   * @param {string} action2 - The second player's action (Rock, Paper, or Scissors)
   * @returns {string} - "win", "lose", or "tie" from the perspective of action1
   */
  static determineWinner(action1, action2) {
    if (action1 === action2) {
      return "tie";
    } else if (
      (action1 === "Rock" && action2 === "Scissors") ||
      (action1 === "Paper" && action2 === "Rock") ||
      (action1 === "Scissors" && action2 === "Paper")
    ) {
      return "win";
    } else {
      return "lose";
    }
  }

  /**
   * Compares a single set of moves and updates the battle state accordingly
   * @param {string} move1 - Player 1's move
   * @param {string} move2 - Player 2's move
   * @param {Object} battleState - Current battle state
   * @returns {Object} - Result of the move comparison
   */
  static compareOneMoveSet(move1, move2, battleState) {
    const result = {
      player1RemainingHP: battleState.player1HP,
      player2RemainingHP: battleState.player2HP,
      logs: [],
    };

    // Get the outcome of the comparison
    const outcome = this.determineWinner(move1, move2);

    // Create log entry
    const logEntry = `Player 1 ${ACTION_EMOJI[move1]} vs Player 2 ${ACTION_EMOJI[move2]} - `;

    if (outcome === "tie") {
      result.logs.push(logEntry + "Tie!");
      return result;
    }

    // Calculate damage based on the outcome
    if (outcome === "win") {
      // Player 1 wins, player 2 takes damage
      const damage = this.calculateDamage(move1, move2, battleState.player1BaseDamage, battleState.player1Modifiers);

      result.player2RemainingHP = Math.max(0, battleState.player2HP - damage);
      result.logs.push(logEntry + `Player 1 wins! (${damage} damage to Player 2)`);
    } else {
      // Player 2 wins, player 1 takes damage
      const damage = this.calculateDamage(move2, move1, battleState.player2BaseDamage, battleState.player2Modifiers);

      result.player1RemainingHP = Math.max(0, battleState.player1HP - damage);
      result.logs.push(logEntry + `Player 2 wins! (${damage} damage to Player 1)`);
    }

    return result;
  }

  /**
   * Calculates damage for a move comparison
   * @param {string} action1 - The first player's action
   * @param {string} action2 - The second player's action
   * @param {number} baseDamage - The base damage amount
   * @param {Array} modifiers - Array of modifiers to apply
   * @returns {number} - The calculated damage
   */
  static calculateDamage(action1, action2, baseDamage, modifiers = []) {
    const result = this.determineWinner(action1, action2);

    // If it's a tie, no damage
    if (result === "tie") {
      return 0;
    }

    // If it's a loss, no damage (from this player's perspective)
    if (result === "lose") {
      return 0;
    }

    // Start with base damage
    let finalDamage = baseDamage;

    console.log(`Calculating damage for ${action1} vs ${action2}. Base damage: ${baseDamage}`);
    console.log(`Number of modifiers: ${modifiers ? modifiers.length : 0}`);

    // Apply modifiers
    if (modifiers && modifiers.length > 0) {
      modifiers.forEach((modifier) => {
        // Check if modifier applies to this action
        if (modifier.appliesTo === action1 || modifier.appliesTo === "All") {
          console.log(`Applying modifier ${modifier.name} (applies to ${modifier.appliesTo})`);

          if (typeof modifier.effect === "function") {
            const oldDamage = finalDamage;
            finalDamage = modifier.effect(finalDamage);
            console.log(`  Damage modified from ${oldDamage} to ${finalDamage}`);
          } else {
            console.error(`Missing effect function for ${modifier.name}`);
          }
        }
      });
    }

    // Ensure damage is not NaN and at least 0
    return Math.max(0, isNaN(finalDamage) ? 0 : finalDamage);
  }

  /**
   * Validates if a move is valid
   * @param {string} move - The move to validate
   * @returns {boolean} - Whether the move is valid
   */
  static isValidMove(move) {
    return ["Rock", "Paper", "Scissors"].includes(move);
  }

  /**
   * Resolves a full round of battle
   * @param {Array} player1Moves - Array of player 1's moves
   * @param {Array} player2Moves - Array of player 2's moves
   * @param {Object} battleState - Current battle state
   * @returns {Object} - Updated battle state with results
   */
  static resolveRound(player1Moves, player2Moves, battleState) {
    const results = {
      moves: [],
      player1Damage: 0,
      player2Damage: 0,
      player1RemainingHP: battleState.player1HP,
      player2RemainingHP: battleState.player2HP,
      logs: [],
    };

    // Calculate the number of comparisons to make
    const maxMoves = Math.max(player1Moves.length, player2Moves.length);

    for (let i = 0; i < maxMoves; i++) {
      // Get moves for this comparison, defaulting to null if no move exists
      const move1 = i < player1Moves.length ? player1Moves[i] : null;
      const move2 = i < player2Moves.length ? player2Moves[i] : null;

      // Skip if either move is missing
      if (!move1 || !move2) {
        results.moves.push({
          player1: move1,
          player2: move2,
          result: "invalid",
          player1Damage: 0,
          player2Damage: 0,
        });
        results.logs.push(`Move comparison skipped: ${move1 || "none"} vs ${move2 || "none"}`);
        continue;
      }

      // Determine the result
      const result = this.determineWinner(move1, move2);

      // Calculate damage
      let player1Damage = 0;
      let player2Damage = 0;

      if (result === "win") {
        player2Damage = this.calculateDamage(move1, move2, battleState.player1BaseDamage, battleState.player1Modifiers);
      } else if (result === "lose") {
        player1Damage = this.calculateDamage(move2, move1, battleState.player2BaseDamage, battleState.player2Modifiers);
      }

      // Update total damage for the round
      results.player1Damage += player1Damage;
      results.player2Damage += player2Damage;

      // Store the move result
      results.moves.push({
        player1: move1,
        player2: move2,
        result: result,
        player1Damage,
        player2Damage,
      });

      // Create log entry
      const logEntry = `Player 1 ${ACTION_EMOJI[move1]} vs Player 2 ${ACTION_EMOJI[move2]} - `;

      if (result === "tie") {
        results.logs.push(logEntry + "Tie!");
      } else if (result === "win") {
        results.logs.push(logEntry + `Player 1 wins! (${player2Damage} damage to Player 2)`);
      } else if (result === "lose") {
        results.logs.push(logEntry + `Player 2 wins! (${player1Damage} damage to Player 1)`);
      }
    }

    // Update remaining HP
    results.player1RemainingHP = Math.max(0, battleState.player1HP - results.player1Damage);
    results.player2RemainingHP = Math.max(0, battleState.player2HP - results.player2Damage);

    return results;
  }

  /**
   * Generates random items for item selection
   * @param {number} count - Number of items to generate
   * @param {Array} pool - Pool of items to select from
   * @returns {Array} - Array of selected items
   */
  static getRandomItems(count, pool) {
    if (!pool || pool.length === 0) {
      return [];
    }

    // Create a copy to avoid modifying the original
    const availableItems = [...pool];
    const selectedItems = [];

    for (let i = 0; i < count; i++) {
      if (availableItems.length === 0) break;

      // Select a random item
      const randomIndex = Math.floor(Math.random() * availableItems.length);
      const selectedItem = availableItems.splice(randomIndex, 1)[0];

      selectedItems.push(selectedItem);
    }

    return selectedItems;
  }

  /**
   * Creates a new battle state object
   * @param {Object} player1 - Player 1 data
   * @param {Object} player2 - Player 2 data
   * @returns {Object} - Initial battle state
   */
  static createBattleState(player1, player2) {
    return {
      round: 1,
      phase: BATTLE_PHASE.MOVE_SELECTION,
      player1HP: player1.hp || 100,
      player2HP: player2.hp || 100,
      player1MaxHP: player1.maxHp || 100,
      player2MaxHP: player2.maxHp || 100,
      player1BaseDamage: player1.baseDamage || 10,
      player2BaseDamage: player2.baseDamage || 10,
      player1Modifiers: player1.modifiers || [],
      player2Modifiers: player2.modifiers || [],
      player1Inventory: player1.inventory || [],
      player2Inventory: player2.inventory || [],
      player1Moves: [],
      player2Moves: [],
      player1Locked: false,
      player2Locked: false,
      countdown: null,
      winner: null,
      logs: [],
    };
  }
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = SharedBattle;
}

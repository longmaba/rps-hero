/**
 * Audio Handler for RPS Roguelike
 * Manages background music and sound effects
 */

// Key for storing audio preferences in localStorage
const AUDIO_PREFS_KEY = "rps_roguelike_audio_prefs";

// Default audio settings
const DEFAULT_AUDIO_PREFS = {
  musicEnabled: true,
  musicVolume: 0.5, // 50% volume by default
  sfxEnabled: true,
  sfxVolume: 0.6, // 60% volume by default
};

// Get audio preferences from localStorage or use default
function getAudioPreferences() {
  try {
    const savedPrefs = localStorage.getItem(AUDIO_PREFS_KEY);
    if (savedPrefs) {
      const parsedPrefs = JSON.parse(savedPrefs);

      // Validate values to ensure they're valid
      const validatedPrefs = {
        musicEnabled: typeof parsedPrefs.musicEnabled === "boolean" ? parsedPrefs.musicEnabled : DEFAULT_AUDIO_PREFS.musicEnabled,
        musicVolume: isValidVolume(parsedPrefs.musicVolume) ? parsedPrefs.musicVolume : DEFAULT_AUDIO_PREFS.musicVolume,
        sfxEnabled: typeof parsedPrefs.sfxEnabled === "boolean" ? parsedPrefs.sfxEnabled : DEFAULT_AUDIO_PREFS.sfxEnabled,
        sfxVolume: isValidVolume(parsedPrefs.sfxVolume) ? parsedPrefs.sfxVolume : DEFAULT_AUDIO_PREFS.sfxVolume,
      };

      return validatedPrefs;
    }
  } catch (error) {
    console.warn("Error loading audio preferences, using defaults:", error);
  }

  return { ...DEFAULT_AUDIO_PREFS }; // Return a copy of the defaults
}

// Helper to validate volume values
function isValidVolume(volume) {
  return typeof volume === "number" && isFinite(volume) && volume >= 0 && volume <= 1;
}

// Save audio preferences to localStorage
function saveAudioPreferences(prefs) {
  try {
    // Ensure we're only saving valid values
    const validatedPrefs = {
      musicEnabled: typeof prefs.musicEnabled === "boolean" ? prefs.musicEnabled : DEFAULT_AUDIO_PREFS.musicEnabled,
      musicVolume: isValidVolume(prefs.musicVolume) ? prefs.musicVolume : DEFAULT_AUDIO_PREFS.musicVolume,
      sfxEnabled: typeof prefs.sfxEnabled === "boolean" ? prefs.sfxEnabled : DEFAULT_AUDIO_PREFS.sfxEnabled,
      sfxVolume: isValidVolume(prefs.sfxVolume) ? prefs.sfxVolume : DEFAULT_AUDIO_PREFS.sfxVolume,
    };

    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(validatedPrefs));
  } catch (error) {
    console.warn("Error saving audio preferences:", error);
  }
}

// Audio controller class
class AudioController {
  constructor() {
    this.bgmElement = document.getElementById("background-music");
    this.toggleButton = document.getElementById("toggle-music");

    // Create audio element for click sound
    this.clickSound = new Audio("assets/SFX/click.mp3");

    // Track autoplay status
    this.autoplayAttempted = false;
    this.userInteracted = false;

    // Load user preferences
    this.preferences = getAudioPreferences();

    // Setup initial state
    this.initializeAudio();

    // Setup event listeners
    this.setupEventListeners();

    // Setup global interaction listener to start music on first interaction
    this.setupFirstInteractionListener();

    // Add click sounds to all buttons
    this.setupButtonSounds();
  }

  initializeAudio() {
    // Set initial volume with safety checks
    if (this.bgmElement) {
      // Ensure volume is a valid number between 0 and 1
      const musicVolume = isValidVolume(this.preferences.musicVolume) ? this.preferences.musicVolume : DEFAULT_AUDIO_PREFS.musicVolume;

      this.bgmElement.volume = musicVolume;
    }

    if (this.clickSound) {
      // Ensure SFX volume is a valid number between 0 and 1
      const sfxVolume = isValidVolume(this.preferences.sfxVolume) ? this.preferences.sfxVolume : DEFAULT_AUDIO_PREFS.sfxVolume;

      this.clickSound.volume = sfxVolume;
    }

    // Update the toggle button state
    this.updateToggleButton();

    // Auto-play music if enabled (with user interaction requirement handling)
    if (this.preferences.musicEnabled && this.bgmElement) {
      this.playMusic();
    } else {
      this.stopMusic();
    }
  }

  setupEventListeners() {
    // Toggle button click event
    this.toggleButton.addEventListener("click", () => {
      this.toggleMusic();
      this.userInteracted = true;
    });

    // Handle page visibility changes (pause music when tab is not visible)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Only pause if music is currently playing
        if (!this.bgmElement.paused && this.preferences.musicEnabled) {
          this.bgmElement.pause();
        }
      } else {
        // Resume only if music was enabled and user has interacted
        if (this.preferences.musicEnabled && this.userInteracted) {
          this.playMusic();
        }
      }
    });

    // Handle beforeunload to save preferences
    window.addEventListener("beforeunload", () => {
      saveAudioPreferences(this.preferences);
    });
  }

  setupFirstInteractionListener() {
    // List of events that count as user interaction
    const interactionEvents = ["click", "touchstart", "keydown", "mousedown"];

    // Create a one-time handler for the first user interaction
    const handleFirstInteraction = () => {
      this.userInteracted = true;

      // Start music if it was enabled but couldn't autoplay before
      if (this.preferences.musicEnabled && this.autoplayAttempted && this.bgmElement.paused) {
        this.playMusic();
      }

      // Remove all event listeners after first interaction
      interactionEvents.forEach((event) => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };

    // Add listeners for all interaction events
    interactionEvents.forEach((event) => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });
  }

  // Add click sounds to all buttons
  setupButtonSounds() {
    // Wait for DOM to be fully loaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.attachButtonSounds());
    } else {
      this.attachButtonSounds();
    }

    // Also attach sounds to any new buttons that might be added later
    // by observing DOM changes
    this.setupButtonObserver();
  }

  // Attach click sound to all buttons and interactive elements
  attachButtonSounds() {
    // Select all button elements and elements with interactive classes
    const interactiveElements = document.querySelectorAll(
      "button, .game-button, .game-mode-btn, .move-btn, .util-btn, .copy-btn, .clear-log-btn, " +
        ".item-option, .node-option, .inventory-item, .usable-item, .map-node, .event-choice, .rest-option"
    );

    interactiveElements.forEach((element) => {
      // Only attach if we haven't already
      if (!element.hasAttribute("data-has-click-sound")) {
        element.setAttribute("data-has-click-sound", "true");
        element.addEventListener("click", () => this.playClickSound());
      }
    });
  }

  // Set up an observer to watch for new buttons added to the DOM
  setupButtonObserver() {
    // Create a new observer
    const observer = new MutationObserver((mutations) => {
      let shouldScanForButtons = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldScanForButtons = true;
        }
      });

      if (shouldScanForButtons) {
        this.attachButtonSounds();
      }
    });

    // Start observing the document body for DOM changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  playClickSound() {
    if (this.preferences.sfxEnabled && this.clickSound) {
      // Clone the sound to allow overlapping plays
      const soundClone = this.clickSound.cloneNode();

      // Ensure we set a valid volume
      if (soundClone) {
        const volume = isValidVolume(this.preferences.sfxVolume) ? this.preferences.sfxVolume : DEFAULT_AUDIO_PREFS.sfxVolume;

        soundClone.volume = volume;

        soundClone.play().catch((error) => {
          // Silently catch errors, as click sounds are not critical
          console.log("Click sound play error:", error);
        });
      }
    }
  }

  playMusic() {
    // Mark that we've attempted autoplay
    this.autoplayAttempted = true;

    // Only try to play if we have an audio element
    if (!this.bgmElement) return;

    // Handle autoplay restrictions by checking if we can play without user gesture
    const playPromise = this.bgmElement.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Auto-play was prevented, we'll need user interaction
        console.log("Autoplay prevented:", error);

        // Do nothing here - the global first-interaction handler will take care of starting
        // the music once the user interacts with the page
      });
    }
  }

  stopMusic() {
    if (this.bgmElement) {
      this.bgmElement.pause();
    }
  }

  toggleMusic() {
    this.preferences.musicEnabled = !this.preferences.musicEnabled;

    if (this.preferences.musicEnabled) {
      this.playMusic();
    } else {
      this.stopMusic();
    }

    this.updateToggleButton();
    saveAudioPreferences(this.preferences);
  }

  updateToggleButton() {
    if (this.preferences.musicEnabled) {
      this.toggleButton.textContent = "🔊 Music";
      this.toggleButton.title = "Mute Background Music";
    } else {
      this.toggleButton.textContent = "🔇 Music";
      this.toggleButton.title = "Unmute Background Music";
    }
  }

  // Method to adjust volume
  setVolume(level) {
    // Ensure volume is between 0 and 1
    if (!isValidVolume(level)) {
      console.warn("Attempted to set invalid volume:", level);
      level = DEFAULT_AUDIO_PREFS.musicVolume;
    }

    const volume = Math.max(0, Math.min(1, level));

    if (this.bgmElement) {
      this.bgmElement.volume = volume;
    }

    this.preferences.musicVolume = volume;
    saveAudioPreferences(this.preferences);
  }

  // Method to adjust SFX volume
  setSFXVolume(level) {
    // Ensure volume is between 0 and 1
    if (!isValidVolume(level)) {
      console.warn("Attempted to set invalid SFX volume:", level);
      level = DEFAULT_AUDIO_PREFS.sfxVolume;
    }

    const volume = Math.max(0, Math.min(1, level));

    if (this.clickSound) {
      this.clickSound.volume = volume;
    }

    this.preferences.sfxVolume = volume;
    saveAudioPreferences(this.preferences);
  }

  // Method to toggle SFX
  toggleSFX() {
    this.preferences.sfxEnabled = !this.preferences.sfxEnabled;
    saveAudioPreferences(this.preferences);
  }
}

// Initialize audio controller when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const audioController = new AudioController();

  // Make audioController available globally
  window.audioController = audioController;
});

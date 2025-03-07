/**
 * peer-connection.js
 * Handles WebRTC peer connections for the multiplayer functionality
 */

// Firebase configuration for signaling
const firebaseConfig = {
  apiKey: "AIzaSyDcJaMcSGbTlOFJwP9Y1xRnKVXTpYXRiv8",
  authDomain: "rps-roguelike.firebaseapp.com",
  databaseURL: "https://rps-roguelike-default-rtdb.firebaseio.com",
  projectId: "rps-roguelike",
  storageBucket: "rps-roguelike.appspot.com",
  messagingSenderId: "836139889891",
  appId: "1:836139889891:web:7ba6bd076caf024bd6e077",
};

// Flag to determine if we're using Firebase or direct peer connections
let useFirebase = true;
let firebaseInitialized = false;

try {
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  firebaseInitialized = true;
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
  useFirebase = false;
}

// Connection variables
let peer = null;
let connection = null;
let myPeerId = null;
let isHost = false;
let roomCode = null;

// Character set for room code generation
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omitting confusing characters like 0/O, 1/I
const ROOM_CODE_LENGTH = 4;

// Track recently processed messages to prevent duplicates
const recentlyProcessedMessages = new Set();
const messageTimestamps = new Map();
const MESSAGE_EXPIRY_TIME = 5000; // 5 seconds

// Connection status constants
const CONNECTION_STATUS = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting...",
  WAITING: "Waiting for opponent...",
  CONNECTED: "Connected!",
  ERROR: "Error: ",
};

// Add connection state variable
let connectionState = "disconnected"; // can be "disconnected", "connecting", "open"

// Add variables for reconnection
let lastConnectedPeerId = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let isReconnecting = false;
let reconnectTimer = null;

/**
 * Generates a random room code
 * @returns {string} A 4-character alphanumeric room code
 */
function generateRoomCode() {
  let result = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    result += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return result;
}

/**
 * Initializes the peer connection as a host
 */
function initializeAsHost() {
  isHost = true;
  roomCode = generateRoomCode();

  // Display room code
  document.getElementById("room-code").textContent = roomCode;
  document.getElementById("room-code-display").classList.remove("hidden");
  updateConnectionStatus(CONNECTION_STATUS.WAITING);

  // Initialize PeerJS with room code as ID
  const peerId = "rps-" + roomCode;

  peer = new Peer(peerId);

  peer.on("open", (id) => {
    myPeerId = id;
    // console.log("My peer ID is: " + myPeerId);

    // Try to register room in Firebase if available
    if (useFirebase && firebaseInitialized) {
      registerRoomInFirebase(roomCode).catch((error) => {
        console.error("Firebase registration failed:", error);
        // If Firebase fails, we just continue with direct peer connections
        useFirebase = false;
      });
    }
  });

  peer.on("connection", (conn) => {
    handlePeerConnection(conn);
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    updateConnectionStatus(CONNECTION_STATUS.ERROR + err.type);

    // If we get an "unavailable-id" error, try again with a different code
    if (err.type === "unavailable-id") {
      alert("Room code already in use. Generating a new one...");
      // Close the current peer
      if (peer) {
        peer.destroy();
      }
      // Try again with a new code
      setTimeout(initializeAsHost, 500);
    }
  });
}

/**
 * Registers the room in Firebase for discovery
 * @param {string} code - The room code
 */
async function registerRoomInFirebase(code) {
  if (!useFirebase || !firebaseInitialized) {
    return Promise.reject("Firebase not available");
  }

  try {
    await firebase
      .database()
      .ref("rooms/" + code)
      .set({
        hostId: myPeerId,
        created: firebase.database.ServerValue.TIMESTAMP,
        active: true,
      });

    // Remove room when connection is closed or after 10 minutes
    firebase
      .database()
      .ref("rooms/" + code)
      .onDisconnect()
      .remove();
    setTimeout(() => {
      if (firebase.database) {
        firebase
          .database()
          .ref("rooms/" + code)
          .remove();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return Promise.resolve();
  } catch (error) {
    console.error("Firebase write error:", error);
    useFirebase = false;
    return Promise.reject(error);
  }
}

/**
 * Initializes the peer connection as a guest
 * @param {string} code - The room code to join
 */
function initializeAsGuest(code) {
  isHost = false;
  roomCode = code.toUpperCase();
  updateConnectionStatus(CONNECTION_STATUS.CONNECTING);

  // If Firebase is available, look up the host's peer ID
  if (useFirebase && firebaseInitialized) {
    lookupRoomInFirebase(roomCode)
      .then((roomData) => {
        if (roomData && roomData.hostId) {
          initializeGuestPeer(roomData.hostId);
        } else {
          // If room not found in Firebase, try direct connection using the code
          useFirebase = false;
          initializeGuestPeer("rps-" + roomCode);
        }
      })
      .catch((error) => {
        console.error("Firebase lookup failed:", error);
        // If Firebase fails, try direct connection
        useFirebase = false;
        initializeGuestPeer("rps-" + roomCode);
      });
  } else {
    // Direct connection using the code as host ID
    initializeGuestPeer("rps-" + roomCode);
  }
}

/**
 * Looks up room data in Firebase
 * @param {string} code - The room code
 * @returns {Promise} - Promise resolving to room data
 */
async function lookupRoomInFirebase(code) {
  if (!useFirebase || !firebaseInitialized) {
    return Promise.reject("Firebase not available");
  }

  try {
    const snapshot = await firebase
      .database()
      .ref("rooms/" + code)
      .once("value");
    return snapshot.val();
  } catch (error) {
    console.error("Firebase read error:", error);
    useFirebase = false;
    return Promise.reject(error);
  }
}

/**
 * Initializes the peer connection for a guest
 * @param {string} hostPeerId - The peer ID of the host to connect to
 */
function initializeGuestPeer(hostPeerId) {
  // Initialize PeerJS
  peer = new Peer();

  peer.on("open", (id) => {
    myPeerId = id;
    console.log("My peer ID is: " + myPeerId);

    // Connect to the host
    connectToPeer(hostPeerId);
  });

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    updateConnectionStatus(CONNECTION_STATUS.ERROR + err.type);

    // If we get a "peer-unavailable" error, the room might not exist
    if (err.type === "peer-unavailable") {
      alert("Room not found or host disconnected. Please check the room code and try again.");
    }
  });
}

/**
 * Connects to another peer
 * @param {string} peerId - The peer ID to connect to
 */
function connectToPeer(peerId) {
  connectionState = "connecting"; // Set state to connecting
  updateConnectionStatus("Connecting to peer...");

  connection = peer.connect(peerId, {
    reliable: true,
  });

  connection.on("open", () => {
    handleConnectionOpen();
  });

  connection.on("error", (err) => {
    console.error("Connection error:", err);
    connectionState = "disconnected"; // Update state on error
    updateConnectionStatus(CONNECTION_STATUS.ERROR + "Connection failed");
  });

  // Add data and close handlers here to ensure they're set up early
  connection.on("data", (data) => {
    handleIncomingData(data);
  });

  connection.on("close", () => {
    handleConnectionClosed();
  });
}

/**
 * Handles an incoming peer connection
 * @param {object} conn - The connection object
 */
function handlePeerConnection(conn) {
  connection = conn;
  connectionState = "connecting"; // Set state to connecting
  updateConnectionStatus("Incoming connection, establishing link...");

  connection.on("open", () => {
    handleConnectionOpen();
  });

  connection.on("data", (data) => {
    handleIncomingData(data);
  });

  connection.on("close", () => {
    handleConnectionClosed();
  });

  connection.on("error", (err) => {
    console.error("Connection error:", err);
    connectionState = "disconnected"; // Update state on error
    updateConnectionStatus(CONNECTION_STATUS.ERROR + err.type);
  });
}

/**
 * Handles when a connection is successfully opened
 */
function handleConnectionOpen() {
  // console.log("Connection opened!");
  connectionState = "open"; // Update state to open

  // Reset reconnection variables on successful connection
  reconnectAttempts = 0;
  isReconnecting = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Fire the peer-connected event
  document.dispatchEvent(new CustomEvent("peer-connected"));

  updateConnectionStatus("Connected to peer! Initializing battle...");
}

/**
 * Handles incoming data from the peer
 * @param {object} data - The data received
 */
function handleIncomingData(data) {
  // console.log("Received data in peer-connection.js:", data);

  // Add message tracking to prevent duplicate handling
  if (data && data.type) {
    // Generate a message ID based on the content
    const messageId = data.peerId && data.timestamp ? `${data.type}-${data.peerId}-${data.timestamp}` : null;

    // If we have a message ID, check if we've seen it before
    if (messageId && recentlyProcessedMessages.has(messageId)) {
      // console.log(`Ignoring duplicate message: ${messageId}`);
      return; // Skip processing duplicate message
    }

    // If we have a message ID, track it
    if (messageId) {
      recentlyProcessedMessages.add(messageId);
      messageTimestamps.set(messageId, Date.now());

      // Clean up old messages periodically
      if (recentlyProcessedMessages.size > 100) {
        cleanupOldMessages();
      }
    }
  }

  // Dispatch event for other modules to handle
  document.dispatchEvent(
    new CustomEvent("peer-data", {
      detail: data,
    })
  );
}

/**
 * Handles when a connection is closed
 */
function handleConnectionClosed() {
  console.log("Connection closed!");
  connectionState = "disconnected"; // Update state to disconnected

  updateConnectionStatus("Disconnected: Attempting to reconnect...");

  // Store the last connected peer for reconnection
  if (connection && connection.peer) {
    lastConnectedPeerId = connection.peer;
  }

  // Clean up current connection
  connection = null;

  // Attempt to reconnect if we have a peer ID
  if (lastConnectedPeerId && reconnectAttempts < maxReconnectAttempts) {
    attemptReconnection();
  } else {
    // Failed to reconnect after max attempts
    updateConnectionStatus("Disconnected: Opponent left");
    // Notify that connection is closed
    document.dispatchEvent(new CustomEvent("peer-disconnected"));
  }
}

/**
 * Attempts to reconnect to the last connected peer
 */
function attemptReconnection() {
  if (isReconnecting || connectionState === "open" || !lastConnectedPeerId) {
    return;
  }

  isReconnecting = true;
  reconnectAttempts++;

  updateConnectionStatus(`Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);

  // Attempt to reconnect
  connectToPeer(lastConnectedPeerId);

  // Set a timeout to try again if this attempt fails
  reconnectTimer = setTimeout(() => {
    if (connectionState !== "open") {
      isReconnecting = false;

      if (reconnectAttempts < maxReconnectAttempts) {
        attemptReconnection();
      } else {
        // Give up after max attempts
        updateConnectionStatus("Disconnected: Failed to reconnect");
        document.dispatchEvent(new CustomEvent("peer-disconnected"));
      }
    }
  }, 5000); // Wait 5 seconds between reconnection attempts
}

/**
 * Sends data to the connected peer
 * @param {object} data - The data to send
 * @returns {boolean} Whether the send was successful
 */
function sendToPeer(data) {
  if (!connection) {
    console.error("Cannot send data: No connection");
    return false;
  }

  // Check if connection is open before sending
  if (connectionState !== "open") {
    console.error("Connection is not in open state. Current state:", connectionState);
    // Attempt to notify the user about connection issues
    updateConnectionStatus("Connection error: Please wait for connection to be established");
    return false;
  }

  try {
    connection.send(data);
    return true;
  } catch (error) {
    console.error("Error sending data:", error);
    // Update connection state if there's a send error
    if (error.message.includes("Connection is not open")) {
      connectionState = "disconnected";
      updateConnectionStatus("Connection error: Lost connection to opponent");
    }
    return false;
  }
}

/**
 * Updates the connection status display
 * @param {string} status - The status message
 */
function updateConnectionStatus(status) {
  const statusElement = document.getElementById("status-message");
  if (statusElement) {
    statusElement.textContent = status;
  }
}

/**
 * Closes the peer connection
 */
function closePeerConnection() {
  if (connection) {
    connection.close();
  }

  if (peer) {
    peer.destroy();
  }

  // Clean up Firebase if host and Firebase is available
  if (isHost && useFirebase && firebaseInitialized && roomCode) {
    try {
      firebase
        .database()
        .ref("rooms/" + roomCode)
        .remove();
    } catch (error) {
      console.error("Error removing room from Firebase:", error);
    }
  }

  // Reset variables
  peer = null;
  connection = null;
  myPeerId = null;

  updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
}

/**
 * Cleans up old messages from the recentlyProcessedMessages set
 */
function cleanupOldMessages() {
  const now = Date.now();
  const expiredMessages = [];

  // Find expired messages
  for (const [messageId, timestamp] of messageTimestamps.entries()) {
    if (now - timestamp > MESSAGE_EXPIRY_TIME) {
      expiredMessages.push(messageId);
    }
  }

  // Remove expired messages
  for (const messageId of expiredMessages) {
    recentlyProcessedMessages.delete(messageId);
    messageTimestamps.delete(messageId);
  }

  console.log(`Cleaned up ${expiredMessages.length} old messages. Remaining: ${recentlyProcessedMessages.size}`);
}

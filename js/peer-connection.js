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

// Connection status constants
const CONNECTION_STATUS = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting...",
  WAITING: "Waiting for opponent...",
  CONNECTED: "Connected!",
  ERROR: "Error: ",
};

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
    console.log("My peer ID is: " + myPeerId);

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
  connection = peer.connect(peerId, {
    reliable: true,
  });

  connection.on("open", () => {
    handleConnectionOpen();
  });

  connection.on("error", (err) => {
    console.error("Connection error:", err);
    updateConnectionStatus(CONNECTION_STATUS.ERROR + "Connection failed");
  });
}

/**
 * Handles an incoming peer connection
 * @param {object} conn - The connection object
 */
function handlePeerConnection(conn) {
  connection = conn;

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
    updateConnectionStatus(CONNECTION_STATUS.ERROR + err.type);
  });
}

/**
 * Handles when a connection is successfully opened
 */
function handleConnectionOpen() {
  updateConnectionStatus(CONNECTION_STATUS.CONNECTED);

  // Set up data handlers
  connection.on("data", (data) => {
    handleIncomingData(data);
  });

  connection.on("close", () => {
    handleConnectionClosed();
  });

  // Notify that connection is ready
  document.dispatchEvent(new CustomEvent("peer-connected"));
}

/**
 * Handles incoming data from the peer
 * @param {object} data - The data received
 */
function handleIncomingData(data) {
  console.log("Received data:", data);

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
  updateConnectionStatus("Disconnected: Opponent left");

  // Notify that connection is closed
  document.dispatchEvent(new CustomEvent("peer-disconnected"));

  // Clean up
  connection = null;
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

  try {
    connection.send(data);
    return true;
  } catch (error) {
    console.error("Error sending data:", error);
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

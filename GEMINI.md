# Sikuoni

## Project Overview

Sikuoni is a lightweight, web-based 1-on-1 video chat application. It leverages **Agora RTM (Real-time Messaging)** as a signaling layer to establish a standard **WebRTC** peer-to-peer connection for video and audio streaming. The project is built with vanilla HTML, CSS, and JavaScript, requiring no complex build tools or backend infrastructure for the core video logic.

### Key Features
*   **1-on-1 Video Chat:** Direct peer-to-peer video and audio communication.
*   **Room-Based Entry:** Users join by entering a shared room code/invite link in the lobby.
*   **Media Controls:** Toggle camera, toggle microphone, and switch camera input.
*   **Screen Sharing:** Ability to share the screen with the peer.
*   **Draggable UI:** The secondary video feed (Picture-in-Picture) is draggable and can be swapped with the main feed.

## Technology Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript.
*   **Signaling Service:** Agora RTM SDK (`agora-rtm-sdk-1.4.4.js`).
*   **Media Transport:** WebRTC (`RTCPeerConnection`).

## Architecture & Logic

The application follows a simple signaling flow using Agora RTM to bootstrap the WebRTC connection:

1.  **Lobby (`lobby.html`):** User inputs a room ID. This ID is passed to the main application via URL query parameters (`index.html?room=...`).
2.  **Initialization (`main.js`):**
    *   The app initializes the Agora RTM client with a hardcoded App ID.
    *   It joins a specific Agora "channel" based on the room ID.
3.  **Signaling:**
    *   When a peer joins, the `MemberJoined` event triggers the creation of a WebRTC Offer.
    *   Offers, Answers, and ICE Candidates are stringified and sent as JSON messages via Agora RTM (`client.sendMessageToPeer`).
4.  **Connection:**
    *   Once the SDP handshake is complete, the `RTCPeerConnection` handles the direct media stream between users.

## Key Files

*   **`lobby.html`**: The landing page. Features a "hacker-style" text effect (`random.js`) and a form to enter the room code.
*   **`index.html`**: The main application shell. Contains the video elements (`#user-1`, `#user-2`) and control buttons.
*   **`main.js`**: Contains the core logic.
    *   Handles Agora RTM login and channel management.
    *   Manages `RTCPeerConnection` (Offer/Answer exchange).
    *   Implements UI logic for dragging video frames and toggling media tracks.
*   **`agora-rtm-sdk-1.4.4.js`**: The local vendor library for Agora RTM.

## Building and Running

Since this is a static web application, no compilation or build step is required.

### Prerequisites
*   A modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge).
*   A local web server (opening `file://` directly may block camera/mic permissions due to browser security policies).

### How to Run Locally

1.  **Start a Local Server:**
    Run a simple HTTP server in the project root.
    *   **Python 3:** `python3 -m http.server`
    *   **Node/npm:** `npx serve` or `npx http-server`
    *   **PHP:** `php -S localhost:8000`

2.  **Access the App:**
    Open your browser and navigate to the local server address (e.g., `http://localhost:8000/lobby.html`).

3.  **Test Connection:**
    *   Open the lobby in one tab/browser. Enter a room name (e.g., "test") and join.
    *   Open the lobby in a **second** tab/browser (incognito recommended to simulate a distinct peer). Enter the **same** room name.
    *   Allow camera/microphone permissions when prompted.
    *   You should see the local and remote video feeds connected.

## Development Conventions

*   **Vanilla JS:** The project avoids frameworks. All logic is contained within standard functions in `main.js`.
*   **Direct DOM Manipulation:** UI updates are performed using `document.getElementById` and standard event listeners.
*   **Hardcoded Credentials:** The Agora App ID is currently hardcoded in `main.js`. For production, consider using environment variables or a token server for better security.

## Recent Changes

*   **Fixed Video Initialization Bug:** Resolved an `OverconstrainedError` by simplifying WebRTC constraints from strict 1080p requirements to flexible defaults. This ensures compatibility across devices with different camera capabilities.

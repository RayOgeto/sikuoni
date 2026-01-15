const APP_ID = "1ae489bf63a1492abf6aa0800618cb58";
const TOKEN = null; // Set to null for testing. In production, fetch this from your backend.

const ICE_SERVERS = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

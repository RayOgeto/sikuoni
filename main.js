let token = null;
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;

let displayFrame = document.getElementById('user-1')
let hideFrame = document.getElementById('user-2')

const servers = ICE_SERVERS;

// Use constants from config.js
// APP_ID is now imported from config.js

let constraints = {
    video: true,
    audio: true
}

let videoDevices = [];
let currentVideoDeviceIndex = 0;
let isScreenSharing = false;
let screenShareStream = null;

async function getConnectedDevices(type) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === type);
}

let init = async () => {
    let loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }

    try {
        client = await AgoraRTM.createInstance(APP_ID)
        await client.login({uid, token})

        channel = client.createChannel(roomId)
        await channel.join()

        // Check for existing members to enforce capacity
        const members = await channel.getMembers();
        if (members.length > 2) {
            showToast('Room is full! Redirecting to lobby...', 'error');
            await channel.leave();
            await client.logout();
            setTimeout(() => {
                window.location = 'lobby.html';
            }, 3000);
            return;
        }

        channel.on('MemberJoined', handleUserJoined)
        channel.on('MemberLeft', handleUserLeft)
        channel.on('ChannelMessage', handleChannelMessage)

        client.on('MessageFromPeer', handleMessageFromPeer)

        videoDevices = await getConnectedDevices('videoinput');
        // if (videoDevices.length > 0) {
        //     constraints.video = { deviceId: { exact: videoDevices[currentVideoDeviceIndex].deviceId } };
        // }

        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById('user-1').srcObject = localStream
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize: ' + error.toString(), 'error');
        // Do not immediately redirect on error to allow reading the toast
    } finally {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}
 

let handleUserLeft = (MemberId) => {
    document.getElementById('wrapper-user-2').style.display = 'none'
    displayFrame.classList.remove('smallFrame')
    displayFrame.style.position = '';
    displayFrame.style.left = '';
    displayFrame.style.top = '';
}

let handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text)

    if(message.type === 'offer'){
        createAnswer(MemberId, message.offer)
    }

    if(message.type === 'answer'){
        addAnswer(message.answer)
    }

    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }


}

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId)
}


let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('wrapper-user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')
    document.getElementById('user-1').style.position = 'fixed';
    document.getElementById('user-1').style.cursor = 'grab';
    document.getElementById('user-1').style.left = '20px';
    document.getElementById('user-1').style.top = '20px';
    makeDraggable(document.getElementById('user-1'));

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }
}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}


let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}


let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}


let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
    
    // Send status update
    sendUserInfo();
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')
    let muteIcon = document.getElementById('mute-icon-user-1');

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
        muteIcon.style.display = 'block';
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
        muteIcon.style.display = 'none';
    }

    // Send status update
    sendUserInfo();
}

let sendUserInfo = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    
    let info = {
        type: 'user-info',
        camera: videoTrack ? videoTrack.enabled : false,
        mic: audioTrack ? audioTrack.enabled : false
    };

    if(channel){
        await channel.sendMessage({text: JSON.stringify(info)});
    }
}

let switchCamera = async () => {
    if (videoDevices.length < 2) {
        alert('No other cameras found.');
        return;
    }

    currentVideoDeviceIndex = (currentVideoDeviceIndex + 1) % videoDevices.length;
    const newDeviceId = videoDevices[currentVideoDeviceIndex].deviceId;

    // Stop current video track
    localStream.getVideoTracks().forEach(track => track.stop());

    // Get new stream from selected camera
    const newConstraints = {
        video: { deviceId: { exact: newDeviceId } },
        audio: true
    };
    try {
        const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
        localStream = newStream;
        document.getElementById('user-1').srcObject = localStream;

        // Replace track in peer connection
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
    } catch (error) {
        console.error('Error switching camera:', error);
        alert('Failed to switch camera.');
    }
};

let startScreenShare = async () => {
    try {
        screenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        isScreenSharing = true;

        // Stop current video track from camera
        localStream.getVideoTracks().forEach(track => track.stop());

        // Replace video track in peer connection with screen share track
        const screenTrack = screenShareStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(screenTrack);
        }

        document.getElementById('user-1').srcObject = screenShareStream;

        screenTrack.onended = () => {
            stopScreenShare();
        };

        document.getElementById('screen-share-btn').style.backgroundColor = 'rgb(255, 80, 80)'; // Indicate active
    } catch (error) {
        console.error('Error starting screen share:', error);
        alert('Failed to start screen sharing.');
    }
};

let stopScreenShare = async () => {
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
    }
    isScreenSharing = false;

    // Get back to camera stream
    const newConstraints = {
        video: { deviceId: { exact: videoDevices[currentVideoDeviceIndex].deviceId } },
        audio: true
    };
    try {
        const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
        localStream = newStream;
        document.getElementById('user-1').srcObject = localStream;

        // Replace track in peer connection with camera track
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
        document.getElementById('screen-share-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'; // Reset button color
    } catch (error) {
        console.error('Error stopping screen share and reverting to camera:', error);
        alert('Failed to revert to camera after stopping screen share.');
    }
};
  
window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('switch-camera-btn').addEventListener('click', switchCamera)
document.getElementById('screen-share-btn').addEventListener('click', () => {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
});

init()

// Draggable smallFrame logic
function makeDraggable(element) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    // Mouse events
    element.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - element.offsetLeft;
        offsetY = e.clientY - element.offsetTop;
        element.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            // Keep within viewport
            x = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, y));
            element.style.left = x + 'px';
            element.style.top = y + 'px';
        }
    });
    document.addEventListener('mouseup', function() {
        isDragging = false;
        element.style.cursor = 'grab';
    });

    // Touch events
    element.addEventListener('touchstart', function(e) {
        isDragging = true;
        const touch = e.touches[0];
        offsetX = touch.clientX - element.offsetLeft;
        offsetY = touch.clientY - element.offsetTop;
    });
    document.addEventListener('touchmove', function(e) {
        if (isDragging) {
            const touch = e.touches[0];
            let x = touch.clientX - offsetX;
            let y = touch.clientY - offsetY;
            x = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, y));
            element.style.left = x + 'px';
            element.style.top = y + 'px';
        }
    });
    document.addEventListener('touchend', function() {
        isDragging = false;
    });
}

let toggleVideoFocus = () => {
    let remoteVideoWrapper = document.getElementById('wrapper-user-2');
    if (remoteVideoWrapper.style.display === 'none') {
        return;
    }

    let localVideo = document.getElementById('user-1');
    let remoteVideo = document.getElementById('user-2');

    if (localVideo.classList.contains('smallFrame')) {
        // Remote is main, local is small. Swap to local is main, remote is small.
        localVideo.classList.remove('smallFrame');
        localVideo.style.position = '';
        localVideo.style.left = '';
        localVideo.style.top = '';
        remoteVideo.classList.add('smallFrame');
        remoteVideo.style.position = 'fixed';
        remoteVideo.style.cursor = 'grab';
        remoteVideo.style.left = '20px';
        remoteVideo.style.top = '20px';
        makeDraggable(remoteVideo);
    } else {
        // Local is main, remote is small. Swap to remote is main, local is small.
        remoteVideo.classList.remove('smallFrame');
        remoteVideo.style.position = '';
        remoteVideo.style.left = '';
        remoteVideo.style.top = '';
        localVideo.classList.add('smallFrame');
        localVideo.style.position = 'fixed';
        localVideo.style.cursor = 'grab';
        localVideo.style.left = '20px';
        localVideo.style.top = '20px';
        makeDraggable(localVideo);
    }
}

document.getElementById('user-1').addEventListener('click', toggleVideoFocus);
document.getElementById('user-2').addEventListener('click', toggleVideoFocus);


// ==============================
// Chat & Status Logic
// ==============================

let handleChannelMessage = async (messageData, MemberId) => {
    let data = JSON.parse(messageData.text);

    if (data.type === 'chat') {
        addMessageToDom(data.displayName, data.message);
    } else if (data.type === 'user-info') {
        updatePeerStatus(MemberId, data);
    }
}

let updatePeerStatus = (MemberId, data) => {
    let remoteVideo = document.getElementById('user-2');
    let muteIcon = document.getElementById('mute-icon-user-2');
    
    // Update Mic Icon
    if (!data.mic) {
        muteIcon.style.display = 'block';
    } else {
        muteIcon.style.display = 'none';
    }

    // You could also add a "Camera Off" placeholder here if !data.camera
}

let addMessageToDom = (name, message) => {
    let messagesWrapper = document.getElementById('chat-messages');
    
    let newMessage = `
        <div class="message__wrapper ${name === 'Me' ? 'me' : ''}">
            <div class="message__body">
                <strong class="message__author">${name}</strong>
                <p class="message__text">${message}</p>
            </div>
        </div>
    `;

    messagesWrapper.insertAdjacentHTML('beforeend', newMessage);
    
    // Auto scroll to bottom
    messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
}

let sendMessage = async (e) => {
    e.preventDefault();
    let message = e.target.message.value;
    if(!message) return;

    channel.sendMessage({text: JSON.stringify({'type':'chat', 'message':message, 'displayName': uid})});
    
    addMessageToDom('Me', message);
    e.target.reset();
}

// Chat UI Toggles
let chatContainer = document.getElementById('chat-container');
let chatBtn = document.getElementById('chat-btn');
let closeChatBtn = document.getElementById('close-chat');

chatBtn.addEventListener('click', () => {
    chatContainer.style.display = 'flex';
});

closeChatBtn.addEventListener('click', () => {
    chatContainer.style.display = 'none';
});

let chatForm = document.getElementById('chat-form');
chatForm.addEventListener('submit', sendMessage);


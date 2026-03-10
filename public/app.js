const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
});

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const currentUserSpan = document.getElementById('current-user');
const profileUpload = document.getElementById('profile-upload');
const profileImgPreview = document.getElementById('profile-img-preview');
const headerProfileImg = document.getElementById('header-profile-img');
const photoBtn = document.getElementById('photo-btn');
const photoUpload = document.getElementById('photo-upload');
const voiceBtn = document.getElementById('voice-btn');
const voiceModal = document.getElementById('voice-recording-modal');
const cancelVoiceBtn = document.getElementById('cancel-voice');
const sendVoiceBtn = document.getElementById('send-voice');
const recordingTimeEl = document.getElementById('recording-time');
const replyPreview = document.getElementById('reply-preview');
const replyPreviewUsername = document.getElementById('reply-preview-username');
const replyPreviewText = document.getElementById('reply-preview-text');
const cancelReplyBtn = document.getElementById('cancel-reply');
const typingIndicator = document.getElementById('typing-indicator');
const typingUsername = document.getElementById('typing-username');

let currentUsername = '';
let currentProfilePic = null;
let currentSocketId = null;
let isLoggedIn = false;
let replyingTo = null;
let typingTimeout = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;

// Request notification permission immediately
if ('Notification' in window) {
    console.log('Notification permission status:', Notification.permission);
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('Notification permission result:', permission);
            if (permission === 'granted') {
                console.log('✅ Notifications enabled! You will get notified when someone replies to you.');
            } else {
                console.log('❌ Notifications blocked. Enable them in browser settings.');
            }
        });
    } else if (Notification.permission === 'granted') {
        console.log('✅ Notifications already enabled!');
    } else {
        console.log('❌ Notifications blocked. Enable them in browser settings.');
    }
}

// Show browser notification
function showNotification(title, body) {
    console.log('🔔 showNotification called:', { title, body });

    if (!('Notification' in window)) {
        console.log('❌ Browser does not support notifications');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.log('❌ Notification permission not granted:', Notification.permission);
        console.log('💡 Click "Allow" when browser asks for notification permission');
        return;
    }

    // Don't show notification if window is focused
    if (document.hasFocus()) {
        console.log('⚠️ Window is focused, skipping notification (this is normal)');
        return;
    }

    try {
        const notification = new Notification(title, {
            body: body,
            icon: 'app.png',
            badge: 'app.png',
            tag: 'shosal-reply',
            requireInteraction: false,
            silent: false
        });

        console.log('✅ Notification created successfully!');

        notification.onclick = () => {
            console.log('Notification clicked');
            window.focus();
            notification.close();
        };

        notification.onerror = (error) => {
            console.error('❌ Notification error:', error);
        };

        // Auto close after 5 seconds
        setTimeout(() => notification.close(), 5000);
    } catch (error) {
        console.error('❌ Error creating notification:', error);
    }
}

// Load saved user data from localStorage
window.addEventListener('DOMContentLoaded', () => {
    const savedUsername = localStorage.getItem('shosal_username');
    const savedProfilePic = localStorage.getItem('shosal_profilePic');

    if (savedUsername) {
        usernameInput.value = savedUsername;
        currentUsername = savedUsername;
    }

    if (savedProfilePic) {
        currentProfilePic = savedProfilePic;
        profileImgPreview.src = savedProfilePic;
        profileImgPreview.style.display = 'block';
    }
});

// Socket connection handlers
socket.on('connect', () => {
    console.log('Connected to server');
    currentSocketId = socket.id;
    if (isLoggedIn && currentUsername) {
        socket.emit('login', { username: currentUsername, profilePic: currentProfilePic });
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Connection error. Please check your internet connection.');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Profile picture upload
profileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            currentProfilePic = event.target.result;
            profileImgPreview.src = currentProfilePic;
            profileImgPreview.style.display = 'block';
            localStorage.setItem('shosal_profilePic', currentProfilePic);
        };
        reader.readAsDataURL(file);
    }
});

// Photo upload for messages
photoBtn.addEventListener('click', () => {
    photoUpload.click();
});

photoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            socket.emit('photo-message', {
                image: event.target.result,
                replyTo: replyingTo
            });
            clearReply();
        };
        reader.readAsDataURL(file);
    }
    photoUpload.value = '';
});

// Typing indicator
messageInput.addEventListener('input', () => {
    console.log('User is typing');
    socket.emit('typing', { isTyping: true });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        console.log('User stopped typing');
        socket.emit('typing', { isTyping: false });
    }, 1000);
});

loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

cancelReplyBtn.addEventListener('click', clearReply);

// Voice recording
voiceBtn.addEventListener('click', startVoiceRecording);
cancelVoiceBtn.addEventListener('click', cancelVoiceRecording);
sendVoiceBtn.addEventListener('click', sendVoiceMessage);

async function startVoiceRecording() {
    try {
        console.log('🎤 Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordingSeconds = 0;

        mediaRecorder.onerror = (event) => {
            console.error('❌ MediaRecorder error:', event.error);
            alert('Error recording audio: ' + event.error);
        };

        mediaRecorder.ondataavailable = (event) => {
            console.log('🎤 Audio chunk received, size:', event.data.size);
            audioChunks.push(event.data);
        };

        mediaRecorder.start();
        console.log('🎤 Recording started');
        voiceModal.style.display = 'flex';

        recordingInterval = setInterval(() => {
            recordingSeconds++;
            const minutes = Math.floor(recordingSeconds / 60);
            const seconds = recordingSeconds % 60;
            recordingTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

    } catch (error) {
        console.error('❌ Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.\n\nError: ' + error.message);
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingInterval);
    }
}

function cancelVoiceRecording() {
    stopVoiceRecording();
    audioChunks = [];
    voiceModal.style.display = 'none';
    recordingTimeEl.textContent = '0:00';
    console.log('🎤 Voice recording cancelled');
}

function sendVoiceMessage() {
    console.log('🎤 sendVoiceMessage called, audioChunks length:', audioChunks.length);

    // Stop recording first to ensure all data is collected
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('🎤 Stopping recorder to collect all data');
        mediaRecorder.stop();
        clearInterval(recordingInterval);
    }

    // Give it a moment to collect data
    setTimeout(() => {
        console.log('🎤 audioChunks after stop:', audioChunks.length);

        if (audioChunks.length === 0) {
            console.error('❌ No audio chunks recorded');
            alert('No audio recorded. Please try again.');
            return;
        }

        try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('🎤 Audio blob created, size:', audioBlob.size);

            if (audioBlob.size === 0) {
                console.error('❌ Audio blob is empty');
                alert('Audio blob is empty. Please try again.');
                return;
            }

            const reader = new FileReader();

            reader.onerror = () => {
                console.error('❌ FileReader error:', reader.error);
                alert('Error reading audio file');
            };

            reader.onload = () => {
                console.log('🎤 Audio converted to base64, size:', reader.result.length);

                socket.emit('voice-message', {
                    audio: reader.result,
                    duration: recordingSeconds,
                    replyTo: replyingTo
                });

                cancelVoiceRecording();
                clearReply();
                console.log('✅ Voice message sent successfully');
            };

            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('❌ Error in sendVoiceMessage:', error);
            alert('Error sending voice message: ' + error.message);
        }
    }, 100);
}

function login() {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    if (username.length < 2) {
        alert('Username must be at least 2 characters');
        return;
    }

    currentUsername = username;
    isLoggedIn = true;

    // Save to localStorage
    localStorage.setItem('shosal_username', username);
    if (currentProfilePic) {
        localStorage.setItem('shosal_profilePic', currentProfilePic);
    }

    socket.emit('login', { username, profilePic: currentProfilePic });
    loginScreen.style.display = 'none';
    chatScreen.style.display = 'block';
    currentUserSpan.textContent = username;

    if (currentProfilePic) {
        const img = document.createElement('img');
        img.src = currentProfilePic;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        headerProfileImg.appendChild(img);
    } else {
        headerProfileImg.style.display = 'flex';
        headerProfileImg.style.alignItems = 'center';
        headerProfileImg.style.justifyContent = 'center';
        headerProfileImg.style.color = '#ff8c00';
        headerProfileImg.style.fontWeight = '700';
        headerProfileImg.textContent = username.charAt(0).toUpperCase();
    }

    messageInput.focus();
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat-message', {
            message,
            replyTo: replyingTo
        });
        messageInput.value = '';
        clearReply();
        socket.emit('typing', { isTyping: false });
    }
}

function setReply(messageId, username, text) {
    replyingTo = { id: messageId, username, text };
    replyPreviewUsername.textContent = username;
    replyPreviewText.textContent = text;
    replyPreview.classList.add('active');
    messageInput.focus();
}

function clearReply() {
    replyingTo = null;
    replyPreview.classList.remove('active');
}

function deleteMessage(messageId) {
    if (confirm('Delete this message?')) {
        socket.emit('delete-message', { messageId });
    }
}

socket.on('chat-message', (data) => {
    console.log('📨 Received chat message:', data);
    addMessage(data);

    // Check if this message is a reply to current user
    console.log('Checking reply conditions:', {
        hasReplyTo: !!data.replyTo,
        replyToUsername: data.replyTo?.username,
        currentUsername: currentUsername,
        senderUsername: data.username,
        isReplyToMe: data.replyTo?.username === currentUsername,
        isNotFromMe: data.username !== currentUsername
    });

    if (data.replyTo && data.replyTo.username === currentUsername && data.username !== currentUsername) {
        console.log('🎯 This is a reply to me! Showing notification...');
        showNotification(
            `${data.username} replied to you`,
            data.message
        );
    } else {
        console.log('ℹ️ Not a reply to me, no notification');
    }
});

socket.on('photo-message', (data) => {
    console.log('📷 Received photo message:', data);
    addPhotoMessage(data);

    // Check if this photo is a reply to current user
    if (data.replyTo && data.replyTo.username === currentUsername && data.username !== currentUsername) {
        console.log('🎯 This photo is a reply to me! Showing notification...');
        showNotification(
            `${data.username} replied to you`,
            'Sent a photo'
        );
    }
});

socket.on('voice-message', (data) => {
    console.log('🎤 Received voice message:', data);
    addVoiceMessage(data);

    // Check if this voice is a reply to current user
    if (data.replyTo && data.replyTo.username === currentUsername && data.username !== currentUsername) {
        console.log('🎯 This voice is a reply to me! Showing notification...');
        showNotification(
            `${data.username} replied to you`,
            'Sent a voice message'
        );
    }
});

socket.on('delete-message', (data) => {
    const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageEl) {
        messageEl.classList.add('deleted');
        const bubble = messageEl.querySelector('.message-bubble');
        if (bubble) {
            bubble.innerHTML = '<em>This message was deleted</em>';
        }
    }
});

socket.on('user-typing', (data) => {
    console.log('User typing event:', data);
    if (data.isTyping) {
        typingUsername.textContent = data.username;
        typingIndicator.classList.add('active');
        console.log('Showing typing indicator for:', data.username);
    } else {
        typingIndicator.classList.remove('active');
        console.log('Hiding typing indicator');
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.dataset.messageId = data.id;

    const isOwnMessage = data.socketId === currentSocketId;
    if (isOwnMessage) {
        messageEl.classList.add('own-message');
    }

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';

    if (data.profilePic) {
        const img = document.createElement('img');
        img.src = data.profilePic;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        avatarEl.appendChild(img);
    } else {
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.color = 'white';
        avatarEl.style.fontWeight = '600';
        avatarEl.textContent = data.username.charAt(0).toUpperCase();
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    let replyHtml = '';
    if (data.replyTo) {
        replyHtml = `
      <div class="reply-indicator">
        <div class="reply-username">${escapeHtml(data.replyTo.username)}</div>
        <div class="reply-text">${escapeHtml(data.replyTo.text)}</div>
      </div>
    `;
    }

    const actionsHtml = `
    <div class="message-actions">
      <button class="reply-btn" onclick="replyToMessage('${data.id}', '${escapeHtml(data.username)}', '${escapeHtml(data.message)}')">Reply</button>
      ${isOwnMessage ? `<button class="delete-btn" onclick="deleteMessage('${data.id}')">Delete</button>` : ''}
    </div>
  `;

    const usernameHtml = !isOwnMessage ? `<div class="message-username">${escapeHtml(data.username)}</div>` : '';

    contentEl.innerHTML = `
    <div class="message-header">
      ${usernameHtml}
    </div>
    ${replyHtml}
    <div class="message-bubble">
      ${escapeHtml(data.message)}
      <span class="message-time">${data.timestamp}</span>
      ${actionsHtml}
    </div>
  `;

    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentEl);
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


function addPhotoMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.dataset.messageId = data.id;

    const isOwnMessage = data.socketId === currentSocketId;
    if (isOwnMessage) {
        messageEl.classList.add('own-message');
    }

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';

    if (data.profilePic) {
        const img = document.createElement('img');
        img.src = data.profilePic;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        avatarEl.appendChild(img);
    } else {
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.color = 'white';
        avatarEl.style.fontWeight = '600';
        avatarEl.textContent = data.username.charAt(0).toUpperCase();
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    let replyHtml = '';
    if (data.replyTo) {
        replyHtml = `
      <div class="reply-indicator">
        <div class="reply-username">${escapeHtml(data.replyTo.username)}</div>
        <div class="reply-text">${escapeHtml(data.replyTo.text)}</div>
      </div>
    `;
    }

    const actionsHtml = `
    <div class="message-actions">
      <button class="reply-btn" onclick="replyToMessage('${data.id}', '${escapeHtml(data.username)}', 'Photo')">Reply</button>
      ${isOwnMessage ? `<button class="delete-btn" onclick="deleteMessage('${data.id}')">Delete</button>` : ''}
    </div>
  `;

    const usernameHtml = !isOwnMessage ? `<div class="message-username">${escapeHtml(data.username)}</div>` : '';

    contentEl.innerHTML = `
    <div class="message-header">
      ${usernameHtml}
    </div>
    ${replyHtml}
    <div class="message-bubble image-bubble">
      <div class="image-container">
        <img src="${data.image}" class="message-image" onclick="window.open('${data.image}', '_blank')">
        <button class="image-download-btn" onclick="downloadImage('${data.image}', '${data.id}')" title="Download image">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
      <span class="message-time">${data.timestamp}</span>
      ${actionsHtml}
    </div>
  `;

    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentEl);
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addVoiceMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.dataset.messageId = data.id;

    const isOwnMessage = data.socketId === currentSocketId;
    if (isOwnMessage) {
        messageEl.classList.add('own-message');
    }

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';

    if (data.profilePic) {
        const img = document.createElement('img');
        img.src = data.profilePic;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        avatarEl.appendChild(img);
    } else {
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.color = 'white';
        avatarEl.style.fontWeight = '600';
        avatarEl.textContent = data.username.charAt(0).toUpperCase();
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    let replyHtml = '';
    if (data.replyTo) {
        replyHtml = `
      <div class="reply-indicator">
        <div class="reply-username">${escapeHtml(data.replyTo.username)}</div>
        <div class="reply-text">${escapeHtml(data.replyTo.text)}</div>
      </div>
    `;
    }

    const actionsHtml = `
    <div class="message-actions">
      <button class="reply-btn" onclick="replyToMessage('${data.id}', '${escapeHtml(data.username)}', 'Voice message')">Reply</button>
      ${isOwnMessage ? `<button class="delete-btn" onclick="deleteMessage('${data.id}')">Delete</button>` : ''}
    </div>
  `;

    const usernameHtml = !isOwnMessage ? `<div class="message-username">${escapeHtml(data.username)}</div>` : '';

    const minutes = Math.floor(data.duration / 60);
    const seconds = data.duration % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const voiceId = 'voice_' + data.id;

    contentEl.innerHTML = `
    <div class="message-header">
      ${usernameHtml}
    </div>
    ${replyHtml}
    <div class="message-bubble voice-bubble">
      <div class="voice-player">
        <button class="voice-play-btn" id="${voiceId}" data-audio="${data.audio}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <div class="voice-waveform">
          <div class="voice-duration">${durationText}</div>
        </div>
      </div>
      <span class="message-time">${data.timestamp}</span>
      ${actionsHtml}
    </div>
  `;

    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentEl);
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Add click handler for voice playback
    const playBtn = document.getElementById(voiceId);
    playBtn.addEventListener('click', () => playVoice(playBtn));
}

function playVoice(button) {
    const audioData = button.dataset.audio;
    const svg = button.querySelector('svg');

    console.log('🎤 playVoice called, audioData length:', audioData ? audioData.length : 0);

    if (!audioData) {
        console.error('❌ No audio data found');
        alert('No audio data available');
        return;
    }

    if (button.audio && !button.audio.paused) {
        console.log('🎤 Pausing audio');
        button.audio.pause();
        svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        return;
    }

    try {
        const audio = new Audio(audioData);
        button.audio = audio;

        audio.onplay = () => {
            console.log('🎤 Audio playing');
            svg.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
        };

        audio.onended = () => {
            console.log('🎤 Audio ended');
            svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        };

        audio.onerror = (error) => {
            console.error('❌ Audio error:', error);
            alert('Error playing voice message: ' + error);
            svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        };

        console.log('🎤 Starting audio playback');
        audio.play().catch(err => {
            console.error('❌ Error playing audio:', err);
            alert('Could not play voice message: ' + err.message);
        });
    } catch (error) {
        console.error('❌ Error in playVoice:', error);
        alert('Error: ' + error.message);
    }
}


window.replyToMessage = function (messageId, username, text) {
    setReply(messageId, username, text);
};

window.deleteMessage = deleteMessage;

function downloadImage(imageData, messageId) {
    try {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `shosal-image-${messageId}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('✅ Image downloaded');
    } catch (error) {
        console.error('❌ Error downloading image:', error);
        alert('Error downloading image');
    }
}

socket.on('user-joined', (data) => {
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.textContent = `${data.username} joined the chat`;
    messagesDiv.appendChild(systemMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('user-left', (username) => {
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.textContent = `${username} left the chat`;
    messagesDiv.appendChild(systemMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('users-update', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');

        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'user-avatar';

        if (user.profilePic) {
            const img = document.createElement('img');
            img.src = user.profilePic;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            avatarContainer.appendChild(img);
        } else {
            avatarContainer.style.display = 'flex';
            avatarContainer.style.alignItems = 'center';
            avatarContainer.style.justifyContent = 'center';
            avatarContainer.textContent = user.username.charAt(0).toUpperCase();
        }

        li.appendChild(avatarContainer);

        const span = document.createElement('span');
        span.className = 'user-name';
        span.textContent = user.username;
        li.appendChild(span);

        usersList.appendChild(li);
    });
});

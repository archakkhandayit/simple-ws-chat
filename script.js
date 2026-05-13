const socket = io();
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentSocketId = '';

// Get the socket ID when connected
socket.on('connect', () => {
    currentSocketId = socket.id;
    console.log('Connected to server with ID:', currentSocketId);
});

// Listen for incoming messages
socket.on('receive-message', (data) => {
    displayMessage(data.text, data.id, data.timestamp);
});

// Send message on button click
sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && messageInput.value.trim()) {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // Emit message to server
    socket.emit('send-message', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.focus();
}

function displayMessage(text, senderId, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Check if message is from current user
    if (senderId === currentSocketId) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
    }
    
    const messageContent = document.createElement('div');
    messageContent.textContent = text;
    
    const timeSpan = document.createElement('div');
    timeSpan.className = 'message-time';
    timeSpan.textContent = timestamp;
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
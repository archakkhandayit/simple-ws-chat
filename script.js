const socket = io();

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
const clearBtn = document.getElementById('clearBtn');
const usersCountBadge = document.getElementById('usersCount');
const typingIndicator = document.getElementById('typingIndicator');
const dropOverlay = document.getElementById('dropOverlay');

// Image preview modal
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const modalDownload = document.getElementById('modalDownload');

let currentSocketId = '';
const typingUsers = new Set();
let typingTimeout;

// Connection
socket.on('connect', () => {
  currentSocketId = socket.id;
  console.log('Connected with ID:', currentSocketId);
});

// Update active device count
socket.on('users-count', (count) => {
  if (usersCountBadge) {
    usersCountBadge.textContent = count === 1 ? '1 device' : `${count} devices`;
  }
});

// Receive initial in-memory history when joining
socket.on('init-history', (history) => {
  messagesContainer.innerHTML = '';
  if (history && history.length > 0) {
    history.forEach((msg) => {
      displayMessage(msg);
    });
  } else {
    showEmptyState();
  }
});

// Receive incoming message
socket.on('receive-message', (data) => {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.remove();

  displayMessage(data);
});

// Chat cleared
socket.on('chat-cleared', () => {
  messagesContainer.innerHTML = '';
  showEmptyState();
});

// Send Text Message
function sendTextMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('send-message', {
    type: 'text',
    text: text
  });

  messageInput.value = '';
  messageInput.style.height = 'auto'; // Reset textarea height
  messageInput.focus();

  // Reset typing state
  clearTimeout(typingTimeout);
  socket.emit('user-typing', { isTyping: false });
}

// Send Image File
function sendImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file.');
    return;
  }

  // 8MB limit for WebSocket memory payload
  if (file.size > 8 * 1024 * 1024) {
    alert('Image is too large! Please choose an image under 8MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    socket.emit('send-message', {
      type: 'image',
      dataUrl: e.target.result,
      fileName: file.name || 'shared-image.png'
    });
  };
  reader.readAsDataURL(file);
}

const COPY_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

let toastTimeout;
function showToast(message = 'Copied to clipboard!') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

// Display a Message
function displayMessage(data) {
  const isSelf = data.id === currentSocketId;
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSelf ? 'sent' : 'received'}`;

  // Image Message
  if (data.type === 'image') {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'message-image-wrapper';

    const img = document.createElement('img');
    img.src = data.dataUrl;
    img.alt = data.fileName || 'Shared image';
    img.className = 'message-image';
    img.loading = 'lazy';
    img.addEventListener('click', () => openImageModal(data.dataUrl, data.fileName));

    const imageActions = document.createElement('div');
    imageActions.className = 'image-actions';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'image-time';
    timeSpan.textContent = data.timestamp || '';

    const downloadBtn = document.createElement('a');
    downloadBtn.href = data.dataUrl;
    downloadBtn.download = data.fileName || 'download.png';
    downloadBtn.className = 'action-btn';
    downloadBtn.innerHTML = '⬇ Download';

    imageActions.appendChild(timeSpan);
    imageActions.appendChild(downloadBtn);

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(imageActions);
    messageDiv.appendChild(imgWrapper);
  } else {
    // Text Message
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.title = 'Double-click to copy';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatText(data.text);

    // Footer with time and subtle copy icon button
    const footerDiv = document.createElement('div');
    footerDiv.className = 'message-footer';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = data.timestamp || '';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-icon-btn';
    copyBtn.setAttribute('title', 'Copy text');
    copyBtn.setAttribute('aria-label', 'Copy to clipboard');
    copyBtn.innerHTML = COPY_SVG;

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(data.text, copyBtn);
    });

    // Double click bubble to copy shortcut
    bubbleDiv.addEventListener('dblclick', () => {
      copyToClipboard(data.text, copyBtn);
    });

    footerDiv.appendChild(timeSpan);
    footerDiv.appendChild(copyBtn);

    bubbleDiv.appendChild(contentDiv);
    bubbleDiv.appendChild(footerDiv);
    messageDiv.appendChild(bubbleDiv);
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showEmptyState() {
  messagesContainer.innerHTML = `
    <div class="empty-state" id="emptyState">
      <div class="empty-icon">⚡</div>
      <h3>Quick Share Ready</h3>
      <p>Send text, paste an image (Ctrl+V), or drag & drop files here.</p>
    </div>
  `;
}

// Helper: Escape HTML & turn URLs into clickable links
function formatText(rawText) {
  const div = document.createElement('div');
  div.textContent = rawText;
  const escaped = div.innerHTML;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

// Helper: Copy to clipboard with SVG feedback and Toast
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.innerHTML = CHECK_SVG;
    btn.classList.add('copied');
    showToast('Copied to clipboard!');
    setTimeout(() => {
      btn.innerHTML = COPY_SVG;
      btn.classList.remove('copied');
    }, 1500);
  } catch (err) {
    // Fallback for older browsers or non-HTTPS contexts
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    btn.innerHTML = CHECK_SVG;
    btn.classList.add('copied');
    showToast('Copied to clipboard!');
    setTimeout(() => {
      btn.innerHTML = COPY_SVG;
      btn.classList.remove('copied');
    }, 1500);
  }
}

// Lightbox modal for images
function openImageModal(url, fileName) {
  modalImage.src = url;
  modalDownload.href = url;
  modalDownload.download = fileName || 'download.png';
  imageModal.classList.add('active');
}

modalClose.addEventListener('click', () => {
  imageModal.classList.remove('active');
});

imageModal.addEventListener('click', (e) => {
  if (e.target === imageModal) {
    imageModal.classList.remove('active');
  }
});

// Event Listeners: Input & Typing
sendBtn.addEventListener('click', sendTextMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendTextMessage();
  }
});

// Auto-expand textarea
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

  // Typing debounce
  clearTimeout(typingTimeout);
  socket.emit('user-typing', { isTyping: true });

  typingTimeout = setTimeout(() => {
    socket.emit('user-typing', { isTyping: false });
  }, 1000);
});

// Listen for typing events
socket.on('user-typing', (data) => {
  if (data.id === socket.id) return;

  if (data.isTyping) {
    typingUsers.add(data.id);
  } else {
    typingUsers.delete(data.id);
  }

  if (typingUsers.size > 0) {
    const text = typingUsers.size === 1 ? 'A device is typing' : `${typingUsers.size} devices are typing`;
    typingIndicator.innerHTML = `${text} <span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
  } else {
    typingIndicator.innerHTML = '';
  }
});

// Attachment button & file input
attachBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    sendImageFile(e.target.files[0]);
    fileInput.value = ''; // Reset so same file can be selected again
  }
});

// Clipboard Paste listener (Ctrl + V anywhere)
window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        sendImageFile(file);
        e.preventDefault();
        break;
      }
    }
  }
});

// Drag and Drop files onto page
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    dropOverlay.classList.remove('active');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('active');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      sendImageFile(file);
    } else {
      alert('Currently only images can be dropped.');
    }
  }
});

// Clear chat button
clearBtn.addEventListener('click', () => {
  if (confirm('Clear chat history on all connected devices?')) {
    socket.emit('clear-chat');
  }
});
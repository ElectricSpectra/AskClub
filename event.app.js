import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC_zoFsf2si_jALnjIcdufL0jrQECPV-zQ",
    authDomain: "askclub-1dc6b.firebaseapp.com",
    projectId: "askclub-1dc6b",
    storageBucket: "askclub-1dc6b.firebasestorage.app",
    messagingSenderId: "243803377977",
    appId: "1:243803377977:web:61ed1834e3dbb95f9418e8",
    measurementId: "G-T43QSGLYMG"
};

const config = {
    GEMINI_API_KEY: 'AIzaSyCfc4CJC0JhpsvnHI_fppINOS6hD7gsztk',
    PDF_WORKER_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Chat Service
class ChatService {
    constructor() {
        this.chats = {};
        this.currentChatId = null;
    }

    async createChat(name, context, userId, youtubeLink) {
        const chatData = {
            name,
            context,
            userId,
            youtubeLink: youtubeLink || null,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "events"), chatData);
        this.currentChatId = docRef.id;
        return docRef.id;
    }

    async getChats() {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
    
        this.chats = {};
        for (const doc of snapshot.docs) {
            const chat = { id: doc.id, ...doc.data() };
            this.chats[doc.id] = chat;
        }
    }
    
    async listenToChatMessages(chatId, callback) {
        const messagesRef = collection(db, "events", chatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));

        onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            callback(messages);
        });
    }

    getCurrentChat() {
        return this.currentChatId ? this.chats[this.currentChatId] : null;
    }

    setCurrentChat(chatId) {
        this.currentChatId = chatId;
    }

    async addMessage(text, sender) {
        const chat = this.getCurrentChat();
        if (!chat) return;

        const messagesRef = collection(db, "events", chat.id || this.currentChatId, "messages");
        const newMessage = {
            sender,
            text,
            timestamp: serverTimestamp()
        };

        // Add the user's message
        await addDoc(messagesRef, newMessage);

        // Generate AI response if the sender is a user
        if (sender === "user") {
            try {
                const response = await ApiUtils.getChatbotResponse(text, chat.context);
                const botMessage = {
                    sender: "chatbot",
                    text: response,
                    timestamp: serverTimestamp()
                };

                // Add AI's response to Firestore
                await addDoc(messagesRef, botMessage);
            } catch (error) {
                console.error("Failed to generate AI response:", error);
                const errorMessage = {
                    sender: "chatbot",
                    text: "Sorry, I couldn't process your request.",
                    timestamp: serverTimestamp()
                };

                await addDoc(messagesRef, errorMessage);
            }
        }
    }

    async deleteChat(chatId) {
        try {
            await deleteDoc(doc(db, "events", chatId)); // Delete the chat
            delete this.chats[chatId]; // Remove from local cache
        } catch (error) {
            console.error("Error deleting chat:", error);
        }
    }
    
}

// Chat List Renderer
class ChatListRenderer {
    constructor() {
        this.container = document.getElementById('chatList');
    }

    render(chats, currentChatId) {
        this.container.innerHTML = '';
        Object.values(chats).forEach((chat) => {
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item${chat.id === currentChatId ? ' active' : ''}`;
            chatElement.textContent = chat.name;
            chatElement.dataset.chatId = chat.id;

            // Create delete button (initially hidden)
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.style.display = 'none'; // Hidden by default
            deleteBtn.dataset.chatId = chat.id;
            chatElement.appendChild(deleteBtn);

            this.container.appendChild(chatElement);
        });

        // Show delete buttons for admin only
        this.showDeleteButtonsForAdmin();
    }

    showDeleteButtonsForAdmin() {
        const user = auth.currentUser; // Ensure we know the current user
        if (user && user.email === "sohansoma2806@gmail.com") {
            const deleteButtons = this.container.querySelectorAll('.delete-chat-btn');
            deleteButtons.forEach((btn) => (btn.style.display = 'inline-block'));
        }
    }

    onClick(callback) {
        this.container.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem) callback(chatItem.dataset.chatId);
        });
    }

    onDeleteClick(callback) {
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-chat-btn')) {
                const chatId = e.target.dataset.chatId;
                callback(chatId);
            }
        });
    }
}


// Message Renderer
// Updated constructor
class MessageRenderer {
    constructor() {
        this.videoContainer = document.getElementById('videoPlayer'); // Video Player Section
        this.messagesList = document.getElementById('messagesList');
        this.emptyState = document.getElementById('emptyChatState');
        this.chatName = document.getElementById('currentChatName');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.container = document.getElementById('chatContent'); // Ensure this references the correct element
        this.youtubeIframe = document.getElementById('ytPlayer'); // YouTube iframe reference
    }

    showChat(chat) {
        if (!chat) {
            // Handle empty chat case
            if (this.container) this.container.classList.add('hidden');
            if (this.emptyState) this.emptyState.classList.remove('hidden');
            if (this.youtubeIframe) this.youtubeIframe.src = ''; // Clear the YouTube iframe
            return;
        }

        // Display chat content
        if (this.container) this.container.classList.remove('hidden');
        if (this.emptyState) this.emptyState.classList.add('hidden');
        if (this.chatName) this.chatName.textContent = chat.name || "Untitled Chat";

        // Load YouTube video if link exists
        if (this.youtubeIframe && chat.youtubeLink) {
            const videoId = this.extractVideoId(chat.youtubeLink);
            this.youtubeIframe.src = videoId
                ? `https://www.youtube.com/embed/${videoId}`
                : '';
        }

        // Render messages
        this.renderMessages(chat.messages || []);
    }

    renderMessages(messages) {
        this.messagesList.innerHTML = '';
        messages.forEach((message) => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.sender}`;
            messageElement.textContent = message.text;
            this.messagesList.appendChild(messageElement);
        });
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.messagesList && this.messagesList.parentElement) {
            this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
        }
    }

    extractVideoId(youtubeLink) {
        // Extract YouTube video ID from URL
        const regex = /(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = youtubeLink.match(regex);
        return match ? match[1] : null;
    }

    onSendMessage(callback) {
        if (this.messageForm) {
            this.messageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = this.messageInput.value.trim();
                if (message) {
                    this.messageInput.value = '';
                    await callback(message);
                }
            });
        }
    }
}


// Modal Manager
class ModalManager {
    constructor() {
        this.modal = document.getElementById('createChatModal');
        this.form = document.getElementById('createChatForm');
        this.nameInput = document.getElementById('chatNameInput');
        this.fileInput = document.getElementById('pdfUpload');

        document.getElementById('createChatBtn').addEventListener('click', () => this.show());
        document.getElementById('closeModal').addEventListener('click', () => this.hide());
        document.getElementById('cancelCreateChat').addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });
    }

    show() {
        this.modal.classList.remove('hidden');
    }

    hide() {
        this.modal.classList.add('hidden');
        this.form.reset();
    }

    onSubmit(callback) {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = this.nameInput.value;
            const file = this.fileInput.files[0];
            const youtubeLink = document.getElementById('youtubeLinkInput').value.trim();
            if (name && (file || youtubeLink)) {
                await callback(name, file, youtubeLink);
                this.hide();
            }
        });
    }
}

// PDF Utils
class PdfUtils {
    static async extractText(file) {
        const typedArray = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let text = '';
        for (let page = 1; page <= pdf.numPages; page++) {
            const content = await pdf.getPage(page).then((p) => p.getTextContent());
            text += content.items.map((i) => i.str).join(' ') + '\n\n';
        }
        return text.trim();
    }
}

// Main App
class App {
    constructor() {
        this.chatService = new ChatService();
        this.modalManager = new ModalManager();
        this.messageRenderer = new MessageRenderer();
        this.chatListRenderer = new ChatListRenderer();

        this.setupEventHandlers();
    }

    async init() {
        await this.chatService.getChats(); // No filtering
        this.updateUI();
    
        // Listen for real-time updates for the current chat
        const currentChatId = this.chatService.currentChatId;
        if (currentChatId) {
            this.chatService.listenToChatMessages(currentChatId, (messages) => {
                this.chatService.chats[currentChatId].messages = messages;
                this.updateUI();
            });
        }
    }    

    setupEventHandlers() {
        this.modalManager.onSubmit(async (name, file, youtubeLink) => {
            const extractedText = file ? await PdfUtils.extractText(file) : "";
            await this.chatService.createChat(name, extractedText, auth.currentUser.uid, youtubeLink);
            this.updateUI();
        });
    
        this.chatListRenderer.onClick((chatId) => {
            this.chatService.setCurrentChat(chatId);
            this.chatService.listenToChatMessages(chatId, (messages) => {
                this.chatService.chats[chatId].messages = messages;
                this.updateUI();
            });
        });
    
        this.chatListRenderer.onDeleteClick(async (chatId) => {
            const confirmed = confirm("Are you sure you want to delete this chat?");
            if (confirmed) {
                await this.chatService.deleteChat(chatId);
                this.updateUI();
            }
        });
    
        this.messageRenderer.onSendMessage(async (message) => {
            await this.chatService.addMessage(message, "user");
            this.updateUI();
        });
    }
    

    updateUI() {
        const currentChat = this.chatService.getCurrentChat();
        this.chatListRenderer.render(this.chatService.chats, this.chatService.currentChatId);
        this.messageRenderer.showChat(currentChat);
    }
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        const createChatBtn = document.getElementById('createChatBtn');
        if (user) {
            if (user.email === "sohansoma2806@gmail.com") {
                createChatBtn.style.display = "block"; // Show button for admin
            } else {
                createChatBtn.style.display = "none"; // Hide button for others
            }
            const appInstance = new App();
            appInstance.init(user.uid);
        } else {
            window.location.href = "/login.html";
        }
    });
});


// API Utils
class ApiUtils {
    static async getChatbotResponse(query, context) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.GEMINI_API_KEY}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: `Context: ${context}\n\nQuestion: ${query}\n\nProvide a helpful and concise answer based on the given context.`
                }]
            }]
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error('Failed to get chatbot response');
        }
    }
}

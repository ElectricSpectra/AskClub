import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, onSnapshot
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

    async createChat(name, context, userId) {
        const chatData = {
            name,
            context,
            userId,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "feed"), chatData);
        this.currentChatId = docRef.id;
        return docRef.id;
    }

    async getChats(userId) {
        const q = query(collection(db, "feed"), where("userId", "==", userId));
        const snapshot = await getDocs(q);

        this.chats = {};
        for (const doc of snapshot.docs) {
            const chat = { id: doc.id, ...doc.data() };
            this.chats[doc.id] = chat;
        }
    }

    async listenToChatMessages(chatId, callback) {
        const messagesRef = collection(db, "feed", chatId, "messages");
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

        const messagesRef = collection(db, "feed", chat.id, "messages");
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

                // Add AI's response to the Firestore
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
            chatElement.dataset.chatId = chat.id;
    
            // Flex container
            const flexContainer = document.createElement('div');
            flexContainer.className = 'chat-item-container';
    
            // Chat name
            const chatName = document.createElement('span');
            chatName.textContent = chat.name;
    
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '❌';
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.onclick = () => this.handleDeleteChat(chat.id);
    
            flexContainer.appendChild(chatName);
            flexContainer.appendChild(deleteBtn);
            chatElement.appendChild(flexContainer);
            this.container.appendChild(chatElement);
        });
    }
    
    handleDeleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            deleteChatFromDB(chatId);
        }
    }
    
    onClick(callback) {
        this.container.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem) callback(chatItem.dataset.chatId);
        });
    }
}


// Message Renderer
class MessageRenderer {
    constructor() {
        this.container = document.getElementById('chatContent');
        this.messagesList = document.getElementById('messagesList');
        this.emptyState = document.getElementById('emptyChatState');
        this.chatName = document.getElementById('currentChatName');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
    }

    showChat(chat) {
        if (!chat) {
            this.container.classList.add('hidden');
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.container.classList.remove('hidden');
        this.emptyState.classList.add('hidden');
        this.chatName.textContent = chat.name;
        this.renderMessages(chat.messages);
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
        this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
    }

    onSendMessage(callback) {
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
            if (name && file) {
                await callback(name, file);
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

    async init(userId) {
        await this.chatService.getChats(userId);
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
        this.modalManager.onSubmit(async (name, file) => {
            const extractedText = await PdfUtils.extractText(file);
            await this.chatService.createChat(name, extractedText, auth.currentUser.uid);
            this.updateUI();
        });

        this.chatListRenderer.onClick((chatId) => {
            this.chatService.setCurrentChat(chatId);
            this.chatService.listenToChatMessages(chatId, (messages) => {
                this.chatService.chats[chatId].messages = messages;
                this.updateUI();
            });
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
        if (user) {
            const appInstance = new App();
            appInstance.init(user.uid);
        } else {
            window.location.href = "/index.html";
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

async function deleteChatFromDB(chatId) {
    try {
        const chatRef = doc(db, "feed", chatId);
        await deleteDoc(chatRef);
        alert("Chat deleted successfully.");
        location.reload(); // Refresh UI to reflect changes
    } catch (error) {
        console.error("Error deleting chat:", error);
        alert("Failed to delete the chat.");
    }
}

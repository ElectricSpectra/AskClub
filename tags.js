import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC_zoFsf2si_jALnjIcdufL0jrQECPV-zQ",
    authDomain: "askclub-1dc6b.firebaseapp.com",
    projectId: "askclub-1dc6b",
    storageBucket: "askclub-1dc6b.firebasestorage.app",
    messagingSenderId: "243803377977",
    appId: "1:243803377977:web:61ed1834e3dbb95f9418e8",
    measurementId: "G-T43QSGLYMG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const tagsContainer = document.getElementById("tagsContainer");
const questionsContainer = document.getElementById("questionsContainer");
const questionsHeader = document.getElementById("questionsHeader");

function formatTimestamp(date) {
    if (!date) return 'Unknown time';
    const now = new Date();
    const timestamp = date.toDate();
    const diffInSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

async function fetchTags() {
    const tags = new Map();
    const postsSnapshot = await getDocs(collection(db, "posts"));
    
    postsSnapshot.forEach((doc) => {
        const postTags = doc.data().tags || [];
        postTags.forEach((tag) => {
            tags.set(tag, (tags.get(tag) || 0) + 1);
        });
    });

    return Array.from(tags.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

async function fetchQuestionsByTag(tag) {
    try {
        // Simplified query without orderBy to avoid requiring composite index
        const postsQuery = query(
            collection(db, "posts"),
            where("tags", "array-contains", tag)
        );
        
        const postsSnapshot = await getDocs(postsQuery);
        const questions = postsSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));

        // Sort on client side instead
        return questions.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
    } catch (error) {
        console.error("Error fetching questions:", error);
        showError("Error loading questions. Please try again later.");
        return [];
    }
}

function showError(message) {
    questionsContainer.innerHTML = `
        <div class="error-message">
            ${message}
        </div>
    `;
}

function showLoading() {
    questionsContainer.innerHTML = `
        <div class="loading-message">
            Loading questions...
        </div>
    `;
}

function renderTags(tags) {
    tagsContainer.innerHTML = tags.map(tag => `
        <div class="tag-card" data-tag="${tag.name}">
            <div class="tag-name">${tag.name}</div>
            <div class="tag-count">${tag.count} question${tag.count !== 1 ? 's' : ''}</div>
        </div>
    `).join('');

    document.querySelectorAll('.tag-card').forEach(card => {
        card.addEventListener('click', () => {
            loadQuestionsForTag(card.dataset.tag);
        });
    });
}

function renderQuestions(questions, tagName) {
    if (questions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="no-questions-message">
                No questions found for tag [${tagName}]
            </div>
        `;
        return;
    }

    questionsHeader.textContent = `Questions tagged [${tagName}]`;
    questionsContainer.innerHTML = questions.map(question => `
        <div class="question-card" data-id="${question.id}">
            <div class="question-metadata">
                <span class="question-author">${question.author || 'Anonymous'}</span>
                <span class="question-timestamp">${formatTimestamp(question.timestamp)}</span>
            </div>
            <div class="question-title">${question.title || 'Untitled Question'}</div>
            <div class="question-snippet">${question.content ? question.content.substring(0, 150) + '...' : 'No content available'}</div>
            <div class="question-tags">
                ${(question.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.question-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `fullpost.html?postId=${card.dataset.id}`;
        });
    });
}

async function loadQuestionsForTag(tag) {
    showLoading();
    const questions = await fetchQuestionsByTag(tag);
    renderQuestions(questions, tag);
    questionsContainer.scrollIntoView({ behavior: 'smooth' });
}

async function initializeTagsPage() {
    try {
        const tags = await fetchTags();
        renderTags(tags);
    } catch (error) {
        console.error("Error initializing tags page:", error);
        showError("Error loading tags. Please refresh the page to try again.");
    }
}

function filterTags() {
    const searchInput = document.getElementById("tagSearchInput").value.toLowerCase();
    const tagCards = document.querySelectorAll('.tag-card');

    tagCards.forEach(card => {
        const tagName = card.querySelector('.tag-name').textContent.toLowerCase();
        if (tagName.includes(searchInput)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}
window.filterTags = filterTags
document.addEventListener('DOMContentLoaded', initializeTagsPage);

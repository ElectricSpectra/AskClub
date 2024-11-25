import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";

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
const auth = getAuth(app);

async function fetchUserQuestions() {
    const questionsContainer = document.getElementById('my-questions');
    
    if (!auth.currentUser) {
        questionsContainer.innerHTML = '<p>Please sign in to view your questions.</p>';
        return;
    }

    try {
        // First, create a simple query without ordering
        const q = query(
            collection(db, "posts"),
            where("authorId", "==", auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const questions = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            // Sort the results in memory instead of using orderBy
            .sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());

        if (questions.length === 0) {
            questionsContainer.innerHTML = '<p>You haven\'t asked any questions yet.</p>';
            return;
        }

        questionsContainer.innerHTML = questions.map(question => `
            <div class="post-card">
                <div class="post-metadata">
                    <span class="post-author">${question.author || 'Anonymous'}</span>
                    <span class="timestamp">${formatTimestamp(question.timestamp)}</span>
                </div>
                <div class="post-title">${question.title || 'Untitled'}</div>
                ${question.tags ? `<div class="post-tags">${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
                <p class="post-snippet">${(question.content || '').substring(0, 200)}...</p>
                <div class="post-actions">
                    <button class="vote-button">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 4l-7 7h5v8h4v-8h5z"/>
                        </svg>
                        <span class="vote-count">${(question.upvotes || 0) - (question.downvotes || 0)}</span>
                    </button>
                    ${question.hasAnswers ? '<span class="has-answers">Has Answers</span>' : ''}
                    ${question.flagged ? '<span class="flagged">Flagged for Review</span>' : ''}
                </div>
            </div>
        `).join('');

        // Add click event to view full questions
        document.querySelectorAll('.post-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                // Prevent navigation if clicking on buttons
                if (!e.target.closest('.vote-button')) {
                    window.location.href = `fullpost.html?postId=${questions[index].id}`;
                }
            });
        });

    } catch (error) {
        console.error("Error fetching questions:", error);
        questionsContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading questions. Please try again later.</p>
                <button onclick="window.location.reload()">Retry</button>
            </div>`;
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    const date = timestamp.toDate();
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Initialize the page
onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchUserQuestions();
    } else {
        const questionsContainer = document.getElementById('my-questions');
        questionsContainer.innerHTML = '<p>Please sign in to view your questions.</p>';
    }
});
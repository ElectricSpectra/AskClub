// Firebase imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC_zoFsf2si_jALnjIcdufL0jrQECPV-zQ",
    authDomain: "askclub-1dc6b.firebaseapp.com",
    projectId: "askclub-1dc6b",
    storageBucket: "askclub-1dc6b.firebasestorage.app",
    messagingSenderId: "243803377977",
    appId: "1:243803377977:web:61ed1834e3dbb95f9418e8",
    measurementId: "G-T43QSGLYMG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let posts = [];
let currentFilter = 'newest';
let searchQuery = '';

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        console.log("User signed in:", currentUser);
    }
});

async function createPost(title, content, tags) {
    if (!currentUser) {
        console.error("No user signed in. Cannot create post.");
        return;
    }

    const displayName = currentUser.displayName || `User${Math.floor(Math.random() * 1000)}`;
    const userId = currentUser.uid;

    const toxicityScore = await evaluateContent(content);
    const flagged = toxicityScore && toxicityScore >= 0.7;

    const docRef = await addDoc(collection(db, "posts"), {
        title,
        content,
        tags: tags || [],
        author: displayName,
        authorId: userId,
        timestamp: new Date(),
        upvotes: 0,
        downvotes: 0,
        votedBy: {},
        flagged,
        moderationReason: flagged ? "High toxicity score" : null,
        hasAnswers: false
    });
    
    const postId = docRef.id; // This is the Firestore-generated post ID
    console.log("Post created with ID:", postId);

    if (flagged) {
        await addDoc(collection(db, "moderationQueue"), {
            type: "Question",
            content,
            author: displayName,
            authorId: userId,
            timestamp: new Date(),
            reason: "High toxicity score",
            postId: postId, // Include the postId in the moderation queue
        });
    }

    fetchPosts();
}

async function fetchPosts() {
    let querySnapshot;
    const postsRef = collection(db, "posts");
    
    switch(currentFilter) {
        case 'newest':
            querySnapshot = await getDocs(query(postsRef, orderBy("timestamp", "desc")));
            break;
        case 'oldest':
            querySnapshot = await getDocs(query(postsRef, orderBy("timestamp", "asc")));
            break;
        case 'highly-rated':
            querySnapshot = await getDocs(query(postsRef, orderBy("upvotes", "desc")));
            break;
        case 'unanswered':
            querySnapshot = await getDocs(query(postsRef, where("hasAnswers", "==", false)));
            break;
        default:
            querySnapshot = await getDocs(query(postsRef, orderBy("timestamp", "desc")));
    }

    posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        posts = posts.filter(post => 
            post.title.toLowerCase().includes(searchLower) || 
            post.content.toLowerCase().includes(searchLower) ||
            post.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
    }
    
    renderPosts();
}

async function evaluateContent(content) {
    const apiKey = "AIzaSyBwL_ph76hgqZc-hdbPsuww1HY4o0oOhx4";
    const apiUrl = "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" + apiKey;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                comment: { text: content },
                languages: ["en"],
                requestedAttributes: { TOXICITY: {} }
            }),
        });

        if (!response.ok) throw new Error("Error calling Perspective API");
        const data = await response.json();
        return data.attributeScores.TOXICITY.summaryScore.value;
    } catch (error) {
        console.error("Perspective API Error:", error);
        return null;
    }
}

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

function highlightSearchTerms(text) {
    if (!searchQuery) return text;
    const searchLower = searchQuery.toLowerCase();
    const textLower = text.toLowerCase();
    let lastIndex = 0;
    let result = '';
    
    while (true) {
        const index = textLower.indexOf(searchLower, lastIndex);
        if (index === -1) {
            result += text.slice(lastIndex);
            break;
        }
        result += text.slice(lastIndex, index);
        result += `<span class="search-highlight">${text.slice(index, index + searchQuery.length)}</span>`;
        lastIndex = index + searchQuery.length;
    }
    
    return result;
}

function renderPosts() {
    const postsContainer = document.getElementById('posts');
    postsContainer.innerHTML = '';

    posts.forEach(post => {
        const voteCount = (post.upvotes || 0) - (post.downvotes || 0);
        const timestamp = post.timestamp ? formatTimestamp(post.timestamp) : 'Unknown time';
        
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        const tagsHtml = post.tags && post.tags.length > 0 
            ? `<div class="post-tags">${post.tags.map(tag => `<span class="tag">${highlightSearchTerms(tag)}</span>`).join('')}</div>`
            : '';
        
        postElement.innerHTML = `
            <div class="post-metadata">
                <span class="post-author">${post.author || 'Anonymous'}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="post-title">${highlightSearchTerms(post.title)}</div>
            ${tagsHtml}
            <p class="post-snippet">${highlightSearchTerms(post.content.substring(0, 100))}...</p>
            <div class="post-actions">
                <button class="vote-button upvote-button" ${!currentUser ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-7 7h5v8h4v-8h5z"/></svg>
                    <span class="vote-count">${voteCount}</span>
                </button>
                <button class="vote-button downvote-button" ${!currentUser ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l7-7h-5v-8h-4v8h-5z"/></svg>
                </button>
                <button class="comment-button">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2h-16c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2zm0 16h-5.17l-2.83 2.83-2.83-2.83h-5.17v-14h16v14z"/></svg>
                    <span>Comment</span>
                </button>
                <button class="report-button" onclick="event.stopPropagation(); reportContent('Question', '${post.id}', '${post.content}')">Report</button>
            </div>
        `;

        postElement.addEventListener('click', (e) => {
            if (!e.target.closest('.vote-button') && !e.target.closest('.comment-button')) {
                window.location.href = `fullpost.html?postId=${post.id}`;
            }
        });

        const upvoteBtn = postElement.querySelector('.upvote-button');
        const downvoteBtn = postElement.querySelector('.downvote-button');

        upvoteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                alert('Please sign in to vote');
                return;
            }
            const postRef = doc(db, "posts", post.id);
            const postDoc = await getDoc(postRef);
            const postData = postDoc.data();
            const votedBy = postData.votedBy || {};
            const userVote = votedBy[currentUser.uid];

            if (userVote === 'upvote') {
                await updateDoc(postRef, {
                    upvotes: (postData.upvotes || 0) - 1,
                    [`votedBy.${currentUser.uid}`]: null
                });
            } else {
                const updates = {
                    upvotes: (postData.upvotes || 0) + 1,
                    [`votedBy.${currentUser.uid}`]: 'upvote'
                };
                if (userVote === 'downvote') {
                    updates.downvotes = (postData.downvotes || 0) - 1;
                }
                await updateDoc(postRef, updates);
            }
            fetchPosts();
        });

        downvoteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                alert('Please sign in to vote');
                return;
            }
            const postRef = doc(db, "posts", post.id);
            const postDoc = await getDoc(postRef);
            const postData = postDoc.data();
            const votedBy = postData.votedBy || {};
            const userVote = votedBy[currentUser.uid];

            if (userVote === 'downvote') {
                await updateDoc(postRef, {
                    downvotes: (postData.downvotes || 0) - 1,
                    [`votedBy.${currentUser.uid}`]: null
                });
            } else {
                const updates = {
                    downvotes: (postData.downvotes || 0) + 1,
                    [`votedBy.${currentUser.uid}`]: 'downvote'
                };
                if (userVote === 'upvote') {
                    updates.upvotes = (postData.upvotes || 0) - 1;
                }
                await updateDoc(postRef, updates);
            }
            fetchPosts();
        });

        postsContainer.appendChild(postElement);
    });
}

function initializeSearchAndFilter() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'searchInput';
    searchInput.placeholder = 'Search questions...';
    searchInput.className = 'search-input';

    const filterSelect = document.createElement('select');
    filterSelect.id = 'filterSelect';
    filterSelect.className = 'filter-select';
    
    const filterOptions = [
        { value: 'newest', text: 'Newest First' },
        { value: 'oldest', text: 'Oldest First' },
        { value: 'highly-rated', text: 'Highly Rated' },
        { value: 'unanswered', text: 'Unanswered' }
    ];

    filterOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        filterSelect.appendChild(optionElement);
    });

    const searchFilterContainer = document.createElement('div');
    searchFilterContainer.className = 'search-filter-container';
    searchFilterContainer.appendChild(searchInput);
    searchFilterContainer.appendChild(filterSelect);

    const header = document.querySelector('header');
    header.parentNode.insertBefore(searchFilterContainer, header.nextSibling);

    searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value;
        fetchPosts();
    }, 300));

    filterSelect.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        fetchPosts();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initializeSearchAndFilter();
    
    const tagInput = document.getElementById('tagInput');
    const tagContainer = document.getElementById('tagContainer');
    const tags = new Set();

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.value.trim().toLowerCase();
            if (tag && !tags.has(tag)) {
                tags.add(tag);
                renderTags();
            }
            tagInput.value = '';
        }
    });

    function renderTags() {
        tagContainer.innerHTML = '';
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.innerHTML = `
                ${tag}
                <button class="tag-remove" onclick="event.preventDefault(); this.parentElement.remove(); tags.delete('${tag}');">×</button>
            `;
            tagContainer.appendChild(tagElement);
        });
    }

    document.getElementById('newPostBtn').addEventListener('click', () => {
        document.getElementById('createPostForm').classList.toggle('hidden');
    });

    document.getElementById('submitPost').addEventListener('click', async () => {
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        
        if (title && content) {
            await createPost(title, content, Array.from(tags));
            document.getElementById('postTitle').value = '';
            document.getElementById('postContent').value = '';
            tagContainer.innerHTML = '';
            tags.clear();
            document.getElementById('createPostForm').classList.add('hidden');
        }
    });

    fetchPosts();
});

// Global exports for functions used in HTML
window.reportContent = async (type, id, content) => {
    const reason = prompt(`Why are you reporting this ${type.toLowerCase()}?`);
    if (!reason) return;

    try {
        const moderationData = {
            type,
            content,
            reason,
            reportedBy: currentUser ? currentUser.displayName : "Anonymous",
            timestamp: new Date(),
            flaggedByUser: true,
        };

        // Add postId for questions
        if (type === "Question") moderationData.postId = id;

        await addDoc(collection(db, "moderationQueue"), moderationData);

        alert(`${type} reported successfully. Thank you for your feedback.`);
    } catch (error) {
        console.error("Error reporting content:", error);
        alert("Error reporting content. Please try again later.");
    }
};

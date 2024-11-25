import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, doc, deleteDoc, getDoc, collection, addDoc, getDocs, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";
import { fetchGeminiAnswer } from './aiService.js';

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

async function reportContent(type, id, content, answerId = null, replyId = null) {
    const reason = prompt(`Why are you reporting this ${type.toLowerCase()}?`);
    if (!reason) return;

    try {
        const moderationData = {
            type,
            content,
            reason,
            reportedBy: currentUser ? currentUser.displayName : "Anonymous",
            authorId: currentUser ? currentUser.uid : null,
            timestamp: new Date(),
            flaggedByUser: true,
            postId, // Ensure postId is always included
        };

        // Add answerId and replyId for corresponding content types
        if (type === "Answer") moderationData.answerId = id; // `id` represents `answerId` for answers
        if (type === "Reply") {
            moderationData.answerId = answerId;
            moderationData.replyId = id; // `id` represents `replyId` for replies
        }

        await addDoc(collection(db, "moderationQueue"), moderationData);

        alert(`${type} reported successfully. Thank you for your feedback.`);
    } catch (error) {
        console.error("Error reporting content:", error);
        alert("Error reporting content. Please try again later.");
    }
}

// Expose the function globally for use in HTML
window.reportContent = reportContent;


let currentUser;

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('postId');

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("User signed in:", currentUser);
        setDefaultDisplayName();
    } else {
        console.log("No user signed in");
    }
});

async function setDefaultDisplayName() {
    if (currentUser && !currentUser.displayName) {
        try {
            await updateProfile(currentUser, {
                displayName: "User" + Math.floor(Math.random() * 1000)
            });
            console.log("Updated display name to:", currentUser.displayName);
        } catch (error) {
            console.error("Error setting default display name:", error);
        }
    }
}

async function deleteDocument(path) {
    if (!currentUser) {
        alert('Please sign in to delete');
        return;
    }

    try {
        const docRef = doc(db, path);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.data().authorId !== currentUser.uid) {
            alert('You can only delete your own posts');
            return;
        }

        await deleteDoc(docRef);
        if (path.startsWith('posts/') && path.split('/').length === 2) {
            window.location.href = 'mainpage.html';
        } else {
            fetchPostDetails();
        }
    } catch (error) {
        console.error("Error deleting document:", error);
        alert('Error deleting document');
    }
}

async function fetchPostDetails() {
    try {
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            console.error("No such document!");
            return;
        }
        const post = { id: postDoc.id, ...postDoc.data() };
        const answers = await fetchAnswers(postId);

        // Render the post details
        renderPostDetails(post, answers);

        // Fetch AI Answer based on the post content
        const aiAnswer = await fetchGeminiAnswer(post.content);
        renderAIAnswer(aiAnswer); // Display AI Answer
    } catch (error) {
        console.error("Error fetching post details:", error);
    }
}

// Function to render the AI Answer on the page
function renderAIAnswer(aiAnswer) {
    const postDetailsContainer = document.getElementById('postDetails');
    const aiAnswerHTML = `
        <div class="ai-answer">
            <h3>AI Generated Answer:</h3>
            <p>${aiAnswer}</p>
        </div>
    `;
    postDetailsContainer.insertAdjacentHTML('beforeend', aiAnswerHTML);
}

async function fetchAnswers(postId) {
    const answersCollectionRef = collection(db, "posts", postId, "answers");
    const querySnapshot = await getDocs(query(answersCollectionRef, orderBy("upvotes", "desc")));
    const answers = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
            const answer = { id: doc.id, ...doc.data() };
            answer.replies = await fetchReplies(postId, answer.id);
            return answer;
        })
    );
    return answers.sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
}

async function fetchReplies(postId, answerId) {
    const repliesCollectionRef = collection(db, "posts", postId, "answers", answerId, "replies");
    const querySnapshot = await getDocs(query(repliesCollectionRef, orderBy("upvotes", "desc")));
    const replies = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return replies.sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
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

async function addAnswer(content) {
    if (!currentUser) {
        alert('Please sign in to answer');
        return;
    }
    if (!content.trim()) {
        alert('Please enter some content');
        return;
    }

    const toxicityScore = await evaluateContent(content);
    const flagged = toxicityScore && toxicityScore >= 0.7;

    try {
        // Add the answer to the "answers" subcollection
        const answerRef = await addDoc(collection(db, "posts", postId, "answers"), {
            content,
            author: currentUser.displayName || "Anonymous",
            authorId: currentUser.uid,
            authorEmail: currentUser.email,
            timestamp: new Date(),
            upvotes: 0,
            downvotes: 0,
            votedBy: {},
            flagged,
            moderationReason: flagged ? "High toxicity score" : null,
        });

        // Fetch the question to get its author's details
        const questionDoc = await getDoc(doc(db, "posts", postId));
        if (questionDoc.exists()) {
            const questionData = questionDoc.data();
            const questionAuthorId = questionData.authorId;

            // Add a notification for the question's author if it's not the same user
            if (questionAuthorId !== currentUser.uid) {
                await addDoc(collection(db, "notifications"), {
                    userId: questionAuthorId,
                    type: 'answer',
                    questionTitle: questionData.title,
                    
                    postId: postId,
                    timestamp: new Date(),
                    read: false,
                    message: "Someone answered your question"
                });
                console.log("Notification created for the question's author.");
            }
        }

        // Refresh the post details to display the new answer
        fetchPostDetails();
    } catch (error) {
        console.error("Error adding answer or creating notification:", error);
        alert('Error adding answer');
    }
}


async function addReply(answerId, content) {
    if (!currentUser) {
        alert('Please sign in to reply');
        return;
    }
    if (!content.trim()) {
        alert('Please enter some content');
        return;
    }

    const toxicityScore = await evaluateContent(content);
    const flagged = toxicityScore && toxicityScore >= 0.7;

    try {
        // Add the reply to the "replies" subcollection
        const replyRef = await addDoc(collection(db, "posts", postId, "answers", answerId, "replies"), {
            content,
            author: currentUser.displayName || "Anonymous",
            authorId: currentUser.uid,
            authorEmail: currentUser.email,
            timestamp: new Date(),
            upvotes: 0,
            downvotes: 0,
            votedBy: {},
            flagged,
            moderationReason: flagged ? "High toxicity score" : null,
        });

        // Fetch the answer to get its author's details
        const answerDoc = await getDoc(doc(db, "posts", postId, "answers", answerId));
        if (answerDoc.exists()) {
            const answerData = answerDoc.data();
            const answerAuthorId = answerData.authorId;

            // Add a notification for the answer's author if it's not the same user
            if (answerAuthorId !== currentUser.uid) {
                await addDoc(collection(db, "notifications"), {
                    userId: answerAuthorId,
                    type: 'reply',
                    questionTitle: answerData.content,
                    postId: postId,
                    answerId: answerId,
                    timestamp: new Date(),
                    read: false,
                    message: "Someone replied to your answer"
                });
                console.log("Notification created for the answer's author.");
            }
        }

        // Refresh the post details to display the new reply
        fetchPostDetails();
    } catch (error) {
        console.error("Error adding reply or creating notification:", error);
        alert('Error adding reply');
    }
}



async function vote(type, itemType, itemId, parentId = null) {
    if (!currentUser) {
        alert('Please sign in to vote');
        return;
    }

    let docRef;
    if (itemType === 'post') {
        docRef = doc(db, "posts", itemId);
    } else if (itemType === 'answer') {
        docRef = doc(db, "posts", postId, "answers", itemId);
    } else if (itemType === 'reply') {
        docRef = doc(db, "posts", postId, "answers", parentId, "replies", itemId);
    }

    try {
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        const votedBy = data.votedBy || {};
        const userVote = votedBy[currentUser.uid];

        if (type === userVote) {
            // Remove vote
            await updateDoc(docRef, {
                [type === 'upvote' ? 'upvotes' : 'downvotes']: (data[type === 'upvote' ? 'upvotes' : 'downvotes'] || 0) - 1,
                [`votedBy.${currentUser.uid}`]: null
            });
        } else {
            // Add new vote and remove opposite vote if exists
            const updates = {
                [type === 'upvote' ? 'upvotes' : 'downvotes']: (data[type === 'upvote' ? 'upvotes' : 'downvotes'] || 0) + 1,
                [`votedBy.${currentUser.uid}`]: type
            };
            if (userVote) {
                updates[userVote === 'upvote' ? 'upvotes' : 'downvotes'] = (data[userVote === 'upvote' ? 'upvotes' : 'downvotes'] || 0) - 1;
            }
            await updateDoc(docRef, updates);
        }
        fetchPostDetails();
    } catch (error) {
        console.error("Error voting:", error);
        alert('Error voting');
    }
}

function formatTimestamp(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function renderPostDetails(post, answers) {
    const ADMIN_EMAIL = "sohansoma2806@gmail.com"; // Admin email
    const postDetailsContainer = document.getElementById('postDetails');
    const voteCount = (post.upvotes || 0) - (post.downvotes || 0);

    const answersHTML = answers.map(answer => {
        console.log("Answer Data:", answer); // Debugging to check answer data
        const isAnswerAdmin = answer.authorEmail === ADMIN_EMAIL; // Check if answer is by admin
        console.log("Admin Check for Answer -> Email:", answer.authorEmail, "Is Admin:", isAnswerAdmin);
        const answerVoteCount = (answer.upvotes || 0) - (answer.downvotes || 0);

        const repliesHTML = answer.replies.map(reply => {
            console.log("Reply Data:", reply); // Debugging to check reply data
            const isReplyAdmin = reply.authorEmail === ADMIN_EMAIL; // Check if reply is by admin
            console.log("Admin Check for Reply -> Email:", reply.authorEmail, "Is Admin:", isReplyAdmin);
            const replyVoteCount = (reply.upvotes || 0) - (reply.downvotes || 0);
            const userVoteClass = currentUser && reply.votedBy && reply.votedBy[currentUser.uid] 
                ? `voted-${reply.votedBy[currentUser.uid]}` 
                : '';

            return `
                <div class="reply ${isReplyAdmin ? 'admin-highlight' : ''}">
                    <div class="post-metadata">
                        <span class="post-author">${reply.author || 'Unknown'}</span>
                        <span class="timestamp">${reply.timestamp ? formatTimestamp(reply.timestamp.toDate()) : 'Unknown time'}</span>
                    </div>
                    <p>${reply.content || 'No content available'}</p>
                    <div class="post-actions">
                        <button class="vote-button ${userVoteClass}" onclick="vote('upvote', 'reply', '${reply.id}', '${answer.id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-7 7h5v8h4v-8h5z"/></svg>
                            <span class="vote-count">${replyVoteCount}</span>
                        </button>
                        <button class="vote-button ${userVoteClass}" onclick="vote('downvote', 'reply', '${reply.id}', '${answer.id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l7-7h-5v-8h-4v8h-5z"/></svg>
                        </button>
                        ${reply.authorId === currentUser?.uid ? 
                            `<button class="delete-button" onclick="deleteDocument('posts/${postId}/answers/${answer.id}/replies/${reply.id}')">Delete</button>` 
                            : ''}
                        <button class="report-button" onclick="reportContent('Reply', '${reply.id}', '${reply.content}')">Report</button>
                    </div>
                </div>
            `;
        }).join('');

        const userVoteClass = currentUser && answer.votedBy && answer.votedBy[currentUser.uid] 
            ? `voted-${answer.votedBy[currentUser.uid]}` 
            : '';

        return `
            <div class="answer ${isAnswerAdmin ? 'admin-highlight' : ''}">
                <div class="post-metadata">
                    <span class="post-author">${answer.author || 'Unknown'}</span>
                    <span class="timestamp">${answer.timestamp ? formatTimestamp(answer.timestamp.toDate()) : 'Unknown time'}</span>
                </div>
                <p>${answer.content || 'No content available'}</p>
                <div class="post-actions">
                    <button class="vote-button ${userVoteClass}" onclick="vote('upvote', 'answer', '${answer.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-7 7h5v8h4v-8h5z"/></svg>
                        <span class="vote-count">${answerVoteCount}</span>
                    </button>
                    <button class="vote-button ${userVoteClass}" onclick="vote('downvote', 'answer', '${answer.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l7-7h-5v-8h-4v8h-5z"/></svg>
                    </button>
                    <button class="comment-button" onclick="toggleFormVisibility('replyForm${answer.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2h-16c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2zm0 16h-5.17l-2.83 2.83-2.83-2.83h-5.17v-14h16v14z"/></svg>
                        <span>Reply</span>
                    </button>
                    ${answer.authorId === currentUser?.uid ? 
                        `<button class="delete-button" onclick="deleteDocument('posts/${postId}/answers/${answer.id}')">Delete</button>` 
                        : ''}
                    <button class="report-button" onclick="reportContent('Answer', '${answer.id}', '${answer.content}')">Report</button>
                </div>
                <div class="reply-form hidden" id="replyForm${answer.id}">
                    <textarea id="replyInput${answer.id}" placeholder="Write a reply..."></textarea>
                    <button onclick="addReply('${answer.id}', document.getElementById('replyInput${answer.id}').value)">Submit Reply</button>
                </div>
                <div class="replies">
                    ${repliesHTML}
                </div>
            </div>
        `;
    }).join('');

    const isPostAdmin = post.authorEmail === ADMIN_EMAIL; // Check if post is by admin
    const userVoteClass = currentUser && post.votedBy && post.votedBy[currentUser.uid] 
        ? `voted-${post.votedBy[currentUser.uid]}` 
        : '';

    postDetailsContainer.innerHTML = `
        <div class="post-detail ${isPostAdmin ? 'admin-highlight' : ''}">
            <div class="post-metadata">
                <span class="post-author">${post.author || "Anonymous"}</span>
                <span class="timestamp">${formatTimestamp(post.timestamp.toDate())}</span>
            </div>
            <h2>${post.title}</h2>
            <p>${post.content}</p>
            <div class="post-actions">
                <button class="vote-button ${userVoteClass}" onclick="vote('upvote', 'post', '${postId}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-7 7h5v8h4v-8h5z"/></svg>
                    <span class="vote-count">${voteCount}</span>
                </button>
                <button class="vote-button ${userVoteClass}" onclick="vote('downvote', 'post', '${postId}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l7-7h-5v-8h-4v8h-5z"/></svg>
                </button>
                <button class="comment-button" onclick="toggleFormVisibility('answerForm')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2h-16c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2zm0 16h-5.17l-2.83 2.83-2.83-2.83h-5.17v-14h16v14z"/></svg>
                    <span>Answer</span>
                </button>
                ${post.authorId === currentUser?.uid ? 
                    `<button class="delete-button" onclick="deleteDocument('posts/${postId}')">Delete</button>` 
                    : ''}
            </div>
            <div class="answer-form hidden" id="answerForm">
                <textarea id="answerInput" placeholder="Write an answer..."></textarea>
                <button onclick="addAnswer(document.getElementById('answerInput').value)">Submit Answer</button>
            </div>
            <div class="answers-section">
                ${answersHTML}
            </div>
        </div>
    `;

    initializeChatbot();
}


function toggleFormVisibility(formId) {
    const form = document.getElementById(formId);
    form.classList.toggle('hidden');
}

// Chatbot functionality
function initializeChatbot() {
    const chatMessages = document.getElementById("chat-messages");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, "user");
        userInput.value = "";

        try {
            const response = await fetchGeminiAnswer(message);
            addMessage(response, "bot");
        } catch (error) {
            console.error("Error getting AI response:", error);
            addMessage("Sorry, I couldn't process your request.", "bot");
        }
    }

    function addMessage(content, sender) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", `${sender}-message`);
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendButton.onclick = sendMessage;
    userInput.onkeypress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPostDetails();
});

// Expose necessary functions to window
window.addReply = addReply;
window.toggleFormVisibility = toggleFormVisibility;
window.addAnswer = addAnswer;
window.vote = vote;
window.deleteDocument = deleteDocument;
window.reportContent = reportContent;
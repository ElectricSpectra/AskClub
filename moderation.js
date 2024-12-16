import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

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


// Update flagged content fetching to include redirection links
async function fetchFlaggedContent() {
    const moderationList = document.getElementById("moderationList");
    moderationList.innerHTML = "<p>Loading flagged content...</p>";

    try {
        // Fetch all flagged content from the "moderationQueue"
        const flaggedDocs = await getDocs(collection(db, "moderationQueue"));
        const flaggedContent = flaggedDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (flaggedContent.length === 0) {
            moderationList.innerHTML = "<p>No flagged content to review.</p>";
            return;
        }

        // Render the flagged content as cards
        moderationList.innerHTML = flaggedContent.map(content => `
            <div class="moderation-card" onclick="redirectToContent('${content.type}', '${content.postId}', '${content.answerId || ""}', '${content.replyId || ""}')">
                <h3>${content.type}</h3>
                <p><strong>Content:</strong> ${content.content}</p>
                <p><strong>Reason:</strong> ${content.reason}</p>
                <p><strong>Reported By:</strong> ${content.reportedBy || "System (AI)"}</p>
                <div class="moderation-actions">
                    <button onclick="event.stopPropagation(); deleteContent('${content.id}', '${content.type}', '${content.postId}', '${content.answerId || ""}', '${content.replyId || ""}')">Delete</button>
                    <button onclick="event.stopPropagation(); markAsSafe('${content.id}')">Mark as Safe</button>
                </div>
            </div>
        `).join("");        
    } catch (error) {
        console.error("Error fetching flagged content:", error);
        moderationList.innerHTML = "<p>Error loading content. Please try again later.</p>";
    }
}


// Redirect based on type and IDs
function redirectToContent(type, postId, answerId = null, replyId = null) {
    if (!postId || postId === "undefined") {
        alert("The post ID is missing or invalid. Cannot redirect.");
        return;
    }

    let url = `fullpost.html?postId=${postId}`;
    if (type === "Answer" && answerId) {
        url += `#answer-${answerId}`;
    } else if (type === "Reply" && answerId && replyId) {
        url += `#reply-${replyId}`;
    }

    console.log("Redirecting to:", url); // Debugging redirection
    window.location.href = url;
}



// Adjust deleteContent for AI-tagged content
async function deleteContent(id, type, postId = "", answerId = "", replyId = "") {
    try {
        // Delete the flagged content from the moderation queue
        await deleteDoc(doc(db, "moderationQueue", id)); 

        // Delete the flagged content from the main database
        if (type === "Question" && postId) {
            // Delete the question from the "posts" collection
            await deleteDoc(doc(db, "posts", postId));
        } else if (type === "Answer" && postId && answerId) {
            // Delete the answer from the nested "answers" subcollection
            await deleteDoc(doc(db, "posts", postId, "answers", answerId));
        } else if (type === "Reply" && postId && answerId && replyId) {
            // Delete the reply from the nested "replies" subcollection
            await deleteDoc(doc(db, "posts", postId, "answers", answerId, "replies", replyId));
        } else {
            throw new Error("Missing necessary IDs for deletion.");
        }

        // Notify user of success
        alert(`${type} deleted successfully from both moderation and the database.`);
        
        // Refresh the moderation list to reflect the deletion
        fetchFlaggedContent();
    } catch (error) {
        console.error("Error deleting content:", error);
        alert("Failed to delete content. Please check the details and try again.");
    }
}


async function markAsSafe(id) {
    try {
        await deleteDoc(doc(db, "moderationQueue", id));
        alert("Content marked as safe.");
        fetchFlaggedContent(); // Refresh the list
    } catch (error) {
        console.error("Error marking content as safe:", error);
        alert("Error marking content as safe. Please try again later.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchFlaggedContent();
});


// Expose necessary functions globally for the HTML buttons to work
window.deleteContent = deleteContent;
window.markAsSafe = markAsSafe;
window.redirectToContent = redirectToContent;


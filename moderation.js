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

async function fetchFlaggedContent() {
    const moderationList = document.getElementById("moderationList");
    moderationList.innerHTML = "<p>Loading flagged content...</p>";

    try {
        const flaggedDocs = await getDocs(collection(db, "moderationQueue"));
        const flaggedContent = flaggedDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (flaggedContent.length === 0) {
            moderationList.innerHTML = "<p>No flagged content to review.</p>";
            return;
        }

        moderationList.innerHTML = flaggedContent.map(content => `
            <div class="moderation-card">
                <h3>${content.type}</h3>
                <p><strong>Content:</strong> ${content.content}</p>
                <p><strong>Reason:</strong> ${content.reason}</p>
                <p><strong>Reported By:</strong> ${content.reportedBy || "System (AI)"}</p>
                <div class="moderation-actions">
                    <button onclick="deleteContent('${content.id}', '${content.type}', '${content.postId || ""}', '${content.answerId || ""}', '${content.replyId || ""}')">Delete</button>
                    <button onclick="markAsSafe('${content.id}')">Mark as Safe</button>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error fetching flagged content:", error);
        moderationList.innerHTML = "<p>Error loading content. Please try again later.</p>";
    }
}

async function deleteContent(id, type, postId = "", answerId = "", replyId = "") {
    try {
        await deleteDoc(doc(db, "moderationQueue", id)); // Remove from moderationQueue

        if (type === "Question") {
            if (!postId) throw new Error("Missing postId for Question.");
            await deleteDoc(doc(db, "posts", postId));
        } else if (type === "Answer") {
            if (!postId || !answerId) throw new Error("Missing postId or answerId for Answer.");
            await deleteDoc(doc(db, "posts", postId, "answers", answerId));
        } else if (type === "Reply") {
            if (!postId || !answerId || !replyId) throw new Error("Missing postId, answerId, or replyId for Reply.");
            await deleteDoc(doc(db, "posts", postId, "answers", answerId, "replies", replyId));
        }

        alert(`${type} deleted successfully.`);
        fetchFlaggedContent(); // Refresh the moderation list
    } catch (error) {
        console.error("Error deleting content:", error);
        alert("Error deleting content. Please check the details and try again.");
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

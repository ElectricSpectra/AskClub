import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Login/Logout button logic
const authButton = document.querySelector("#authButton .auth-btn");

// Event listener for authentication button
authButton.addEventListener("click", async () => {
    if (auth.currentUser) {
        // Sign out if already signed in
        await signOut(auth);
        console.log("Signed out");
    } else {
        // Sign in if not signed in
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            console.log("Signed in");
        } catch (error) {
            console.error("Sign-in error:", error);
        }
    }
});

// Update the UI based on authentication state
const ADMIN_EMAIL = "sohansoma2806@gmail.com"; // Define admin email

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Update the auth button to Logout
        authButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';

        // Check if the logged-in user is the admin
        if (user.email === ADMIN_EMAIL) {
            const sidebar = document.querySelector(".sidebar nav ul");
            
            // Check if the Moderation button already exists to avoid duplicates
            if (!document.querySelector(".sidebar nav ul .moderation-btn")) {
                const moderationButton = document.createElement("li");
                moderationButton.classList.add("moderation-btn");
                moderationButton.innerHTML = `
                    <a href="Moderation.html">
                        <i class="fas fa-user-shield"></i>
                        <span>Moderation</span>
                    </a>`;
                sidebar.appendChild(moderationButton);
            }
        }
    } else {
        // Update the auth button to Login
        authButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';

        // Remove the Moderation button if it exists
        const moderationButton = document.querySelector(".sidebar nav ul .moderation-btn");
        if (moderationButton) {
            moderationButton.remove();
        }
    }
});


export function loadSidebar() {
    // Check if the page is loginmain.html; if yes, skip sidebar injection
    if (window.location.pathname.includes('loginmain.html')) return;

    // Create a container for the sidebar
    const sidebarContainer = document.createElement('div');
    sidebarContainer.className = 'main-container';

    // Fetch sidebar HTML
    fetch('sidebar.html')
        .then(response => response.text())
        .then(html => {
            sidebarContainer.innerHTML = html;

            // Append the sidebar to the body
            document.body.insertBefore(sidebarContainer, document.body.firstChild);
        })
        .catch(error => console.error('Error loading sidebar:', error));
}


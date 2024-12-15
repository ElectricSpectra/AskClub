import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    updateDoc 
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

// Fetch notifications for the logged-in user
async function fetchNotifications(userId) {
    const notificationsContainer = document.getElementById('notifications');
    notificationsContainer.innerHTML = '<p>Loading notifications...</p>';

    try {
        const q = query(
            collection(db, "notifications"),
            where("userId", "==", userId)
        );

        const querySnapshot = await getDocs(q);

        const notifications = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());

        if (notifications.length === 0) {
            notificationsContainer.innerHTML = '<p>No notifications yet.</p>';
            return;
        }

        notificationsContainer.innerHTML = notifications.map(notification => `
            <div class="notification-card ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    ${getNotificationIcon(notification.type)}
                </div>
                <div class="notification-content">
                    <p>${formatNotificationMessage(notification)}</p>
                    <span class="timestamp">${formatTimestamp(notification.timestamp)}</span>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.notification-card').forEach(card => {
            card.addEventListener('click', () => {
                markNotificationAsRead(card.dataset.id);
                const notification = notifications.find(n => n.id === card.dataset.id);
                if (notification?.postId) {
                    window.location.href = `fullpost.html?postId=${notification.postId}`;
                }
            });
        });

        updateNotificationBadge(notifications.filter(n => !n.read).length);

        pushBrowserNotifications(notifications);

    } catch (error) {
        console.error("Error fetching notifications:", error);
        notificationsContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading notifications. Please try again later.</p>
                <button onclick="window.location.reload()">Retry</button>
            </div>`;
    }
}

// Push browser notifications
function pushBrowserNotifications(notifications) {
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notifications.");
        return;
    }

    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
        return;
    }

    const pushedNotifications = JSON.parse(localStorage.getItem('pushedNotifications') || '[]');
    const now = new Date();
    const oneDayAgo = now.setDate(now.getDate() - 1);

    notifications.filter(n => !pushedNotifications.includes(n.id) && n.timestamp?.toDate() > oneDayAgo)
        .forEach(notification => {
            const message = formatNotificationMessage(notification);

            const desktopNotification = new Notification("New Notification", {
                body: message,
                icon: "/path/to/notification-icon.png" // Replace with your actual notification icon
            });

            desktopNotification.onclick = () => {
                if (notification?.postId) {
                    window.open(`fullpost.html?postId=${notification.postId}`, '_blank');
                }
            };

            pushedNotifications.push(notification.id);
        });

    localStorage.setItem('pushedNotifications', JSON.stringify(pushedNotifications));
}

// Get appropriate icon for notification type
function getNotificationIcon(type) {
    const icons = {
        answer: '<i class="fas fa-comment-alt"></i>',
        reply: '<i class="fas fa-reply"></i>',
        deletion: '<i class="fas fa-trash-alt"></i>',
        moderation: '<i class="fas fa-shield-alt"></i>'
    };
    return icons[type] || '<i class="fas fa-bell"></i>';
}

// Format the notification message based on its type
function formatNotificationMessage(notification) {
    return notification.message || 'New notification';
}

// Format the timestamp for display
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

// Mark a notification as read
async function markNotificationAsRead(notificationId) {
    try {
        await updateDoc(doc(db, "notifications", notificationId), {
            read: true
        });
        console.log(`Notification ${notificationId} marked as read.`);
        if (auth.currentUser) {
            fetchNotifications(auth.currentUser.uid);
        }
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

// Update the notification badge with the count of unread notifications
function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Set up periodic refresh for notifications
let refreshInterval;

function startPeriodicRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
        if (auth.currentUser) {
            fetchNotifications(auth.currentUser.uid);
        }
    }, 30000); // Refresh every 30 seconds
}

// Initialize the page
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.uid);
        fetchNotifications(user.uid);
        startPeriodicRefresh();
    } else {
        const notificationsContainer = document.getElementById('notifications');
        notificationsContainer.innerHTML = '<p>Please sign in to view notifications.</p>';
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }
});

// Clean up on page unload
window.addEventListener('unload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

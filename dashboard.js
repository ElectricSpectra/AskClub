import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getFirestore, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js";

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
let mainChart;

// Fetch stats for the dashboard
async function fetchStats() {
    const loadingIndicator = document.getElementById("loadingIndicator");
    try {
        // Show loading indicator
        loadingIndicator.style.display = "flex";

        const postsSnapshot = await getDocs(query(collection(db, "posts")));
        const questionsCount = postsSnapshot.size;

        let answersCount = 0;
        const engagementRateData = {};
        const dauData = new Map();

        // Iterate through each post to calculate stats
        for (const postDoc of postsSnapshot.docs) {
            const post = postDoc.data();
            const postDate = post.timestamp.toDate().toLocaleDateString();

            // Track engagement and DAU data
            engagementRateData[postDate] = engagementRateData[postDate] || { questions: 0, answers: 0 };
            engagementRateData[postDate].questions++;

            dauData.set(postDate, (dauData.get(postDate) || 0) + 1);

            // Fetch answers for the post
            const answersSnapshot = await getDocs(collection(postDoc.ref, "answers"));
            answersCount += answersSnapshot.size;

            answersSnapshot.forEach(answerDoc => {
                const answer = answerDoc.data();
                const answerDate = answer.timestamp.toDate().toLocaleDateString();

                // Update engagement and DAU data for answers
                engagementRateData[answerDate] = engagementRateData[answerDate] || { questions: 0, answers: 0 };
                engagementRateData[answerDate].answers++;

                dauData.set(answerDate, (dauData.get(answerDate) || 0) + 1);
            });
        }

        // Calculate engagement rate
        const engagementRate = ((answersCount / questionsCount) * 100).toFixed(2);

        // Prepare data for charts
        const questionsData = Object.entries(engagementRateData)
            .map(([date, { questions }]) => [date, questions])
            .sort(([a], [b]) => new Date(a) - new Date(b));
        const answersData = Object.entries(engagementRateData)
            .map(([date, { answers }]) => [date, answers])
            .sort(([a], [b]) => new Date(a) - new Date(b));
        const engagementChartData = Object.entries(engagementRateData)
            .map(([date, { answers, questions }]) => [date, ((answers / questions) * 100).toFixed(2)])
            .sort(([a], [b]) => new Date(a) - new Date(b));
        const dauChartData = Array.from(dauData.entries()).sort(([a], [b]) => new Date(a) - new Date(b));

        // Update stat cards
        document.getElementById("questionsCount").querySelector("p").textContent = questionsCount;
        document.getElementById("answersCount").querySelector("p").textContent = answersCount;
        document.getElementById("dauCount").querySelector("p").textContent = dauData.size;
        document.getElementById("engagementRate").querySelector("p").textContent = `${engagementRate}%`;

        // Attach event listeners to stat cards
        attachStatListeners(questionsData, answersData, engagementChartData, dauChartData);
    } catch (error) {
        console.error("Error fetching stats:", error);
    } finally {
        // Hide loading indicator
        loadingIndicator.style.display = "none";
    }
}


// Attach event listeners for interactive stats
function attachStatListeners(questionsData, answersData, engagementChartData, dauChartData) {
    document.getElementById("questionsCount").addEventListener("click", () => {
        renderChart("Questions Over Time", questionsData);
    });

    document.getElementById("answersCount").addEventListener("click", () => {
        renderChart("Answers Over Time", answersData);
    });

    document.getElementById("dauCount").addEventListener("click", () => {
        renderChart("Daily Active Users", dauChartData);
    });

    document.getElementById("engagementRate").addEventListener("click", () => {
        renderChart("Daily Engagement Rate (%)", engagementChartData);
    });
}

// Render a chart
function renderChart(label, data) {
    const ctx = document.getElementById("mainChart").getContext("2d");
    if (mainChart) mainChart.destroy(); // Destroy the previous chart if it exists
    mainChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(([date]) => date),
            datasets: [{
                label,
                data: data.map(([, count]) => count),
                borderColor: "rgba(55, 100, 13, 1)",
                backgroundColor: "rgba(55, 100, 13, 0.1)",
                tension: 0.3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Date",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: label.includes("Rate") ? "%" : "Count",
                    },
                },
            },
        },
    });
}

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", fetchStats);

const apiKey = "AIzaSyBSHKbI4h16pNXvZD0EFr9t3Dqo-A5D-E4";
const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent";

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

function addMessage(content, sender = "user") {
  const message = document.createElement("div");
  message.classList.add("message");
  message.classList.add(sender === "user" ? "user-message" : "bot-message");
  message.textContent = content;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  addMessage(userMessage, "user");
  userInput.value = "";

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: userMessage
          }]
        }]
      }),
    });

    if (!response.ok) {
      throw new Error("API error: " + response.statusText);
    }

    const data = await response.json();
    const botReply = data.candidates[0].content.parts[0].text || "I'm sorry, I didn't understand that.";
    addMessage(botReply, "bot");
  } catch (error) {
    console.error(error);
    addMessage("Error: Unable to reach the server. Please try again later.", "bot");
  }
}

sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
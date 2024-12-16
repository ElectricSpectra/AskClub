export async function fetchGeminiAnswer(question) {
    console.log("fetchGeminiAnswer called with question:", question);
    const apiKey = "AIzaSyCfc4CJC0JhpsvnHI_fppINOS6hD7gsztk"; // Gemini API Key
    const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent";

    try {
        const response = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: question,
                            },
                        ],
                    },
                ],
            }),
        });

        if (!response.ok) {
            console.error("API error:", response.statusText);
            throw new Error("Failed to fetch AI answer");
        }

        const data = await response.json();
        const botReply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I'm sorry, I couldn't generate an answer.";
        console.log("AI Response:", botReply); // For debugging
        return botReply;
    } catch (error) {
        console.error("Error in Gemini API integration:", error);
        throw error;
    }
}

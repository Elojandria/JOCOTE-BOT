// chatgpt.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function askChatGPT(prompt) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Eres un bot de WhatsApp útil y amigable." },
                { role: "user", content: prompt }
            ]
        });
        return completion.choices[0].message.content;
    } catch (err) {
        console.error("Error en ChatGPT:", err);
        return "Ocurrió un error procesando tu solicitud.";
    }
}
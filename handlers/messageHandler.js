// handlers/messageHandler.js
import { askChatGPT } from '../chatgpt.js';

export async function handleMessage(sock, msg) {
    try {
        // Ignorar mensajes enviados por el bot para evitar bucles
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (!text) return;

        console.log(`Mensaje de ${from}: ${text}`);

        const reply = await askChatGPT(text);

        await sock.sendMessage(from, { text: reply });
    } catch (err) {
        console.error("Error manejando mensaje:", err);
    }
}

// handlers/messageHandler.js
import { askChatGPT } from '../chatgpt.js';

const BOT_ID = process.env.BOT_ID;

export async function handleMessage(sock, msg) {
  try {
    if (msg.key.fromMe) return; // Ignorar mensajes propios

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    // Obtener texto y menciones
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!text) return;

    // Si es grupo, responde solo si se menciona al bot
    if (isGroup && !mentions.includes(BOT_ID)) return;

    console.log(`Mensaje de ${from}: ${text}`);

    const reply = await askChatGPT(text);

    await sock.sendMessage(from, { text: reply });
  } catch (err) {
    console.error("Error manejando mensaje:", err);
  }
}

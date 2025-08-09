// handlers/messageHandler.js
import { askChatGPT } from '../chatgpt.js';

const BOT_ID = process.env.BOT_ID;

// Estado en memoria para chats privados
const privateChatStatus = {}; // { jid: true/false }

export async function handleMessage(sock, msg) {
  try {
    if (msg.key.fromMe) return; // Ignorar mensajes propios

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    // Obtener texto del mensaje
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    if (!text.trim()) return;

    // ========================
    // MANEJO DE GRUPOS
    // ========================
    if (isGroup) {
      // Responder solo si contiene la palabra exacta "JOCOTE-BOT"
      const hasExactWord = /\bJOCOTE-BOT\b/i.test(text);
      if (!hasExactWord) return;
    }

    // ========================
    // MANEJO DE CHATS PRIVADOS
    // ========================
    if (!isGroup) {
      // Inicializar estado del chat si no existe
      if (!(from in privateChatStatus)) privateChatStatus[from] = true;

      const lowerText = text.trim().toLowerCase();

      // Comandos de activación/desactivación
      if (lowerText === '/desactivar') {
        privateChatStatus[from] = false;
        await sock.sendMessage(from, { text: '✅ Bot desactivado para este chat.' });
        return;
      }
      if (lowerText === '/activar') {
        privateChatStatus[from] = true;
        await sock.sendMessage(from, { text: '✅ Bot activado para este chat.' });
        return;
      }

      // Si está desactivado, no responder
      if (!privateChatStatus[from]) return;
    }

    console.log(`Mensaje de ${from}: ${text}`);

    const reply = await askChatGPT(text);
    await sock.sendMessage(from, { text: reply });

  } catch (err) {
    console.error("Error manejando mensaje:", err);
  }
}

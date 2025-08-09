export async function handleMessage(sock, message) {
  // Ignorar mensajes sin contenido
  if (!message.message) return;

  // Ignorar mensajes enviados por el bot mismo
  if (message.key.fromMe) return;

  // Procesa el mensaje normalmente (ejemplo: responde con un eco)
  const text = message.message.conversation || message.message.extendedTextMessage?.text;

  if (text) {
    await sock.sendMessage(message.key.remoteJid, { text: `Recibí: ${text}` });
  }
}

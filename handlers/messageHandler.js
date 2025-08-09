import fs from 'fs';
import { askChatGPT } from '../chatgpt.js';

const USUARIOS_FILE = './data/usuarios.json';
const STATUS_FILE = './data/privateStatus.json';
const BOT_ID = process.env.BOT_ID;

// Funciones para manejo de archivos JSON
function cargarArchivo(ruta) {
  if (!fs.existsSync(ruta)) {
    fs.writeFileSync(ruta, '{}', 'utf8');
    return {};
  }
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function guardarArchivo(ruta, data) {
  fs.writeFileSync(ruta, JSON.stringify(data, null, 2), 'utf8');
}

// Cargar datos iniciales
let usuarios = cargarArchivo(USUARIOS_FILE);
let privateChatStatus = cargarArchivo(STATUS_FILE);

export async function handleMessage(sock, msg) {
  try {
    if (msg.key.fromMe) return; // Ignorar mensajes propios

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from; // participante en grupo o privado
    const isGroup = from.endsWith('@g.us');

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';
    if (!text.trim()) return;

    // ===========================
    // ASIGNACIÓN Y CAMBIO DE NOMBRE
    // ===========================
    if (!(sender in usuarios)) {
      usuarios[sender] = { nombre: msg.pushName || 'Usuario', rol: 'usuario' };
      guardarArchivo(USUARIOS_FILE, usuarios);
    }

    if (text.startsWith('/nombre ')) {
      const nuevoNombre = text.slice(8).trim();
      usuarios[sender].nombre = nuevoNombre;
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: `✅ Tu nombre ahora es: ${nuevoNombre}` }, { quoted: msg });
      return;
    }

    // ===========================
    // MANEJO DE ROLES CON COMANDO /rol
    // ===========================
    if (text.startsWith('/rol ')) {
      if (usuarios[sender]?.rol !== 'admin') {
        await sock.sendMessage(from, { text: '🚫 No tienes permiso para cambiar roles.' }, { quoted: msg });
        return;
      }

      const partes = text.slice(5).trim().split(' ');
      if (partes.length !== 2) {
        await sock.sendMessage(from, { text: '❗ Uso correcto: /rol <jid> <rol>' }, { quoted: msg });
        return;
      }

      const [jidObjetivo, nuevoRol] = partes;

      if (!usuarios[jidObjetivo]) usuarios[jidObjetivo] = { nombre: 'Usuario', rol: nuevoRol };
      else usuarios[jidObjetivo].rol = nuevoRol;

      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: `✅ Rol de ${jidObjetivo} cambiado a ${nuevoRol}.` }, { quoted: msg });
      return;
    }

    // ===========================
    // MANEJO DE GRUPOS
    // ===========================
    if (isGroup) {
      const metadata = await sock.groupMetadata(from);
      console.log("Participantes:", metadata.participants);

      // Responder solo si contiene la palabra exacta "JOCOTE-BOT"
      const hasExactWord = /\bJOCOTE-BOT\b/i.test(text);
      if (!hasExactWord) return;
    }

    // ===========================
    // MANEJO DE CHAT PRIVADOS Y ESTADO ACTIVACIÓN
    // ===========================
    if (!isGroup) {
      if (!(from in privateChatStatus)) {
        privateChatStatus[from] = true;
        guardarArchivo(STATUS_FILE, privateChatStatus);
      }

      const lowerText = text.trim().toLowerCase();

      if (lowerText === '/desactivar') {
        privateChatStatus[from] = false;
        guardarArchivo(STATUS_FILE, privateChatStatus);
        await sock.sendMessage(from, { text: '✅ Bot desactivado para este chat.' }, { quoted: msg });
        return;
      }

      if (lowerText === '/activar') {
        privateChatStatus[from] = true;
        guardarArchivo(STATUS_FILE, privateChatStatus);
        await sock.sendMessage(from, { text: '✅ Bot activado para este chat.' }, { quoted: msg });
        return;
      }

      if (!privateChatStatus[from]) return;
    }

    // ===========================
    // RESPUESTA DEL BOT
    // ===========================
    console.log(`Mensaje de ${from}: ${text}`);

    const replyFromAI = await askChatGPT(text);
    const replyText = `Hola ${usuarios[sender].nombre}, ${replyFromAI}`;

    await sock.sendMessage(from, { text: replyText }, { quoted: msg });

  } catch (err) {
    console.error("Error manejando mensaje:", err);
  }
}

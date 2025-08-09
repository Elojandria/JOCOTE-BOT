// handlers/messageHandler.js
import fs from 'fs';
import { askChatGPT } from '../chatgpt.js';

const USUARIOS_FILE = './data/usuarios.json';
const STATUS_FILE = './data/privateStatus.json';
const GROUP_STATUS_FILE = './data/groupStatus.json';
const BOT_ID = process.env.BOT_ID;

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

let usuarios = cargarArchivo(USUARIOS_FILE);
let privateChatStatus = cargarArchivo(STATUS_FILE);
let groupChatStatus = cargarArchivo(GROUP_STATUS_FILE); // { groupJid: true/false }

export async function handleMessage(sock, msg) {
  try {
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isGroup = from.endsWith('@g.us');

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';
    if (!text.trim()) return;

    // Si nuevo usuario, registrar con rol usuario
    if (!(sender in usuarios)) {
      usuarios[sender] = { nombre: msg.pushName || 'Usuario', rol: 'usuario' };
      guardarArchivo(USUARIOS_FILE, usuarios);
    }

    // Comandos /nombre para cambiar nombre
    if (text.startsWith('/nombre ')) {
      const nuevoNombre = text.slice(8).trim();
      usuarios[sender].nombre = nuevoNombre;
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: `✅ Tu nombre ahora es: ${nuevoNombre}` }, { quoted: msg });
      return;
    }

    // Comando para asignar rol: SOLO superadmin puede dar admin
    if (text.startsWith('/rol ')) {
      if (usuarios[sender]?.rol !== 'superadmin') {
        await sock.sendMessage(from, { text: '🚫 Solo superadmin puede asignar roles.' }, { quoted: msg });
        return;
      }
      const partes = text.slice(5).trim().split(' ');
      if (partes.length !== 2) {
        await sock.sendMessage(from, { text: '❗ Uso: /rol <jid> <rol>' }, { quoted: msg });
        return;
      }
      const [jidObjetivo, nuevoRol] = partes;
      if (!usuarios[jidObjetivo]) usuarios[jidObjetivo] = { nombre: 'Usuario', rol: nuevoRol };
      else usuarios[jidObjetivo].rol = nuevoRol;
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: `✅ Rol de ${jidObjetivo} cambiado a ${nuevoRol}.` }, { quoted: msg });
      return;
    }

    // Comando para resetear lista de nombres: admin y superadmin
    if (text === '/resetnombres') {
      if (!['admin', 'superadmin'].includes(usuarios[sender]?.rol)) {
        await sock.sendMessage(from, { text: '🚫 Solo admin o superadmin pueden resetear nombres.' }, { quoted: msg });
        return;
      }
      // Resetear nombres, pero conservar roles y JIDs
      for (const jid in usuarios) {
        usuarios[jid].nombre = 'Usuario';
      }
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: '✅ Lista de nombres reiniciada.' }, { quoted: msg });
      return;
    }

    // Activar/desactivar bot en grupos (solo admin y superadmin)
    if (text === '/activarbot' || text === '/desactivarbot') {
      if (!isGroup) {
        await sock.sendMessage(from, { text: '🚫 Este comando solo funciona en grupos.' }, { quoted: msg });
        return;
      }
      if (!['admin', 'superadmin'].includes(usuarios[sender]?.rol)) {
        await sock.sendMessage(from, { text: '🚫 Solo admin o superadmin pueden activar/desactivar el bot en grupos.' }, { quoted: msg });
        return;
      }
      groupChatStatus[from] = text === '/activarbot';
      guardarArchivo(GROUP_STATUS_FILE, groupChatStatus);
      await sock.sendMessage(from, { text: `✅ Bot ${groupChatStatus[from] ? 'activado' : 'desactivado'} en este grupo.` }, { quoted: msg });
      return;
    }

    // Si es grupo y está desactivado, no responder
    if (isGroup) {
      const metadata = await sock.groupMetadata(from);
      console.log("Participantes:", metadata.participants);

      // Revisar si bot está activo en este grupo
      if (groupChatStatus[from] === false) return;

      // Responder solo si contiene "JOCOTE-BOT"
      const hasExactWord = /\bJOCOTE-BOT\b/i.test(text);
      if (!hasExactWord) return;
    }

    // Privados: manejar activación/desactivación individual
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

    // Responder con AskGPT
    console.log(`Mensaje de ${from}: ${text}`);

    const replyFromAI = await askChatGPT(text);
    const replyText = `Hola ${usuarios[sender].nombre}, ${replyFromAI}`;

    await sock.sendMessage(from, { text: replyText }, { quoted: msg });

  } catch (err) {
    console.error("Error manejando mensaje:", err);
  }
}

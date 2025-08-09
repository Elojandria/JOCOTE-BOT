import fs from 'fs';
import { askChatGPT } from '../chatgpt.js';

const USUARIOS_FILE = './data/usuarios.json';
const STATUS_FILE = './data/privateStatus.json';
const GROUP_STATUS_FILE = './data/groupStatus.json';
const ACTIVITY_FILE = './data/activity.json';
const REMINDERS_FILE = './data/reminders.json';
const AGENDA_FILE = './data/agenda.json';
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
let groupChatStatus = cargarArchivo(GROUP_STATUS_FILE);
let activityLog = cargarArchivo(ACTIVITY_FILE);
let reminders = cargarArchivo(REMINDERS_FILE);
let agenda = cargarArchivo(AGENDA_FILE);

function existeConflicto(fechaHora) {
  return Object.values(agenda).some(ev => ev.fechaHora === fechaHora);
}

function fechaFormateada(fechaStr) {
  const d = new Date(fechaStr);
  if (isNaN(d)) return null;
  return d.toLocaleString();
}

function registrarActividad(jid) {
  activityLog[jid] = new Date().toISOString();
  guardarArchivo(ACTIVITY_FILE, activityLog);
}

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

    // Registrar actividad
    registrarActividad(sender);

    // Registrar nuevo usuario con rol usuario
    if (!(sender in usuarios)) {
      usuarios[sender] = { nombre: msg.pushName || 'Usuario', rol: 'usuario' };
      guardarArchivo(USUARIOS_FILE, usuarios);
    }

    const lowerText = text.trim().toLowerCase();

    // 7) Mostrar lista de comandos: /comandos
    if (lowerText === '/comandos') {
      const comandos = `
📂 Gestión de usuarios y roles
/nombre <nombre> - Cambiar tu nombre
/rol <jid> <rol> - Asignar rol (solo superadmin)
/activar - Activar bot en privado
/desactivar - Desactivar bot en privado
/activarbot - Activar bot en grupo (admin/superadmin)
/desactivarbot - Desactivar bot en grupo (admin/superadmin)
/resetnombres - Reiniciar nombres (admin/superadmin)

📆 Agenda y recordatorios
/crear reminder <YYYY-MM-DD> <HH:MM> <mensaje> - Crear recordatorio
/borrar reminder <id> - Borrar recordatorio
/agregar evento <YYYY-MM-DD> <HH:MM> <nombre> - Agregar evento
/agenda - Mostrar agenda

👥 Actividad
/actividad [usuario1 usuario2 ...] - Ver actividad

🎮 Juegos
/juego adivina - Juego de adivinanza

📜 Índice
/comandos - Mostrar esta lista
      `;
      await sock.sendMessage(from, { text: comandos.trim() }, { quoted: msg });
      return;
    }

    // Cambiar nombre
    if (text.startsWith('/nombre ')) {
      const nuevoNombre = text.slice(8).trim();
      usuarios[sender].nombre = nuevoNombre;
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: `✅ Tu nombre ahora es: ${nuevoNombre}` }, { quoted: msg });
      return;
    }

    // Asignar rol (solo superadmin)
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

    // Resetear nombres (admin y superadmin)
    if (text === '/resetnombres') {
      if (!['admin', 'superadmin'].includes(usuarios[sender]?.rol)) {
        await sock.sendMessage(from, { text: '🚫 Solo admin o superadmin pueden resetear nombres.' }, { quoted: msg });
        return;
      }
      for (const jid in usuarios) {
        usuarios[jid].nombre = 'Usuario';
      }
      guardarArchivo(USUARIOS_FILE, usuarios);
      await sock.sendMessage(from, { text: '✅ Lista de nombres reiniciada.' }, { quoted: msg });
      return;
    }

    // Activar/desactivar bot en grupos (admin y superadmin)
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

    // Privados: manejar activación/desactivación individual
    if (!isGroup) {
      if (!(from in privateChatStatus)) {
        privateChatStatus[from] = true;
        guardarArchivo(STATUS_FILE, privateChatStatus);
      }

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

    // Responder solo si bot activado en grupo
    if (isGroup) {
      if (groupChatStatus[from] === false) return;

      // Solo si contiene "JOCOTE-BOT"
      const hasExactWord = /\bJOCOTE-BOT\b/i.test(text);
      if (!hasExactWord) return;
    }

    // 1) Crear reminder: /crear reminder 2025-08-15 14:00 Mensaje
    if (lowerText.startsWith('/crear reminder ')) {
      const partes = text.slice(16).trim().split(' ');
      if (partes.length < 3) {
        await sock.sendMessage(from, { text: '❗ Uso: /crear reminder <YYYY-MM-DD> <HH:MM> <mensaje>' }, { quoted: msg });
        return;
      }
      const fecha = partes[0];
      const hora = partes[1];
      const mensaje = partes.slice(2).join(' ');
      const fechaHoraStr = `${fecha}T${hora}:00`;
      if (isNaN(new Date(fechaHoraStr))) {
        await sock.sendMessage(from, { text: '❗ Fecha u hora inválida. Usa formato YYYY-MM-DD HH:MM' }, { quoted: msg });
        return;
      }
      const id = Date.now().toString();
      reminders[id] = { fechaHora: fechaHoraStr, mensaje, creador: sender };
      guardarArchivo(REMINDERS_FILE, reminders);
      await sock.sendMessage(from, { text: `✅ Recordatorio creado con ID ${id}` }, { quoted: msg });
      return;
    }

    // 2) Borrar reminder: /borrar reminder <id>
    if (lowerText.startsWith('/borrar reminder ')) {
      const id = text.slice(17).trim();
      if (!reminders[id]) {
        await sock.sendMessage(from, { text: `❗ No existe recordatorio con ID ${id}` }, { quoted: msg });
        return;
      }
      if (reminders[id].creador !== sender && usuarios[sender]?.rol !== 'superadmin') {
        await sock.sendMessage(from, { text: '🚫 Solo el creador o superadmin puede borrar este recordatorio.' }, { quoted: msg });
        return;
      }
      delete reminders[id];
      guardarArchivo(REMINDERS_FILE, reminders);
      await sock.sendMessage(from, { text: `✅ Recordatorio ${id} borrado.` }, { quoted: msg });
      return;
    }

    // 3) Agregar evento a agenda: /agregar evento 2025-08-15 14:00 Nombre del evento
    if (lowerText.startsWith('/agregar evento ')) {
      const partes = text.slice(15).trim().split(' ');
      if (partes.length < 3) {
        await sock.sendMessage(from, { text: '❗ Uso: /agregar evento <YYYY-MM-DD> <HH:MM> <nombre>' }, { quoted: msg });
        return;
      }
      const fecha = partes[0];
      const hora = partes[1];
      const nombreEvento = partes.slice(2).join(' ');
      const fechaHoraStr = `${fecha}T${hora}:00`;
      if (isNaN(new Date(fechaHoraStr))) {
        await sock.sendMessage(from, { text: '❗ Fecha u hora inválida. Usa formato YYYY-MM-DD HH:MM' }, { quoted: msg });
        return;
      }
      if (existeConflicto(fechaHoraStr)) {
        await sock.sendMessage(from, { text: '❗ Ya existe un evento en esa fecha y hora.' }, { quoted: msg });
        return;
      }
      const id = Date.now().toString();
      agenda[id] = { fechaHora: fechaHoraStr, nombre: nombreEvento, creador: sender };
      guardarArchivo(AGENDA_FILE, agenda);
      await sock.sendMessage(from, { text: `✅ Evento agregado con ID ${id}` }, { quoted: msg });
      return;
    }

    // 4) Mostrar agenda: /agenda
    if (lowerText === '/agenda') {
      const eventos = Object.entries(agenda)
        .map(([id, ev]) => `${id}: ${fechaFormateada(ev.fechaHora)} - ${ev.nombre}`)
        .join('\n');
      await sock.sendMessage(from, { text: eventos || 'No hay eventos en la agenda.' }, { quoted: msg });
      return;
    }

    // 5) Mostrar actividad: /actividad [usuario1 usuario2 ...]
    if (lowerText.startsWith('/actividad')) {
      const partes = text.trim().split(' ').slice(1);
      if (partes.length === 0) {
        let texto = 'Última actividad de usuarios:\n';
        for (const [jid, fecha] of Object.entries(activityLog)) {
          const nombre = usuarios[jid]?.nombre || 'Usuario';
          texto += `${nombre} (${jid}): ${fecha ? new Date(fecha).toLocaleString() : 'Nunca'}\n`;
        }
        await sock.sendMessage(from, { text: texto }, { quoted: msg });
      } else {
        let texto = 'Última actividad:\n';
        for (const usr of partes) {
          let jid = usr;
          if (!jid.includes('@s.whatsapp.net')) {
            const encontrado = Object.entries(usuarios).find(([jidUsr, info]) => info.nombre.toLowerCase() === usr.toLowerCase());
            if (encontrado) jid = encontrado[0];
          }
          if (activityLog[jid]) {
            texto += `${usuarios[jid]?.nombre || 'Usuario'} (${jid}): ${new Date(activityLog[jid]).toLocaleString()}\n`;
          } else {
            texto += `No hay actividad registrada para: ${usr}\n`;
          }
        }
        await sock.sendMessage(from, { text: texto }, { quoted: msg });
      }
      return;
    }

    // 6) Juegos y dinámicas: /juego <nombre>
    if (lowerText.startsWith('/juego')) {
      const partes = text.trim().split(' ');
      if (partes.length < 2) {
        await sock.sendMessage(from, { text: '❗ Usa /juego <nombre_del_juego>. Por ejemplo: /juego adivina' }, { quoted: msg });
        return;
      }
      const juego = partes[1].toLowerCase();

      if (juego === 'adivina') {
        const numero = Math.floor(Math.random() * 10) + 1;
        usuarios[sender].juegoActivo = { tipo: 'adivina', numero };
        guardarArchivo(USUARIOS_FILE, usuarios);
        await sock.sendMessage(from, { text: `🎲 ${usuarios[sender].nombre}, piensa un número del 1 al 10 y escríbelo para adivinar.` }, { quoted: msg });
        return;
      } else {
        await sock.sendMessage(from, { text: `❗ Juego "${juego}" no reconocido.` }, { quoted: msg });
        return;
      }
    }

    // Responder intentos de adivinar número (solo si juego activo)
    if (usuarios[sender]?.juegoActivo?.tipo === 'adivina') {
      const guess = parseInt(text.trim());
      if (!isNaN(guess)) {
        const numSecreto = usuarios[sender].juegoActivo.numero;
        if (guess === numSecreto) {
          await sock.sendMessage(from, { text: `🎉 ¡Correcto, ${usuarios[sender].nombre}! Adivinaste el número ${numSecreto}.` }, { quoted: msg });
          delete usuarios[sender].juegoActivo;
          guardarArchivo(USUARIOS_FILE, usuarios);
        } else {
          await sock.sendMessage(from, { text: `❌ Incorrecto, intenta otra vez.` }, { quoted: msg });
        }
        return;
      }
    }

    // RESPUESTA POR DEFECTO (AskGPT)
    console.log(`Mensaje de ${from}: ${text}`);
    const replyFromAI = await askChatGPT(text);
    const replyText = `Hola ${usuarios[sender].nombre}, ${replyFromAI}`;
    await sock.sendMessage(from, { text: replyText }, { quoted: msg });

  } catch (err) {
    console.error("Error manejando mensaje:", err);
  }
}

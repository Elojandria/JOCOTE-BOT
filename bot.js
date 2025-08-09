import baileys from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { handleMessage } from './handlers/messageHandler.js';

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

const REMINDERS_FILE = './data/reminders.json';

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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('Escanea este QR con WhatsApp:');
    }
    if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp');
    }
    if (connection === 'close') {
      console.log('❌ Desconectado de WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages[0]?.message) return;
    await handleMessage(sock, messages[0]);
  });

  // Función para enviar recordatorios pendientes
  setInterval(async () => {
    const reminders = cargarArchivo(REMINDERS_FILE);
    const ahora = new Date();

    for (const chatId in reminders) {
      const recordatoriosChat = reminders[chatId];
      for (const id in recordatoriosChat) {
        const recordatorio = recordatoriosChat[id];
        const fechaRecordatorio = new Date(recordatorio.fechaHora);

        // Enviar si el recordatorio está atrasado o justo a la hora actual (con margen 1 min)
        if (fechaRecordatorio <= ahora) {
          try {
            await sock.sendMessage(chatId, { text: `⏰ Recordatorio:\n${recordatorio.mensaje}` });
            // Borrar recordatorio enviado
            delete reminders[chatId][id];
          } catch (error) {
            console.error(`Error enviando recordatorio ${id} a ${chatId}:`, error);
          }
        }
      }
      // Si ya no quedan recordatorios para el chat, eliminar la clave
      if (Object.keys(reminders[chatId]).length === 0) {
        delete reminders[chatId];
      }
    }

    guardarArchivo(REMINDERS_FILE, reminders);
  }, 60 * 1000); // Ejecutar cada 1 minuto
}

startBot();

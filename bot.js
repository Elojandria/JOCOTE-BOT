import baileys from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';  // IMPORTAR ARRIBA
import { handleMessage } from './handlers/messageHandler.js';

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

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
      qrcode.generate(qr, { small: true });  // qrcode debe estar definido
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
}

startBot();

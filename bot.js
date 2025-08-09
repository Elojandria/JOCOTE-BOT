import baileys from '@whiskeysockets/baileys';

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

import { handleMessage } from './handlers/messageHandler.js';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        if (!messages[0]?.message) return;
        await handleMessage(sock, messages[0]);
    });
}

startBot();

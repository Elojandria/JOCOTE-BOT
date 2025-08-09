// index.js
import './bot.js'; 
sock.ev.on('connection.update', (update) => {
  if (update.connection === 'open') {
    const fullId = update?.me?.id || '';
    const botId = fullId.split(':')[0] + '@s.whatsapp.net';
    console.log('ID real del bot:', botId);
  }
});

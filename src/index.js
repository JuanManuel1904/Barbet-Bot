require('dotenv').config();

const { sendMessage } = require('./services/whatsapp');
const { handleMessage } = require('./bot/flow');
const { iniciarRecordatorios } = require('./services/recordatorios');


console.log('Token:', process.env.ACCESS_TOKEN?.slice(0, 20) + '...');
console.log('Phone ID:', process.env.PHONE_NUMBER_ID);
const express = require('express');
const app = express();
app.use(express.json());

// Verificación del webhook (Meta hace GET para confirmar)
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recepción de mensajes (Meta hace POST cuando llega un mensaje)
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body;

  console.log(`📩 Mensaje de ${from}: ${text}`);
  await handleMessage(from, text);

  res.sendStatus(200);
});

iniciarRecordatorios();

app.listen(process.env.PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT}`);
});



require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

// Middlewares
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Imports
const { sendMessage } = require('./services/whatsapp');
const { handleMessage } = require('./bot/flow');
const { iniciarRecordatorios } = require('./services/recordatorios');
const adminRouter = require('./routes/admin');

// Logs de verificación
console.log('Token:', process.env.ACCESS_TOKEN?.slice(0, 20) + '...');
console.log('Phone ID:', process.env.PHONE_NUMBER_ID);

// Rutas
app.use('/admin', adminRouter);
console.log('✅ Ruta /admin registrada');


// ... resto del código (webhook, app.listen, etc.)
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



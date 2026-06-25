const axios = require('axios');

async function sendMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
  console.log('📤 Enviando a URL:', url);

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Mensaje enviado a', to);
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data);
  }
}

module.exports = { sendMessage };

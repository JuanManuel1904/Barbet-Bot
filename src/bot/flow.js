// src/bot/flow.js
const { getSession, updateSession, clearSession } = require('./session');
const { sendMessage } = require('../services/whatsapp');
const { guardarCita, cancelarCita, reagendarCita } = require('../services/citas');


const SERVICIOS = {
  '1': 'Corte',
  '2': 'Barba',
  '3': 'Corte + Barba'
};

const BARBEROS = {
  '1': 'Carlos',
  '2': 'Andrés',
  '3': 'Miguel',
  '4': 'Sin preferencia'
};

async function handleMessage(from, text) {
  const session = getSession(from);
  const msg = text?.trim().toLowerCase();

  if (msg === 'cancelar') {
    const cancelado = await cancelarCita(from);
    await sendMessage(from, cancelado
      ? '✅ Tu cita fue cancelada exitosamente.'
      : '⚠️ No encontré citas activas para cancelar.'
    );
    clearSession(from);
    return;
  }

  if (msg === 'reagendar') {
  updateSession(from, 'REAGENDANDO_FECHA');
  await sendMessage(from,
    '📅 ¿A qué día quieres mover tu cita?\n\n' +
    '1️⃣ Lunes\n2️⃣ Martes\n3️⃣ Miércoles\n' +
    '4️⃣ Jueves\n5️⃣ Viernes\n6️⃣ Sábado'
  );
  return;
}

  switch (session.step) {


    case 'BIENVENIDA':
      await sendMessage(from,
        '✂️ ¡Bienvenido a la Barbería! ¿Qué servicio deseas?\n\n' +
        '1️⃣ Corte\n' +
        '2️⃣ Barba\n' +
        '3️⃣ Corte + Barba'
      );
      updateSession(from, 'ELIGIENDO_SERVICIO');
      break;

    case 'ELIGIENDO_SERVICIO':
      if (!SERVICIOS[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde 1, 2 o 3.');
        break;
      }
      updateSession(from, 'ELIGIENDO_BARBERO', { servicio: SERVICIOS[msg] });
      await sendMessage(from,
        '👤 ¿Con qué barbero prefieres?\n\n' +
        '1️⃣ Carlos\n' +
        '2️⃣ Andrés\n' +
        '3️⃣ Miguel\n' +
        '4️⃣ Sin preferencia'
      );
      break;

    case 'ELIGIENDO_BARBERO':
      if (!BARBEROS[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde 1, 2, 3 o 4.');
        break;
      }
      updateSession(from, 'ELIGIENDO_FECHA', { barbero: BARBEROS[msg] });
      await sendMessage(from,
        '📅 ¿Qué día te queda bien?\n\n' +
        '1️⃣ Lunes\n' +
        '2️⃣ Martes\n' +
        '3️⃣ Miércoles\n' +
        '4️⃣ Jueves\n' +
        '5️⃣ Viernes\n' +
        '6️⃣ Sábado'
      );
      break;

    case 'ELIGIENDO_FECHA':
      const dias = { '1':'Lunes','2':'Martes','3':'Miércoles','4':'Jueves','5':'Viernes','6':'Sábado' };
      if (!dias[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde un número del 1 al 6.');
        break;
      }
      updateSession(from, 'ELIGIENDO_HORA', { dia: dias[msg] });
      await sendMessage(from,
        '🕐 ¿Qué hora prefieres?\n\n' +
        '1️⃣ 9:00am\n' +
        '2️⃣ 11:00am\n' +
        '3️⃣ 1:00pm\n' +
        '4️⃣ 3:00pm\n' +
        '5️⃣ 5:00pm'
      );
      break;

    case 'ELIGIENDO_HORA':
      const horas = { '1':'9:00am','2':'11:00am','3':'1:00pm','4':'3:00pm','5':'5:00pm' };
      if (!horas[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde un número del 1 al 5.');
        break;
      }
      updateSession(from, 'CONFIRMANDO', { hora: horas[msg] });
      const { servicio, barbero, dia, hora } = { ...getSession(from).data, hora: horas[msg] };
      await sendMessage(from,
        `✅ *Resumen de tu cita:*\n\n` +
        `✂️ Servicio: ${servicio}\n` +
        `👤 Barbero: ${barbero}\n` +
        `📅 Día: ${dia}\n` +
        `🕐 Hora: ${horas[msg]}\n\n` +
        `¿Confirmas?\n1️⃣ Sí, confirmar\n2️⃣ No, cancelar`
      );
      break;

    case 'CONFIRMANDO':
      if (msg === '1') {
        const { servicio, barbero, dia, hora } = session.data;
        const citaId = await guardarCita({ telefono: from, barbero, servicio, dia, hora });
        await sendMessage(from,
          `🎉 ¡Cita confirmada! (ID: #${citaId})\n\n` +
          `✂️ ${servicio} con ${barbero}\n` +
          `📅 ${dia} a las ${hora}\n\n` +
          `Para cancelar escribe *cancelar* en cualquier momento.`
        );
        clearSession(from);
      } else if (msg === '2') {
        await sendMessage(from, '❌ Cita cancelada. Escribe *hola* para empezar de nuevo.');
        clearSession(from);
      } else {
        await sendMessage(from, 'Responde 1 para confirmar o 2 para cancelar.');
      }
      break;

    case 'REAGENDANDO_FECHA': {
      const dias = { '1':'Lunes','2':'Martes','3':'Miércoles','4':'Jueves','5':'Viernes','6':'Sábado' };
      if (!dias[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde un número del 1 al 6.');
        break;
      }
      updateSession(from, 'REAGENDANDO_HORA', { nuevoDia: dias[msg] });
      await sendMessage(from,
        '🕐 ¿A qué hora?\n\n' +
        '1️⃣ 9:00am\n2️⃣ 11:00am\n3️⃣ 1:00pm\n4️⃣ 3:00pm\n5️⃣ 5:00pm'
      );
      break;
    }

    case 'REAGENDANDO_HORA': {
      const horas = { '1':'9:00am','2':'11:00am','3':'1:00pm','4':'3:00pm','5':'5:00pm' };
      if (!horas[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde un número del 1 al 5.');
        break;
      }
      const { nuevoDia } = session.data;
      const citaId = await reagendarCita(from, { dia: nuevoDia, hora: horas[msg] });
      if (citaId) {
        await sendMessage(from,
          `✅ ¡Cita reagendada! (ID: #${citaId})\n` +
          `📅 ${nuevoDia} a las ${horas[msg]}`
        );
      } else {
        await sendMessage(from, '⚠️ No encontré citas activas para reagendar.');
      }
      clearSession(from);
      break;
    }

    default:
      clearSession(from);
      await handleMessage(from, text);
  }
}

module.exports = { handleMessage };

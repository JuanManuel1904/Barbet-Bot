// src/bot/flow.js
const { getSession, updateSession, clearSession } = require('./session');
const { sendMessage } = require('../services/whatsapp');
const { guardarCita, cancelarCita, reagendarCita, verificarDisponibilidad } = require('../services/citas');
const { getDiasDisponibles, getSlotsDisponibles, formatFecha } = require('../config/horario');

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

function listaDias(dias) {
  return dias.map((d, i) => `${i + 1}️⃣ ${d.label}`).join('\n');
}

function listaSlots(slots) {
  return slots.slice(0, 8).map((s, i) => `${i + 1}️⃣ ${s}`).join('\n');
}

async function handleMessage(from, text) {
  if (!text?.trim()) {
    await sendMessage(from, '⚠️ No entendí tu mensaje. Por favor escribe una opción.');
    return;
  }

  const session = await getSession(from);
  const msg = text.trim().toLowerCase();

  if (msg === 'cancelar') {
    const cancelado = await cancelarCita(from);
    await sendMessage(from, cancelado
      ? '✅ Tu cita fue cancelada exitosamente.'
      : '⚠️ No encontré citas activas para cancelar.'
    );
    await clearSession(from);
    return;
  }

  if (msg === 'reagendar') {
    const dias = getDiasDisponibles();
    if (dias.length === 0) {
      await sendMessage(from, '😔 No hay días disponibles para reagendar. Escribe *hola* más tarde.');
      return;
    }
    await updateSession(from, 'REAGENDANDO_FECHA');
    await sendMessage(from, `📅 ¿A qué día quieres mover tu cita?\n\n${listaDias(dias)}`);
    return;
  }

  switch (session.step) {

    case 'BIENVENIDA':
      await sendMessage(from, '✂️ ¡Bienvenido a la Barbería!\n\n¿Cuál es tu nombre?');
      await updateSession(from, 'PIDIENDO_NOMBRE');
      break;

    case 'PIDIENDO_NOMBRE':
      if (!msg || msg.length < 2) {
        await sendMessage(from, '❌ Por favor escribe tu nombre.');
        break;
      }
      await updateSession(from, 'ELIGIENDO_SERVICIO', { nombre: text.trim() });
      await sendMessage(from,
        `Hola ${text.trim()} 👋 ¿Qué servicio deseas?\n\n` +
        '1️⃣ Corte\n2️⃣ Barba\n3️⃣ Corte + Barba'
      );
      break;

    case 'ELIGIENDO_SERVICIO':
      if (!SERVICIOS[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde 1, 2 o 3.');
        break;
      }
      await updateSession(from, 'ELIGIENDO_BARBERO', { servicio: SERVICIOS[msg] });
      await sendMessage(from,
        '👤 ¿Con qué barbero prefieres?\n\n' +
        '1️⃣ Carlos\n2️⃣ Andrés\n3️⃣ Miguel\n4️⃣ Sin preferencia'
      );
      break;

    case 'ELIGIENDO_BARBERO': {
      if (!BARBEROS[msg]) {
        await sendMessage(from, '❌ Opción inválida. Responde 1, 2, 3 o 4.');
        break;
      }
      const dias = getDiasDisponibles();
      if (dias.length === 0) {
        await sendMessage(from, '😔 No hay días disponibles en los próximos días. Escribe *hola* más tarde.');
        await clearSession(from);
        break;
      }
      await updateSession(from, 'ELIGIENDO_FECHA', { barbero: BARBEROS[msg] });
      await sendMessage(from, `📅 ¿Qué día te queda bien?\n\n${listaDias(dias)}`);
      break;
    }

    case 'ELIGIENDO_FECHA': {
      const dias = getDiasDisponibles();
      const opcion = parseInt(msg) - 1;

      if (isNaN(opcion) || opcion < 0 || opcion >= dias.length) {
        await sendMessage(from, `❌ Opción inválida.\n\n📅 ¿Qué día te queda bien?\n\n${listaDias(dias)}`);
        break;
      }

      const diaElegido = dias[opcion];
      const slots = await getSlotsDisponibles(diaElegido.fecha, session.data.barbero);

      if (slots.length === 0) {
        await sendMessage(from,
          `😔 No hay horarios disponibles para ${diaElegido.label}. Elige otro día:\n\n${listaDias(dias)}`
        );
        break;
      }

      await updateSession(from, 'ELIGIENDO_HORA', {
        fecha: diaElegido.fecha,
        diaLabel: diaElegido.label,
        slots,
      });
      await sendMessage(from, `🕐 ¿Qué hora prefieres?\n\n${listaSlots(slots)}`);
      break;
    }

    case 'ELIGIENDO_HORA': {
      const { barbero, fecha, diaLabel, slots = [] } = session.data;
      const opcion = parseInt(msg) - 1;

      if (isNaN(opcion) || opcion < 0 || opcion >= Math.min(slots.length, 8)) {
        // Regenerar slots por si cambiaron
        const slotsActuales = await getSlotsDisponibles(fecha, barbero);
        if (slotsActuales.length === 0) {
          const dias = getDiasDisponibles();
          await updateSession(from, 'ELIGIENDO_FECHA', { barbero });
          await sendMessage(from,
            `😔 Ya no quedan horarios para ${diaLabel}. Elige otro día:\n\n${listaDias(dias)}`
          );
          break;
        }
        await updateSession(from, 'ELIGIENDO_HORA', { ...session.data, slots: slotsActuales });
        await sendMessage(from, `❌ Opción inválida.\n\n🕐 ¿Qué hora prefieres?\n\n${listaSlots(slotsActuales)}`);
        break;
      }

      const horaElegida = slots[opcion];
      const disponible = await verificarDisponibilidad(barbero, fecha, horaElegida);
      if (!disponible) {
        const slotsActuales = await getSlotsDisponibles(fecha, barbero);
        await updateSession(from, 'ELIGIENDO_HORA', { ...session.data, slots: slotsActuales });
        await sendMessage(from,
          `⚠️ Ese horario ya fue tomado. Elige otro:\n\n${listaSlots(slotsActuales)}`
        );
        break;
      }

      const { nombre, servicio } = session.data;
      await updateSession(from, 'CONFIRMANDO', { hora: horaElegida });
      await sendMessage(from,
        `✅ *Resumen de tu cita:*\n\n` +
        `🙍 Nombre: ${nombre}\n` +
        `✂️ Servicio: ${servicio}\n` +
        `👤 Barbero: ${barbero}\n` +
        `📅 Día: ${formatFecha(fecha)}\n` +
        `🕐 Hora: ${horaElegida}\n\n` +
        `¿Confirmas?\n1️⃣ Sí, confirmar\n2️⃣ No, cancelar`
      );
      break;
    }

    case 'CONFIRMANDO':
      if (msg === '1') {
        const { servicio, barbero, fecha, hora, nombre } = session.data;
        const disponible = await verificarDisponibilidad(barbero, fecha, hora);
        if (!disponible) {
          await sendMessage(from,
            '⚠️ Lo sentimos, ese horario acaba de ser tomado.\n' +
            'Escribe *hola* para elegir un nuevo horario.'
          );
          await clearSession(from);
          break;
        }
        const citaId = await guardarCita({ telefono: from, nombre, barbero, servicio, fecha, hora });
        await sendMessage(from,
          `🎉 ¡Cita confirmada! (ID: #${citaId})\n\n` +
          `✂️ ${servicio} con ${barbero}\n` +
          `📅 ${formatFecha(fecha)}\n` +
          `🕐 ${hora}\n\n` +
          `Para cancelar escribe *cancelar* en cualquier momento.`
        );
        await clearSession(from);
      } else if (msg === '2') {
        await sendMessage(from, '❌ Cita cancelada. Escribe *hola* para empezar de nuevo.');
        await clearSession(from);
      } else {
        await sendMessage(from, 'Responde 1 para confirmar o 2 para cancelar.');
      }
      break;

    case 'REAGENDANDO_FECHA': {
      const dias = getDiasDisponibles();
      const opcion = parseInt(msg) - 1;

      if (isNaN(opcion) || opcion < 0 || opcion >= dias.length) {
        await sendMessage(from, `❌ Opción inválida.\n\n📅 ¿A qué día quieres mover tu cita?\n\n${listaDias(dias)}`);
        break;
      }

      const diaElegido = dias[opcion];
      const slots = await getSlotsDisponibles(diaElegido.fecha, session.data.barbero || 'Carlos');

      if (slots.length === 0) {
        await sendMessage(from,
          `😔 No hay horarios disponibles para ${diaElegido.label}. Elige otro día:\n\n${listaDias(dias)}`
        );
        break;
      }

      await updateSession(from, 'REAGENDANDO_HORA', {
        nuevaFecha: diaElegido.fecha,
        nuevoDiaLabel: diaElegido.label,
        slots,
      });
      await sendMessage(from, `🕐 ¿A qué hora?\n\n${listaSlots(slots)}`);
      break;
    }

    case 'REAGENDANDO_HORA': {
      const { nuevaFecha, nuevoDiaLabel, slots = [] } = session.data;
      const opcion = parseInt(msg) - 1;

      if (isNaN(opcion) || opcion < 0 || opcion >= Math.min(slots.length, 8)) {
        await sendMessage(from, `❌ Opción inválida.\n\n🕐 ¿A qué hora?\n\n${listaSlots(slots)}`);
        break;
      }

      const horaElegida = slots[opcion];
      const citaId = await reagendarCita(from, { fecha: nuevaFecha, hora: horaElegida });
      if (citaId) {
        await sendMessage(from,
          `✅ ¡Cita reagendada! (ID: #${citaId})\n` +
          `📅 ${formatFecha(nuevaFecha)}\n` +
          `🕐 ${horaElegida}`
        );
      } else {
        await sendMessage(from, '⚠️ No encontré citas activas para reagendar.');
      }
      await clearSession(from);
      break;
    }

    default:
      await clearSession(from);
      await handleMessage(from, text);
  }
}

module.exports = { handleMessage };

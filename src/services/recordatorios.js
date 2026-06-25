// src/services/recordatorios.js
const cron = require('node-cron');
const pool = require('../db');
const { sendMessage } = require('./whatsapp');

function iniciarRecordatorios() {
  // Se ejecuta cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Revisando recordatorios...');

    try {
      // Buscar citas que sean en los próximos 60 minutos
      // y que no hayan recibido recordatorio aún
      const result = await pool.query(`
        SELECT
          c.id,
          c.fecha,
          c.hora,
          cl.telefono,
          b.nombre AS barbero,
          s.nombre AS servicio
        FROM citas c
        JOIN clientes cl ON cl.id = c.cliente_id
        JOIN barberos b ON b.id = c.barbero_id
        JOIN servicios s ON s.id = c.servicio_id
        WHERE c.estado = 'confirmada'
          AND c.recordatorio_enviado = FALSE
          AND (c.fecha + c.hora) BETWEEN NOW() AND NOW() + INTERVAL '65 minutes'
      `);

      for (const cita of result.rows) {
        await sendMessage(cita.telefono,
          `⏰ *Recordatorio de cita*\n\n` +
          `Tu cita es en aproximadamente 1 hora:\n` +
          `✂️ ${cita.servicio} con ${cita.barbero}\n` +
          `📅 ${cita.fecha} a las ${cita.hora}\n\n` +
          `Si necesitas cancelar escribe *cancelar*`
        );

        // Marcar recordatorio como enviado
        await pool.query(
          'UPDATE citas SET recordatorio_enviado = TRUE WHERE id = $1',
          [cita.id]
        );

        console.log(`✅ Recordatorio enviado para cita #${cita.id}`);
      }
    } catch (err) {
      console.error('❌ Error en recordatorios:', err.message);
    }
  });

  console.log('⏰ Sistema de recordatorios activo');
}

module.exports = { iniciarRecordatorios };

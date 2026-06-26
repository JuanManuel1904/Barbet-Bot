// src/routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        TO_CHAR(c.hora, 'HH12:MI AM') AS hora,
        c.estado,
        cl.telefono,
        cl.nombre AS cliente,
        b.nombre AS barbero,
        s.nombre AS servicio
      FROM citas c
      JOIN clientes cl ON cl.id = c.cliente_id
      JOIN barberos b ON b.id = c.barbero_id
      JOIN servicios s ON s.id = c.servicio_id
      WHERE c.fecha = NOW()::date
      ORDER BY c.hora ASC
    `);

    const citas = result.rows;
    const barberos = [...new Set(citas.map(c => c.barbero))];
    const totalHoy = citas.length;
    const completadas = citas.filter(c => c.estado === 'completada').length;
    const pendientes = citas.filter(c => c.estado === 'confirmada').length;
    const fecha = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    res.render('admin', { citas, barberos, totalHoy, completadas, pendientes, fecha });
  } catch (err) {
    console.error('❌ Error en /admin:', err.message);
    res.status(500).send(`<pre>Error: ${err.message}</pre>`);
  }
});

router.post('/completar/:id', async (req, res) => {
  try {
    await pool.query(
      "UPDATE citas SET estado = 'completada' WHERE id = $1",
      [req.params.id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error al completar cita:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;

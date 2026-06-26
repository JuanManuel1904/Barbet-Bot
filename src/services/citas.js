const pool = require('../db');
const { slotToTime } = require('../config/horario');

async function guardarCita({ telefono, nombre, barbero, servicio, fecha, hora }) {
  let cliente = await pool.query(
    'SELECT id FROM clientes WHERE telefono = $1', [telefono]
  );
  if (cliente.rows.length === 0) {
    cliente = await pool.query(
      'INSERT INTO clientes (telefono, nombre) VALUES ($1, $2) RETURNING id', [telefono, nombre]
    );
  } else {
    await pool.query(
      'UPDATE clientes SET nombre = $1 WHERE telefono = $2', [nombre, telefono]
    );
  }
  const clienteId = cliente.rows[0].id;

  const barberoResult = await pool.query(
    'SELECT id FROM barberos WHERE nombre = $1',
    [barbero === 'Sin preferencia' ? 'Carlos' : barbero]
  );
  const barberoId = barberoResult.rows[0].id;

  const servicioResult = await pool.query(
    'SELECT id FROM servicios WHERE nombre = $1', [servicio]
  );
  const servicioId = servicioResult.rows[0].id;

  const cita = await pool.query(
    `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [clienteId, barberoId, servicioId, fecha, slotToTime(hora)]
  );

  return cita.rows[0].id;
}

async function cancelarCita(telefono) {
  const result = await pool.query(
    `UPDATE citas SET estado = 'cancelada'
     WHERE cliente_id = (SELECT id FROM clientes WHERE telefono = $1)
       AND estado = 'confirmada'
       AND fecha >= NOW()::date
     RETURNING id`,
    [telefono]
  );
  return result.rowCount > 0;
}

// fecha: 'YYYY-MM-DD', hora: display string ('9:00am', etc.)
async function verificarDisponibilidad(barbero, fecha, hora) {
  const result = await pool.query(
    `SELECT 1 FROM citas
     WHERE barbero_id = (SELECT id FROM barberos WHERE nombre = $1)
       AND fecha = $2
       AND hora = $3
       AND estado = 'confirmada'
     LIMIT 1`,
    [barbero === 'Sin preferencia' ? 'Carlos' : barbero, fecha, slotToTime(hora)]
  );
  return result.rowCount === 0; // true = disponible
}

// fecha: 'YYYY-MM-DD', hora: display string
async function reagendarCita(telefono, { fecha, hora }) {
  const result = await pool.query(
    `UPDATE citas SET fecha = $1, hora = $2
     WHERE cliente_id = (SELECT id FROM clientes WHERE telefono = $3)
       AND estado = 'confirmada'
       AND fecha >= NOW()::date
     RETURNING id`,
    [fecha, slotToTime(hora), telefono]
  );
  return result.rowCount > 0 ? result.rows[0].id : null;
}

async function limpiarCitasVencidas() {
  const result = await pool.query(`DELETE FROM citas WHERE fecha < NOW()::date`);
  console.log(`🧹 Citas vencidas eliminadas: ${result.rowCount}`);
}

module.exports = { guardarCita, cancelarCita, reagendarCita, limpiarCitasVencidas, verificarDisponibilidad };

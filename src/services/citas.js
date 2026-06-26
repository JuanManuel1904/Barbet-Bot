// src/services/citas.js
const pool = require('../db');

async function guardarCita({ telefono, nombre, barbero, servicio, dia, hora }) {
  // Buscar o crear cliente y actualizar nombre
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

  // Buscar barbero
  const barberoResult = await pool.query(
    'SELECT id FROM barberos WHERE nombre = $1', [barbero === 'Sin preferencia' ? 'Carlos' : barbero]
  );
  const barberoId = barberoResult.rows[0].id;

  // Buscar servicio
  const servicioResult = await pool.query(
    'SELECT id FROM servicios WHERE nombre = $1', [servicio]
  );
  const servicioId = servicioResult.rows[0].id;

  // Convertir día a fecha real (próximo día disponible)
  const fecha = proximaFecha(dia);

  // Convertir hora a formato TIME
  const horaFormato = convertirHora(hora);

  // Guardar cita
  const cita = await pool.query(
    `INSERT INTO citas (cliente_id, barbero_id, servicio_id, fecha, hora)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [clienteId, barberoId, servicioId, fecha, horaFormato]
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

function proximaFecha(dia) {
  const dias = { 'Lunes':1,'Martes':2,'Miércoles':3,'Jueves':4,'Viernes':5,'Sábado':6 };
  const hoy = new Date();
  const diaObjetivo = dias[dia];
  const diaActual = hoy.getDay();
  let diff = diaObjetivo - diaActual;
  if (diff <= 0) diff += 7;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diff);
  return fecha.toISOString().split('T')[0];
}

function convertirHora(hora) {
  const mapa = {
    '9:00am': '09:00:00',
    '11:00am': '11:00:00',
    '1:00pm': '13:00:00',
    '3:00pm': '15:00:00',
    '5:00pm': '17:00:00'
  };
  return mapa[hora];
}

async function reagendarCita(telefono, { dia, hora }) {
  const fecha = proximaFecha(dia);
  const horaFormato = convertirHora(hora);

  const result = await pool.query(
    `UPDATE citas SET fecha = $1, hora = $2
     WHERE cliente_id = (SELECT id FROM clientes WHERE telefono = $3)
     AND estado = 'confirmada'
     AND fecha >= NOW()::date
     RETURNING id`,
    [fecha, horaFormato, telefono]
  );

  return result.rowCount > 0 ? result.rows[0].id : null;
}

module.exports = { guardarCita, cancelarCita, reagendarCita };

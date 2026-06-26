const pool = require('../db');

const MANANA = ['9:00am', '9:45am', '10:30am', '11:15am'];
const TARDE  = ['2:00pm', '2:45pm', '3:30pm', '4:15pm', '5:00pm', '5:45pm', '6:30pm'];

const HORARIO = {
  'Lunes':     null,
  'Martes':    { slots: [...MANANA, ...TARDE] },
  'Miércoles': { slots: [...MANANA, ...TARDE] },
  'Jueves':    { slots: [...MANANA, ...TARDE] },
  'Viernes':   { slots: [...MANANA, ...TARDE] },
  'Sábado':    { slots: [...MANANA, ...TARDE] },
  'Domingo':   { slots: [...MANANA] },
};

const MAX_DIAS_ANTELACION = 5;

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const SLOT_TO_TIME = {
  '9:00am':  '09:00:00',
  '9:45am':  '09:45:00',
  '10:30am': '10:30:00',
  '11:15am': '11:15:00',
  '2:00pm':  '14:00:00',
  '2:45pm':  '14:45:00',
  '3:30pm':  '15:30:00',
  '4:15pm':  '16:15:00',
  '5:00pm':  '17:00:00',
  '5:45pm':  '17:45:00',
  '6:30pm':  '18:30:00',
};

function slotToTime(slot) {
  return SLOT_TO_TIME[slot];
}

// Retorna los próximos N días calendario. Los días cerrados no se incluyen
// pero sí cuentan hacia el límite (maxDias = días calendario revisados).
function getDiasDisponibles(maxDias = MAX_DIAS_ANTELACION) {
  const resultado = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (let i = 1; i <= maxDias; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    const diaNombre = DIAS_SEMANA[fecha.getDay()];
    const horario = HORARIO[diaNombre];

    if (!horario) continue; // cerrado, cuenta pero no se muestra

    const yyyy = fecha.getFullYear();
    const mm   = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd   = String(fecha.getDate()).padStart(2, '0');
    const fechaStr = `${yyyy}-${mm}-${dd}`;

    let label;
    if (i === 1)      label = 'Mañana';
    else if (i === 2) label = 'Pasado mañana';
    else              label = diaNombre;

    resultado.push({ fecha: fechaStr, label, slots: horario.slots });
  }

  return resultado;
}

// Retorna los slots libres para una fecha dada y un barbero específico.
async function getSlotsDisponibles(fecha, barbero) {
  // Usar noon para evitar problemas de zona horaria al parsear YYYY-MM-DD
  const date = new Date(fecha + 'T12:00:00');
  const diaNombre = DIAS_SEMANA[date.getDay()];
  const horario = HORARIO[diaNombre];

  if (!horario) return [];

  const nombreBarbero = barbero === 'Sin preferencia' ? 'Carlos' : barbero;

  const result = await pool.query(
    `SELECT hora FROM citas
     WHERE fecha = $1
       AND barbero_id = (SELECT id FROM barberos WHERE nombre = $2)
       AND estado = 'confirmada'`,
    [fecha, nombreBarbero]
  );

  const ocupadas = new Set(result.rows.map(r => r.hora));
  return horario.slots.filter(slot => !ocupadas.has(SLOT_TO_TIME[slot]));
}

// '2026-06-27' → 'sábado 27 de junio'
function formatFecha(fechaStr) {
  const date = new Date(fechaStr + 'T12:00:00');
  const meses   = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const diasMin = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  return `${diasMin[date.getDay()]} ${date.getDate()} de ${meses[date.getMonth()]}`;
}

module.exports = { HORARIO, MAX_DIAS_ANTELACION, slotToTime, getDiasDisponibles, getSlotsDisponibles, formatFecha };

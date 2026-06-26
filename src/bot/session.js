const pool = require('../db');

async function getSession(phone) {
  const result = await pool.query(
    'SELECT step, data FROM sessions WHERE telefono = $1',
    [phone]
  );
  if (result.rowCount === 0) {
    return { step: 'BIENVENIDA', data: {} };
  }
  return { step: result.rows[0].step, data: result.rows[0].data };
}

async function updateSession(phone, step, data = {}) {
  const current = await pool.query(
    'SELECT data FROM sessions WHERE telefono = $1',
    [phone]
  );
  const prevData = current.rowCount > 0 ? current.rows[0].data : {};
  const merged = { ...prevData, ...data };

  await pool.query(
    `INSERT INTO sessions (telefono, step, data, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (telefono) DO UPDATE
       SET step = $2, data = $3, updated_at = NOW()`,
    [phone, step, JSON.stringify(merged)]
  );
}

async function clearSession(phone) {
  await pool.query('DELETE FROM sessions WHERE telefono = $1', [phone]);
}

module.exports = { getSession, updateSession, clearSession };

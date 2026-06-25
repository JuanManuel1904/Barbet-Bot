const { Pool } = require('pg');

console.log('🔗 Intentando conectar a:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch(err => {
    console.error('❌ Error BD completo:', err);
  });

module.exports = pool;

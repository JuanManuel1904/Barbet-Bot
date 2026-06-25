// src/bot/session.js

// Guardamos el estado de cada conversación en memoria
// { '573127014863': { step: 'BIENVENIDA', data: {} } }
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 'BIENVENIDA', data: {} };
  }
  return sessions[phone];
}

function updateSession(phone, step, data = {}) {
  sessions[phone] = {
    step,
    data: { ...sessions[phone]?.data, ...data }
  };
}

function clearSession(phone) {
  delete sessions[phone];
}

module.exports = { getSession, updateSession, clearSession };

'use strict';
const { createHash } = require('node:crypto');
const { allowedFields, sameToken } = require('../security-policy.cjs');
const { revisionOf, applyOperations } = require('../storage-patch.cjs');
const { validateFinancialState } = require('../financial-validation.cjs');
const { validEnvelope } = require('./state-envelope.cjs');
const { send, readJSON } = require('./http-transport.cjs');
/**
 * Adapta /api/storage al contrato de repositorio de la cuenta ya autenticada.
 * La composición HTTP aplica antes origen, sesión, cuenta activa y cuotas.
 * Este módulo conserva además CSRF, tipos, revisión, validación e idempotencia.
 * @param {import('node:http').IncomingMessage} req Solicitud protegida por el servidor.
 * @param {import('node:http').ServerResponse} res Respuesta HTTP.
 * @param {object} context Repositorio elegido por la sesión y límites administrativos.
 * @returns {Promise<void>} Responde solo después del resultado del repositorio.
 * @throws {Error} Propaga errores al manejador central, que sanea el mensaje externo.
 * No importa SQLite ni el servidor y nunca elige propietario desde la solicitud.
 */
async function handleStorage(req, res, { requested, session, activeStore, token, maxStateBytes }) {
  if ([...requested.searchParams.keys()].some(key => key !== 'revision')) return send(res, 400, { error: 'Parámetro no permitido.' });
  if (session && req.headers['x-mibolsillo-account'] && req.headers['x-mibolsillo-account'] !== String(session.user.id)) return send(res, 401, { error: 'La cuenta activa cambió. Inicia sesión de nuevo.' });
  if (req.method === 'GET') {
    const raw = activeStore.get(), revision = revisionOf(raw);
    return send(res, 200, requested.searchParams.has('revision') && requested.searchParams.get('revision') === String(revision)
      ? { unchanged: true, revision } : { raw, revision });
  }
  if (!['POST', 'PATCH'].includes(req.method)) return send(res, 405, { error: 'Método no permitido' });
  if (!sameToken(req.headers['x-mibolsillo-token'], token)) return send(res, 403, { error: 'Token no válido' });
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    return send(res, 415, { error: 'Use application/json' });
  }
  const body = await readJSON(req);
  allowedFields(body, req.method === 'PATCH' ? ['expectedRevision','operationId','operations'] : ['expectedRaw','raw'], 403);
  if (req.method === 'PATCH') {
    if (!body || !Object.prototype.hasOwnProperty.call(body,'expectedRevision') || (body.expectedRevision !== null && typeof body.expectedRevision !== 'string') || typeof body.operationId !== 'string' || !body.operationId || body.operationId.length > 300) return send(res, 400, { error: 'Revisión u operación inválida.' });
    const current = activeStore.get(), revision = revisionOf(current);
    const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const receipt = activeStore.receipt(body.operationId);
    if (receipt) {
      if (receipt.request_hash !== requestHash || revision !== body.operationId) return send(res, 409, { error: 'La operación ya se utilizó o los datos cambiaron. Revisa el estado guardado.' });
      return send(res, 200, { ok: true, duplicate: true, revision });
    }
    if (revision === body.operationId) return send(res, 409, { error: 'No se puede verificar el intento anterior. Revisa el estado guardado.' });
    if (revision !== body.expectedRevision) return send(res, 409, { error: 'conflict', raw: current, revision });
    const raw = applyOperations(current, body.operations);
    if (Buffer.byteLength(raw) > maxStateBytes) return send(res, 413, { error: 'El estado supera el tamaño permitido.' });
    if (!validEnvelope(raw) || revisionOf(raw) !== body.operationId) return send(res, 400, { error: 'El estado incremental o su revisión no es válido.' });
    validateFinancialState(JSON.parse(raw).data, current ? JSON.parse(current).data : null);
    const result = activeStore.compareAndSet(current, raw, { operationId: body.operationId, requestHash });
    return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, revision: revisionOf(raw) } : { error: 'conflict', raw: result.raw, revision: revisionOf(result.raw) });
  }
  if (!body || (body.expectedRaw !== null && typeof body.expectedRaw !== 'string') || !validEnvelope(body.raw)) {
    return send(res, 400, { error: 'Formato de estado inválido' });
  }
  const current = activeStore.get();
  if (Buffer.byteLength(body.raw) > maxStateBytes) return send(res, 413, { error: 'El estado supera el tamaño permitido.' });
  if (current === body.expectedRaw) validateFinancialState(JSON.parse(body.raw).data, current ? JSON.parse(current).data : null);
  const result = activeStore.compareAndSet(body.expectedRaw, body.raw);
  return send(res, result.ok ? 200 : 409, result.ok ? result : { error: 'conflict', raw: result.raw });
}
module.exports = { handleStorage };

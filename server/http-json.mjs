// Author: Tommy
// Do not expose upstream response bytes or parser diagnostics to the UI/journal.
export async function readHttpJson(response, { maxBytes, prefix }) {
  const chunks = []; let size = 0;
  try {
    if (!response.body) throw new Error('empty body');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error(`${prefix}_RESPONSE_TOO_LARGE`);
      chunks.push(chunk);
    }
  } catch (error) {
    if (error.message === `${prefix}_RESPONSE_TOO_LARGE`) throw error;
    if (['AbortError', 'TimeoutError'].includes(error.name)) throw new Error(`${prefix}_RESPONSE_TIMEOUT`);
    throw new Error(`${prefix}_RESPONSE_UNAVAILABLE`);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error(`${prefix}_INVALID_JSON`); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(`${prefix}_INVALID_RESPONSE`);
  return body;
}

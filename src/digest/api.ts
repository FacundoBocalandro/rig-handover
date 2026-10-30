import type { Context } from 'hono';
import type { RigConfig } from '../config.js';

// GET /api/digest/:night
export function digestJson(c: Context, _config: RigConfig) {
  return c.json({ error: 'not implemented: #4' }, 501);
}

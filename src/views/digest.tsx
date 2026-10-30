import type { Context } from 'hono';
import type { RigConfig } from '../config.js';

// GET /digest/:night
export function digestPage(c: Context, _config: RigConfig) {
  return c.text('not implemented: #3', 501);
}

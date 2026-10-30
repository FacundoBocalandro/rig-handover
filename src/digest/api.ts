import type { Context } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

// GET /api/digest/:night
export function digestJson(c: Context, config: RigConfig) {
  const night = c.req.param('night') ?? '';
  const data = readNight(config.runsDir, night);
  if (!data) return c.json({ error: 'no run log', night }, 404);
  return c.json({ night: data.night, badLines: data.badLines, counts: data.counts, rows: data.rows }, 200);
}

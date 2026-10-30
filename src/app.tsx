import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { digestJson } from './digest/api.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { digestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => digestPage(c, config));

  app.get('/api/digest/:night', (c) => digestJson(c, config));

  return app;
}

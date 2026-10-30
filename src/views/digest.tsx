import type { Context } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from '../digest/reader.js';
import type { DigestRow } from '../digest/types.js';
import { lane } from '../lane.js';
import { Layout } from './layout.js';

const MISSING = '—';

function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function DigestTable({ rows }: { rows: DigestRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>job</th>
          <th>owner</th>
          <th>runs</th>
          <th>retries</th>
          <th>last status</th>
          <th>last error</th>
          <th>first</th>
          <th>last</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr class={isWarn(row) ? 'warn' : undefined}>
            <td>{row.job}</td>
            <td>{row.owner ?? MISSING}</td>
            <td>{row.runs}</td>
            <td>{row.retries}</td>
            <td>{row.lastStatus}</td>
            <td>{row.lastError ?? MISSING}</td>
            <td>{row.firstAt}</td>
            <td>{row.lastAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// GET /digest/:night
export function digestPage(c: Context, config: RigConfig) {
  const night = c.req.param('night') ?? '';
  const data = readNight(config.runsDir, night);
  const title = `digest ${night}`;

  if (!data) {
    return c.html(
      <Layout title={title} lane={lane()}>
        <h1>{title}</h1>
        <p>no run log for {night}</p>
      </Layout>,
      404,
    );
  }

  return c.html(
    <Layout title={title} lane={lane()}>
      <h1>{title}</h1>
      {data.badLines > 0 ? <p class="warn">unreadable lines: {data.badLines}</p> : null}
      {data.rows.length === 0 ? <p class="mute">nothing ran</p> : <DigestTable rows={data.rows} />}
    </Layout>,
  );
}

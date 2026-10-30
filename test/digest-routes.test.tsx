import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const log = (...lines: object[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
const at = (m: number) => `2026-10-29T01:${String(m).padStart(2, '0')}:00+01:00`;

const GOOD = log(
  { at: at(0), job: 'zeta/clean', status: 'ok', owner: 'rook' },
  { at: at(1), job: 'alpha/flaky', status: 'retry' },
  { at: at(2), job: 'alpha/flaky', status: 'retry' },
  { at: at(3), job: 'alpha/flaky', status: 'retry' },
  { at: at(4), job: 'alpha/flaky', status: 'ok' },
  { at: at(5), job: 'mid/broken', status: 'retry', owner: 'sam' },
  { at: at(6), job: 'mid/broken', status: 'fail', owner: 'sam', error: 'quota exceeded' },
);
const SORTED_JOBS = ['alpha/flaky', 'mid/broken', 'zeta/clean'];

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, '2026-10-01.jsonl'), GOOD);
  writeFileSync(join(dir, '2026-10-02.jsonl'), '');
  writeFileSync(join(dir, '2026-10-03.jsonl'), `${log({ at: at(0), job: 'one/job', status: 'ok' })}not json\n{"at":1}\n`);
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

// The whole <tr> that holds a job name.
function rowOf(html: string, job: string): string {
  const m = html.match(new RegExp(`<tr[^>]*>(?:(?!</tr>).)*${job}(?:(?!</tr>).)*</tr>`, 's'));
  if (!m) throw new Error(`no row for ${job}`);
  return m[0];
}

type Json = { night: string; badLines: number; counts: unknown; rows: { job: string; owner: string | null; lastError: string | null }[] };

describe('GET /digest/:night', () => {
  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-09-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-09-09');
  });

  it('renders the night: heading, banner, one row per job', async () => {
    const res = await app.request('/digest/2026-10-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>digest 2026-10-01</h1>');
    expect(html).toContain('TEST-MARKER');
    for (const job of SORTED_JOBS) expect(rowOf(html, job)).toContain(job);
    expect(html).not.toContain('unreadable lines');
  });

  it('marks rows with 3+ retries or a last status of fail as warn', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    expect(rowOf(html, 'alpha/flaky')).toContain('class="warn"');
    expect(rowOf(html, 'mid/broken')).toContain('class="warn"');
    expect(rowOf(html, 'zeta/clean')).not.toContain('class="warn"');
  });

  it('shows — for a null owner', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    expect(rowOf(html, 'alpha/flaky')).toContain('—');
  });

  it('says nothing ran for an empty file, with no table', async () => {
    const res = await app.request('/digest/2026-10-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('shows the count of unreadable lines', async () => {
    const res = await app.request('/digest/2026-10-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('unreadable lines: 2');
    expect(html).toContain('one/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 404 with an error body for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-09-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-09-09' });
  });

  it('returns night, badLines, counts and rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-01');
    const body = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['badLines', 'counts', 'night', 'rows']);
    expect(body.night).toBe('2026-10-01');
    expect(body.badLines).toBe(0);
    expect(body.counts).toEqual({ ok: 2, retry: 4, fail: 1 });
    expect(body.rows.map((r) => r.job)).toEqual(SORTED_JOBS);
  });

  it('keeps owner and lastError as null, not dropped', async () => {
    const body = (await (await app.request('/api/digest/2026-10-01')).json()) as Json;
    const flaky = body.rows.find((r) => r.job === 'alpha/flaky')!;
    expect(flaky).toHaveProperty('owner', null);
    expect(flaky).toHaveProperty('lastError', null);
    expect(body.rows.find((r) => r.job === 'mid/broken')).toMatchObject({ owner: 'sam', lastError: 'quota exceeded' });
  });

  it('returns no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-02');
    const body = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts bad lines and still returns the good ones', async () => {
    const res = await app.request('/api/digest/2026-10-03');
    const body = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['one/job']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-10-01')).text();
    const body = (await (await app.request('/api/digest/2026-10-01')).json()) as Json;
    const inPage = SORTED_JOBS.map((job) => ({ job, at: html.indexOf(job) })).sort((a, b) => a.at - b.at).map((x) => x.job);
    expect(inPage).toEqual(body.rows.map((r) => r.job));
  });
});

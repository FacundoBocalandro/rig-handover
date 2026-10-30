// Plan morning-digest § 1. The contract every part of § 2 builds against.
export type DigestStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times are kept as written in the log, offset included.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job. The page and the JSON both show them in this order.
  rows: DigestRow[];
  // Lines that didn't parse: counted, never thrown.
  badLines: number;
  // Lines per status, across all jobs.
  counts: Record<DigestStatus, number>;
};

// `null` when the night has no file (or isn't a YYYY-MM-DD night).
export type ReadNight = (runsDir: string, night: string) => Night | null;

/**
 * Drizzle client over Postgres (Supabase) using the postgres-js driver.
 *
 * App code imports `lib/db/client` (adds the `server-only` guard); this module
 * exists so CLI scripts (seed, migrate) can reuse the same connection.
 *
 * Env:
 *  - DATABASE_URL  the Supabase Postgres connection string. Use the
 *    "Transaction" pooler URL (port 6543) for serverless/Vercel.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __daddypromoosSql: ReturnType<typeof postgres> | undefined;
  var __daddypromoosDb: ReturnType<typeof createClient> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase Postgres connection string.",
    );
  }
  // Use Supabase's TRANSACTION pooler (port 6543) — the serverless-correct one:
  // it multiplexes many client connections over few DB connections, so Vercel's
  // many function instances don't hit the session pooler's 15-client cap
  // (EMAXCONNSESSION 500s).
  //
  // `prepare: false` is required (pgBouncer transaction mode can't do prepared
  // statements). `max: 15` must stay >= the most queries any single request
  // fires concurrently: postgres.js only deadlocks the transaction pooler when
  // it has to *pipeline* (concurrency > max), so keeping max above per-request
  // concurrency means every query gets its own connection and it never pipelines.
  const sql =
    globalThis.__daddypromoosSql ??
    postgres(url, {
      prepare: false,
      max: 15,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  globalThis.__daddypromoosSql = sql;
  return drizzle(sql, { schema });
}

/** Singleton across dev HMR reloads. */
export const db = globalThis.__daddypromoosDb ?? createClient();
globalThis.__daddypromoosDb = db;

export type DbClient = typeof db;

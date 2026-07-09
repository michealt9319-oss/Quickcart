import { Pool, PoolClient } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/// For operations that need multiple statements to succeed or fail
/// together — e.g. decrementing stock for several line items AND creating
/// the order row. Without this, a failure on item 2 of 3 could leave item
/// 1's stock permanently decremented for an order that was never actually
/// created. The callback receives a client bound to one transaction; use
/// `client.query(...)` inside it, not the top-level `query()` export,
/// or your statements won't be part of the same transaction.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

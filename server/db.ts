import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Flag to track which database is being used
export let isUsingSqlite = !process.env.DATABASE_URL;

// For local testing without PostgreSQL, we'll use an in-memory storage
// This is a simple fallback - will be removed after testing
if (!process.env.DATABASE_URL) {
  console.log("[DB] ⚠️  DATABASE_URL not set - Using IN-MEMORY storage for local testing");
  console.log("[DB] ⚠️  Data will NOT persist between restarts!");
}

export const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10
  })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

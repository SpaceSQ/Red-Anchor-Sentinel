import * as SQLite from "expo-sqlite";
import type { AlertFrame, PairTicket } from "./protocol";

const DB = "ras-companion.db";

async function database() {
  const db = await SQLite.openDatabaseAsync(DB);
  await db.execAsync(`
    create table if not exists hosts (
      host text not null,
      port integer not null,
      name text not null,
      paired_at text not null,
      primary key (host, port)
    );
    create table if not exists alerts (
      id text primary key,
      at text not null,
      severity text not null,
      dimension text not null,
      title text not null,
      detail text not null
    );
  `);
  return db;
}

export async function cacheHost(ticket: PairTicket) {
  const db = await database();
  await db.runAsync(
    "insert or replace into hosts (host, port, name, paired_at) values (?, ?, ?, ?)",
    ticket.host,
    ticket.port,
    ticket.name,
    new Date().toISOString(),
  );
}

export async function cacheAlert(alert: AlertFrame) {
  const db = await database();
  await db.runAsync(
    "insert or replace into alerts (id, at, severity, dimension, title, detail) values (?, ?, ?, ?, ?, ?)",
    alert.id,
    alert.at,
    alert.severity,
    alert.dimension,
    alert.title.slice(0, 80),
    alert.detail.slice(0, 140),
  );
}

export async function cachedHosts(): Promise<Array<{ host: string; port: number; name: string; paired_at: string }>> {
  const db = await database();
  return db.getAllAsync("select host, port, name, paired_at from hosts order by paired_at desc limit 8");
}

export async function cachedAlerts(): Promise<AlertFrame[]> {
  const db = await database();
  return db.getAllAsync("select id, at, severity, dimension, title, detail from alerts order by at desc limit 40");
}

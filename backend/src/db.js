import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDb(databasePath) {
  const absolute = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const db = new Database(absolute);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      reference_code TEXT UNIQUE,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'website',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      suburb_postcode TEXT NOT NULL,
      service_address TEXT,
      vehicle_type TEXT NOT NULL,
      make_model TEXT,
      registration TEXT,
      service_required TEXT NOT NULL,
      parts_to_polish TEXT NOT NULL,
      condition TEXT NOT NULL,
      preferred_date TEXT,
      job_details TEXT,
      power_available TEXT NOT NULL,
      covered_work_area TEXT,
      privacy_consent INTEGER NOT NULL,
      ai_status TEXT NOT NULL DEFAULT 'pending',
      ai_summary TEXT,
      ai_quote_draft TEXT
    );

    CREATE TABLE IF NOT EXISTS enquiry_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      relative_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
    CREATE INDEX IF NOT EXISTS idx_enquiry_photos_enquiry_id ON enquiry_photos(enquiry_id);
  `);

  // Backwards-compatible migration for databases created before public reference codes were added.
  const columns = db.prepare(`PRAGMA table_info(enquiries)`).all().map((column) => column.name);
  if (!columns.includes('reference_code')) {
    db.exec(`ALTER TABLE enquiries ADD COLUMN reference_code TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_enquiries_reference_code ON enquiries(reference_code)`);

  // Give existing enquiries a stable, customer-friendly reference without changing their internal UUID.
  const missingRefs = db.prepare(`SELECT id FROM enquiries WHERE reference_code IS NULL OR reference_code = ''`).all();
  const updateRef = db.prepare(`UPDATE enquiries SET reference_code = ? WHERE id = ?`);
  for (const row of missingRefs) {
    const compact = String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase();
    updateRef.run(`FP-${compact}`, row.id);
  }

  return db;
}

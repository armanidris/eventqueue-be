const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "database", "eventQueue.db");
const db = new sqlite3.Database(dbPath);

// Buat tabel jika belum ada
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS courts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      current INTEGER,
      next INTEGER,
      afterNext INTEGER
    )
  `);

  // Insert default courts kalau masih kosong
  db.get("SELECT COUNT(*) as count FROM courts", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO courts (name, current, next, afterNext) VALUES (?, ?, ?, ?)");
      stmt.run("Lapangan A", 1, 2, 3);
      stmt.run("Lapangan B", 4, 5, 6);
      stmt.run("Lapangan C", 7, 8, 9);
      stmt.run("Lapangan D", 10, 11, 12);
      stmt.finalize();
    }
  });
});

module.exports = db;

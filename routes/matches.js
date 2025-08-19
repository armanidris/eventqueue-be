const express = require("express");
const router = express.Router();
const db = require("../db");

// Ambil daftar partai per lapangan
router.get("/:court", (req, res) => {
  const { court } = req.params;
  db.all(
    "SELECT * FROM matches WHERE court = ? ORDER BY number ASC",
    [court],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.post("/:court/:match/finish", (req, res) => {
  const { court, match } = req.params;

  console.log(`Processing finish request for court: ${court} | matchId: ${match}`);

  db.serialize(() => {
    // Tandai current jadi done
    db.run(
      "UPDATE matches SET status = 'done' WHERE court = ? AND number = ?",
      [court, match],
      function(err) {
        if (err) {
          console.error("Error updating current match to done:", err);
          return res.status(500).json({ error: "Database error" });
        }
        
        console.log(`Marked current as done. Rows affected: ${this.changes}`);

        // Ambil next
        db.get(
          "SELECT * FROM matches WHERE court = ? AND status = 'pending' ORDER BY number ASC LIMIT 1",
          [court],
          (err, row) => {
            if (err) {
              console.error("Error fetching next match:", err);
              return res.status(500).json({ error: "Database error" });
            }

            if (row) {
              console.log("Found next match:", row.id);
              // Update next jadi current
              db.run(
                "UPDATE matches SET status = 'current' WHERE id = ?",
                [row.id],
                function(err) {
                  if (err) {
                    console.error("Error updating next match to current:", err);
                    return res.status(500).json({ error: "Database error" });
                  }
                  console.log(`Updated next match to current. Rows affected: ${this.changes}`);
                  res.json({ 
                    message: "Updated successfully", 
                    nextCurrent: row 
                  });
                }
              );
            } else {
              console.log("No pending matches found");
              res.json({ 
                message: "Current match marked as done, no pending matches", 
                nextCurrent: null 
              });
            }
          }
        );
      }
    );
  });
});

module.exports = router;

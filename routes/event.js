const express = require('express');
const router = express.Router();
const db = require('../db');

// Get event info
router.get('/', (req, res) => {
  db.get('SELECT * FROM event LIMIT 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    // If table is empty (shouldn't be due to seed), return default
    res.json(row || { name: 'Kejuaraan Taekwondo' });
  });
});

// Update event info
// Update event info
router.put('/', (req, res) => {
  const { name } = req.body;
  console.log('Updating event name to:', name);
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Use explicit ID 1 for now to ensure we hit the row
  db.run('UPDATE event SET name = ? WHERE id = 1', [name], function(err) {
    if (err) {
      console.error('Error updating event:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Update result:', this.changes);
    if (this.changes === 0) {
       // Fallback: if id=1 doesn't exist, try to insert
       db.run('INSERT INTO event (name) VALUES (?)', [name], function(insertErr) {
          if (insertErr) {
             console.error('Error inserting event:', insertErr);
             return res.status(500).json({ error: insertErr.message });
          }
          console.log('Inserted new event row');
          res.json({ message: 'Event created', name });
       });
    } else {
        res.json({ message: 'Event updated', name });
    }
  });
});

module.exports = router;

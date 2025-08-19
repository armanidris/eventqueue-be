const express = require('express');
const router = express.Router();
const db = require('../db');
const { broadcastCourtUpdate } = require('./sse');

// Get all courts
router.get('/', (req, res) => {
  db.all('SELECT * FROM courts', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const formattedCourts = rows.map(court => ({
      id: court.id,
      name: court.name,
      current: court.current,
      next: court.next,
      afterNext: court.afterNext,
      Last: court.Last,
      status: getCourtStatus(court)
    }));
    
    res.json(formattedCourts);
  });
});

// Get court by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid court ID' });
  }

  db.get('SELECT * FROM courts WHERE id = ?', [id], (err, court) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!court) return res.status(404).json({ error: 'Court not found' });
    
    res.json(formatCourtData(court));
  });
});

// Update to next match
router.post('/:id/next', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid court ID' });
  }

  try {
    // Mulai transaction
    await db.run('BEGIN TRANSACTION');

    // Dapatkan data court terkini
    const court = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!court) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Court not found' });
    }

    // Validasi
    if (court.current >= court.Last) {
      await db.run('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot proceed',
        message: 'Match has reached final limit'
      });
    }

    // Hitung nilai baru
    const updated = {
      current: court.next,
      next: court.afterNext,
      afterNext: (court.afterNext !== null && court.afterNext < court.Last) 
        ? court.afterNext + 1 
        : null
    };

    // Update database
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE courts SET current = ?, next = ?, afterNext = ? WHERE id = ?`,
        [updated.current, updated.next, updated.afterNext, id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Dapatkan data terbaru
    const updatedCourt = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Commit transaction
    await db.run('COMMIT');

    // Broadcast update ke semua client
    broadcastCourtUpdate(updatedCourt);

    res.json({
      message: 'Updated successfully',
      data: formatCourtData(updatedCourt),
      limits: {
        last: court.Last,
        reached: updated.afterNext === null
      }
    });

  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Error in next match update:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper functions
function formatCourtData(court) {
  return {
    id: court.id,
    name: court.name,
    current: court.current,
    next: court.next,
    afterNext: court.afterNext,
    Last: court.Last,
    status: getCourtStatus(court)
  };
}

function getCourtStatus(court) {
  if (court.current >= court.Last) return 'completed';
  if (court.next >= court.Last) return 'nearing-completion';
  return 'active';
}

// Update next and afterNext matches
router.post('/:id/update-next', async (req, res) => {
  const { id } = req.params;
  const { next, afterNext } = req.body;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid court ID' });
  }

  if (isNaN(next) || isNaN(afterNext)) {
    return res.status(400).json({ error: 'Invalid match numbers' });
  }

  try {
    // Mulai transaction
    await db.run('BEGIN TRANSACTION');

    // Dapatkan data court terkini
    const court = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!court) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Court not found' });
    }

    // Validasi
    if (next > court.Last || afterNext > court.Last) {
      await db.run('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot proceed',
        message: 'Match number exceeds limit'
      });
    }

    // Update database
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE courts SET next = ?, afterNext = ? WHERE id = ?`,
        [next, afterNext, id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Dapatkan data terbaru
    const updatedCourt = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Commit transaction
    await db.run('COMMIT');

    // Broadcast update ke semua client
    broadcastCourtUpdate(updatedCourt);

    res.json({
      message: 'Updated successfully',
      data: formatCourtData(updatedCourt)
    });

  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Error in next matches update:', err);
    res.status(500).json({ error: err.message });
  }
});


// Update court data
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, current, next, afterNext, Last } = req.body;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid court ID' });
  }

  if (!name || !Last) {
    return res.status(400).json({ error: 'Name and Last are required' });
  }

  try {
    await db.run('BEGIN TRANSACTION');

    // Update court
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE courts SET 
          name = ?, 
          current = ?, 
          next = ?, 
          afterNext = ?, 
          Last = ? 
        WHERE id = ?`,
        [
          name,
          current || null,
          next || null,
          afterNext || null,
          Last,
          id
        ],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Get updated court
    const updatedCourt = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    await db.run('COMMIT');
    broadcastCourtUpdate(updatedCourt);

    res.json({
      message: 'Court updated successfully',
      data: formatCourtData(updatedCourt)
    });
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Error updating court:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset court progress
router.post('/:id/reset', async (req, res) => {
  const { id } = req.params;

  try {
    await db.run('BEGIN TRANSACTION');

    // Reset to initial state
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE courts SET 
          current = 1,
          next = 2,
          afterNext = 3
        WHERE id = ?`,
        [id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Get updated court
    const updatedCourt = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM courts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    await db.run('COMMIT');
    broadcastCourtUpdate(updatedCourt);

    res.json({
      message: 'Court reset successfully',
      data: formatCourtData(updatedCourt)
    });
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Error resetting court:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
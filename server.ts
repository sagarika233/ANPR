import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Database Setup
const db = new sqlite3.Database("anpr.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT NOT NULL,
      confidence REAL,
      make TEXT,
      model TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      status TEXT
    )
  `);

  // Migration: Add make and model columns if they don't exist
  db.all("PRAGMA table_info(history)", (err, columns: any[]) => {
    if (err) return;
    const hasMake = columns.some(c => c.name === 'make');
    const hasModel = columns.some(c => c.name === 'model');
    
    if (!hasMake) {
      db.run("ALTER TABLE history ADD COLUMN make TEXT");
    }
    if (!hasModel) {
      db.run("ALTER TABLE history ADD COLUMN model TEXT");
    }
  });
});

// API Routes
app.get("/api/stats", (req, res) => {
  const stats = {
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
    detectionsChange: 0,
    confidenceChange: 0
  };

  const query = `
    SELECT 
      COUNT(*) as count, 
      AVG(confidence) as avgConf,
      COUNT(DISTINCT location) as cameras,
      SUM(CASE WHEN status NOT IN ('Detected', 'Authorized', 'Clearance') THEN 1 ELSE 0 END) as alerts,
      (SELECT COUNT(*) FROM history WHERE date(timestamp) = date('now', '-1 day')) as yesterdayCount,
      (SELECT AVG(confidence) FROM history WHERE date(timestamp) = date('now', '-1 day')) as yesterdayAvgConf
     FROM history 
     WHERE date(timestamp) = date('now')
  `;

  db.get(query, (err, row: any) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      stats.todayDetections = row.count || 0;
      stats.avgConfidence = row.avgConf || 0;
      stats.activeCameras = Math.max(row.cameras || 1, 1);
      stats.watchlistHits = row.alerts || 0;
      
      const yesterdayCount = row.yesterdayCount || 0;
      if (yesterdayCount > 0) {
        stats.detectionsChange = ((stats.todayDetections - yesterdayCount) / yesterdayCount) * 100;
      }
      
      const yesterdayAvgConf = row.yesterdayAvgConf || 0;
      if (yesterdayAvgConf > 0) {
        stats.confidenceChange = (stats.avgConfidence - yesterdayAvgConf) * 100;
      }
    }
    res.json(stats);
  });
});

app.get("/api/history", (req, res) => {
  db.all("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Helper to broadcast system activity
function broadcastActivity(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const activity = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toISOString()
  };
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'SYSTEM_ACTIVITY', data: activity }));
    }
  });
}

// Simulate periodic system activities
const simulatedActivities = [
  "Camera focus adjusted for low-light conditions",
  "Database sync completed (42 new entries)",
  "Network latency check: 12ms (Stable)",
  "Storage cleanup: 1.2GB reclaimed",
  "System heartbeat: All modules active",
  "Security patch applied to detection engine"
];

setInterval(() => {
  const randomActivity = simulatedActivities[Math.floor(Math.random() * simulatedActivities.length)];
  broadcastActivity(randomActivity);
}, 45000); // Every 45 seconds

app.post("/api/detections", (req, res) => {
  const { plate, confidence, make, model, location, status } = req.body;
  db.run(
    "INSERT INTO history (plate, confidence, make, model, location, status) VALUES (?, ?, ?, ?, ?, ?)",
    [plate, confidence, make, model, location || "Main Entrance", status || "Detected"],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Broadcast to all connected clients
      const detection = { id: this.lastID, plate, confidence, make, model, timestamp: new Date(), location, status };
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'NEW_DETECTION', data: detection }));
        }
      });

      // Also broadcast as system activity
      broadcastActivity(`Engine cross-reference complete for ${plate}`, 'success');
      
      res.json({ success: true, id: this.lastID });
    }
  );
});

// WebSocket Handling
wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");
  ws.on("message", (message) => {
    // Handle incoming messages if needed
  });
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

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
app.get("/api/history", (req, res) => {
  db.all("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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

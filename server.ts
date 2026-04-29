import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Supabase Setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iaypkmmfsbsrofirbmhd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_rFqKjObrhw5Z4n2zT2mDrw_PT-6mPHk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test Supabase connection on startup
async function testSupabase() {
  try {
    const { error } = await supabase.from('vehicle_records').select('count', { count: 'exact', head: true });
    if (error) {
      console.error("CRITICAL DATABASE ERROR on startup:", JSON.stringify(error));
    } else {
      console.log("Supabase connection and 'vehicle_records' table verified.");
    }
  } catch (err: any) {
    console.error("Supabase initialization crash:", err.message);
  }
}
testSupabase();

// Database Setup (Keeping SQLite for watchlist and system metadata, but history moves to Supabase)
const db = new sqlite3.Database("anpr.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT NOT NULL,
      confidence REAL,
      make TEXT,
      model TEXT,
      vehicle_type TEXT,
      owner_name TEXT,
      registration_date TEXT,
      fuel_type TEXT,
      engine_number TEXT,
      chassis_number TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      status TEXT
    )
  `);

  // Migration: Add new columns if they don't exist
  db.all("PRAGMA table_info(history)", (err, columns: any[]) => {
    if (err) return;
    const existing = columns.map(c => c.name);
    const newColumns = [
      'make', 'model', 'vehicle_type', 'owner_name', 'registration_date', 'fuel_type', 'engine_number', 'chassis_number', 'region', 'image', 'is_blurry'
    ];
    
    newColumns.forEach(col => {
      if (!existing.includes(col)) {
        const type = col === 'is_blurry' ? 'INTEGER' : 'TEXT';
        db.run(`ALTER TABLE history ADD COLUMN ${col} ${type}`);
      }
    });

    // Repair logic: Update existing rows with generic tags to correct states if possible
    db.all("SELECT id, plate FROM history WHERE region IS NULL OR region = 'India (Central)' OR region = 'India (Standard)'", (err, rows: any[]) => {
      if (err || !rows) return;
      rows.forEach(row => {
        const result = lookupRegistry(row.plate);
        if (result.region !== 'India (Central)' && result.region !== 'India (Standard)') {
          db.run("UPDATE history SET region = ? WHERE id = ?", [result.region, row.id]);
        }
      });
    });
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'Blacklist',
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default watchlist items
  db.get("SELECT COUNT(*) as count FROM watchlist", (err, row: any) => {
    if (!err && row.count === 0) {
      db.run("INSERT INTO watchlist (plate, reason, type) VALUES (?, ?, ?)", ["MH12AB1234", "Reported Stolen", "Blacklist"]);
      db.run("INSERT INTO watchlist (plate, reason, type) VALUES (?, ?, ?)", ["DL01CA9010", "Unpaid Traffic Fines", "Warning"]);
    }
  });
});

// Real-time System Health Simulation
setInterval(() => {
  const health = {
    cpu: Math.round(15 + Math.random() * 10),
    memory: Math.round(45 + Math.random() * 5),
    apiLatency: Math.round(120 + Math.random() * 80),
    dbStatus: 'Optimal',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    nodes: 1
  };
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'SYSTEM_HEALTH', data: health }));
    }
  });
}, 5000);

const stateMap: Record<string, string> = {
  'MH': 'Maharashtra',
  'DL': 'Delhi',
  'KA': 'Karnataka',
  'TN': 'Tamil Nadu',
  'GJ': 'Gujarat',
  'UP': 'Uttar Pradesh',
  'AP': 'Andhra Pradesh',
  'TS': 'Telangana',
  'WB': 'West Bengal',
  'HR': 'Haryana',
  'PB': 'Punjab',
  'BR': 'Bihar',
  'OR': 'Odisha',
  'OD': 'Odisha',
  'MP': 'Madhya Pradesh',
  'RJ': 'Rajasthan',
  'KL': 'Kerala',
  'JH': 'Jharkhand',
  'CT': 'Chhattisgarh',
  'CG': 'Chhattisgarh',
  'UK': 'Uttarakhand',
  'UA': 'Uttarakhand',
  'HP': 'Himachal Pradesh',
  'AS': 'Assam',
  'TR': 'Tripura',
  'ML': 'Meghalaya',
  'MN': 'Manipur',
  'NL': 'Nagaland',
  'MZ': 'Mizoram',
  'SK': 'Sikkim',
  'AR': 'Arunachal Pradesh',
  'GA': 'Goa',
  'PY': 'Puducherry',
  'CH': 'Chandigarh',
  'JK': 'Jammu & Kashmir',
  'LA': 'Ladakh',
  'AN': 'Andaman & Nicobar',
  'LD': 'Lakshadweep',
  'DN': 'Dadra & Nagar Haveli',
  'DD': 'Daman & Diu',
};

// Simulated Registration Registry
const lookupRegistry = (plate: string) => {
  const hash = plate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const owners = ["Rahul Sharma", "Priya Patel", "Amit Singh", "Suresh Kumar", "Anita Devi", "Vikram Rathore"];
  const fuels = ["Petrol", "Diesel", "EV", "CNG"];
  
  const prefix = plate.substring(0, 2).toUpperCase();
  const region = stateMap[prefix] || "India (Standard)";

  return {
    owner_name: owners[hash % owners.length],
    registration_date: `201${hash % 9}-${String((hash % 12) + 1).padStart(2, '0')}-${String((hash % 28) + 1).padStart(2, '0')}`,
    fuel_type: fuels[hash % fuels.length],
    engine_number: `ENG${hash}X${plate.substring(0, 4)}`,
    chassis_number: `CHAS${hash}Y${plate.substring(4)}`,
    region
  };
};

// API Routes
app.get("/api/stats", async (req, res) => {
  const stats = {
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
    detectionsChange: 0,
    confidenceChange: 0
  };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch today's stats from Supabase
    const { data: todayData, error: todayError } = await supabase
      .from('vehicle_records')
      .select('confidence, location')
      .gte('timestamp', today.toISOString());

    if (todayError) throw todayError;

    // Fetch yesterday's count for trend
    const { count: yesterdayCount, error: yesterdayError } = await supabase
      .from('vehicle_records')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', yesterday.toISOString())
      .lt('timestamp', today.toISOString());

    if (yesterdayError) throw yesterdayError;

    if (todayData) {
      stats.todayDetections = todayData.length;
      stats.avgConfidence = todayData.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / (todayData.length || 1);
      const uniqueLocations = new Set(todayData.map(d => d.location));
      stats.activeCameras = Math.max(uniqueLocations.size, 1);
      
      if (yesterdayCount !== null && yesterdayCount > 0) {
        stats.detectionsChange = ((stats.todayDetections - yesterdayCount) / yesterdayCount) * 100;
      }
    }

    res.json(stats);
  } catch (err: any) {
    const errorDetails = {
      message: err.message || "Unknown Error",
      code: err.code || "NO_CODE",
      details: err.details || "None",
      hint: err.hint || "None"
    };
    console.error("CRITICAL: Stats retrieval failed:", JSON.stringify(errorDetails));
    res.status(500).json({ 
      error: "Failed to fetch statistics", 
      details: errorDetails.message,
      hint: "Ensure 'vehicle_records' table exists in Supabase. Check supabase-schema.sql"
    });
  }
});

app.get("/api/history", (req, res) => {
  // Requirement: Do NOT show full history by default.
  // We can return empty, or if there's a search param, we handle it.
  const plate = req.query.plate as string;
  if (!plate) {
    return res.json([]);
  }

  // Handle it as a search if plate is provided
  res.redirect(`/api/search?plate=${encodeURIComponent(plate)}`);
});

app.get("/api/search", async (req, res) => {
  const { plate } = req.query;

  try {
    let queryBuilder = supabase
      .from('vehicle_records')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (plate) {
      queryBuilder = queryBuilder.ilike('plate_number', `%${plate}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.json({ message: "No data found", data: [] });
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analytics/detections-per-hour", (req, res) => {
  const query = `
    WITH hours AS (
      SELECT datetime('now', '-' || (value) || ' hours') as hour_time
      FROM (
        SELECT 0 as value UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
        UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 
        UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 
        UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23
      )
    )
    SELECT 
      strftime('%H:00', h.hour_time) as hour,
      COUNT(hist.id) as count
    FROM hours h
    LEFT JOIN history hist ON strftime('%Y-%m-%d %H', hist.timestamp) = strftime('%Y-%m-%d %H', h.hour_time)
    GROUP BY h.hour_time
    ORDER BY h.hour_time ASC
  `;

  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/watchlist", (req, res) => {
  db.all("SELECT * FROM watchlist ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/watchlist", (req, res) => {
  const { plate, reason, type } = req.body;
  if (!plate) return res.status(400).json({ error: "Plate is required" });
  
  db.run("INSERT OR REPLACE INTO watchlist (plate, reason, type) VALUES (?, ?, ?)", [plate.toUpperCase(), reason, type || 'Blacklist'], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete("/api/watchlist/:id", (req, res) => {
  db.run("DELETE FROM watchlist WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Helper to broadcast system activity
function broadcastActivity(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  // Logic removed as per user request to eliminate notification system
}

// Periodic system activities simulation removed

app.post("/api/detections", async (req, res) => {
  const { 
    plate, confidence, make, model, vehicle_type, location, status, image, is_blurry 
  } = req.body;

  try {
    const plateUpper = plate.toUpperCase();
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

    // 1. Deduplication: Check if same plate recorded in last 10 seconds
    const { data: recent, error: checkError } = await supabase
      .from('vehicle_records')
      .select('id')
      .eq('plate_number', plateUpper)
      .gt('timestamp', tenSecondsAgo)
      .limit(1);

    if (checkError) throw checkError;
    if (recent && recent.length > 0) {
      return res.json({ success: true, message: "Duplicate suppressed (10s window)", id: recent[0].id });
    }

    const registry = lookupRegistry(plate);

    // 2. Store in Supabase
    const { data: inserted, error: insertError } = await supabase
      .from('vehicle_records')
      .insert([{
        plate_number: plateUpper,
        confidence: confidence || 0,
        vehicle_type: vehicle_type || 'Unknown',
        make: make || 'Unknown',
        model: model || 'Unknown',
        location: location || "Main Entrance",
        status: status || "Detected",
        image_url: image, // Store as text for now
        timestamp: new Date().toISOString()
      }])
      .select();

    if (insertError) throw insertError;
    const lastID = inserted[0].id;

    const detection = { 
      id: lastID, plate: plateUpper, confidence, make, model, vehicle_type,
      ...registry,
      timestamp: new Date(), location, status, image, is_blurry
    };

    // 3. Real-time Alert Rule Check (Still using local SQLite for watchlist)
    db.get("SELECT * FROM watchlist WHERE plate = ?", [plateUpper], (err, row: any) => {
      if (!err && row) {
        // If in watchlist, broadcast an ALERT
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'ALERT', 
              data: { ...detection, alertType: row.type, reason: row.reason } 
            }));
          }
        });
      } else {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'NEW_DETECTION', data: detection }));
          }
        });
      }
    });
    
    res.json({ success: true, id: lastID });
  } catch (err: any) {
    const errorDetails = {
      message: err.message || "Unknown error",
      code: err.code || "NO_CODE",
      details: err.details || "None",
      hint: err.hint || "None"
    };
    console.error("CRITICAL: Detection storage failed:", JSON.stringify(errorDetails));
    res.status(500).json({ 
      error: err.message || "Detection storage failed",
      details: errorDetails.message,
      hint: "Check if 'vehicle_records' table exists in your Supabase project."
    });
  }
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

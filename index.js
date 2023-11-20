const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the 'public' directory where 'index.html' is located
app.use(express.static(path.join(__dirname, "public")));

// Create an HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// SQLite database setup
const db = new sqlite3.Database("./users.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the users database.");
});

db.run("CREATE TABLE IF NOT EXISTS user_ips (ip TEXT)", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Table for IP addresses is ready.");
  }
});

function sendUpdatedIPList() {
  db.all("SELECT ip FROM user_ips", [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({ type: "update", ips: rows.map((r) => r.ip) })
        );
      }
    });
  });
}

function insertIPAddress(ip) {
  db.run(`INSERT INTO user_ips (ip) VALUES (?)`, [ip], function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(`A row has been inserted with rowid ${this.lastID}`);
    sendUpdatedIPList();
  });
}

function deleteIPAddress(ip) {
  db.run(`DELETE FROM user_ips WHERE ip = ?`, [ip], function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log(`Row(s) deleted ${this.changes}`);
    sendUpdatedIPList();
  });
}

// Creating connection using WebSocket
wss.on("connection", (ws, req) => {
  // Normalize the IP address format (remove IPv6 brackets if present)
  const ip =
    req.socket.remoteAddress === "::1"
      ? "127.0.0.1"
      : req.socket.remoteAddress.replace(/^.*:/, "");

  console.log("New client connected, IP: " + ip);
  insertIPAddress(ip);

  ws.on("message", (data) => {
    console.log(`Client has sent us: ${data}`);
  });

  ws.on("close", () => {
    console.log("The client has disconnected, IP: " + ip);
    deleteIPAddress(ip);
  });

  ws.onerror = function () {
    console.log("Some Error occurred");
  };
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

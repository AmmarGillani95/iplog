// Importing the required modules
const WebSocketServer = require("ws");
const sqlite3 = require("sqlite3").verbose();

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
      if (client.readyState === WebSocketServer.OPEN) {
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

// Creating a new WebSocket server
const wss = new WebSocketServer.Server({ port: 8080 });

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

console.log("The WebSocket server is running on port 8080");

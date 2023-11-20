const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const AWS = require("aws-sdk");

// Configure AWS
const awsConfig = { region: "us-east-1" };
if (!process.env.AWS_EXECUTION_ENV) {
  awsConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  awsConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
}
AWS.config.update(awsConfig);

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sendUpdatedIPList = () => {
  const scanParams = {
    TableName: "ips",
  };

  dynamoDB.scan(scanParams, function (err, data) {
    if (err) {
      console.error("Error fetching IPs from DynamoDB:", err);
    } else {
      const ips = data.Items.map((item) => item.ipAddress);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "update", ips }));
        }
      });
    }
  });
};

wss.on("connection", (ws, req) => {
  const ipAddress = req.socket.remoteAddress.replace(/^.*:/, "");
  console.log("New client connected, IP: " + ipAddress);

  // Insert IP address into DynamoDB
  const putParams = {
    TableName: "ips",
    Item: {
      ipAddress: ipAddress,
      timestamp: Date.now(),
    },
  };

  dynamoDB.put(putParams, function (err) {
    if (err) {
      console.error("Error writing IP to DynamoDB:", err);
    } else {
      sendUpdatedIPList();
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected, IP: " + ipAddress);

    // Remove the IP address from DynamoDB
    const deleteParams = {
      TableName: "ips",
      Key: {
        ipAddress: ipAddress,
      },
    };

    dynamoDB.delete(deleteParams, function (err) {
      if (err) {
        console.error("Error removing IP from DynamoDB:", err);
      } else {
        sendUpdatedIPList();
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

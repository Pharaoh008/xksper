const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchProduct } = require("./lib/amazon");

const portArgIndex = process.argv.indexOf("--port");
const cliPort = portArgIndex >= 0 ? process.argv[portArgIndex + 1] : "";
const PORT = Number(process.env.PORT || cliPort || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  });
}

function handleProduct(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const country = requestUrl.searchParams.get("country") || "";
  const asin = requestUrl.searchParams.get("asin") || "";

  fetchProduct(country, asin)
    .then((product) => sendJson(res, 200, { ok: true, product }))
    .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
}

function handleAgent(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, {
      ok: false,
      error: "Method not allowed."
    });
    return;
  }

  sendJson(res, 501, {
    ok: false,
    error: "Local Node preview only serves the frontend. /api/agent.php runs on Vercel with the PHP serverless runtime."
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/product") {
    handleProduct(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/agent.php") {
    handleAgent(req, res);
    return;
  }

  const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`AgentOps Studio running at http://localhost:${PORT}`);
});

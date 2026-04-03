const http = require("http");
const https = require("https");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Mozilla/5.0 (X11; Linux x86_64)"
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent()
        }
      },
      (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(data));
      }
    ).on("error", reject);
  });
}

async function getRank(keyword, domain) {
  for (let page = 0; page < 30; page += 10) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${page}`;
    
    const html = await fetchHTML(searchUrl);

    const matches = html.match(/<a href="\/url\?q=(.*?)&/g) || [];
    let rank = page + 1;

    for (const m of matches) {
      const link = m.replace('<a href="/url?q=', '').split("&")[0];

      if (!link.startsWith("http")) continue;

      if (link.includes(domain)) {
        return rank;
      }

      rank++;
    }

    await delay(1000);
  }

  return -1;
}

async function processKeywords(keywords, domain) {
  const results = new Array(keywords.length);
  const concurrency = 5;
  let index = 0;

  async function worker() {
    while (index < keywords.length) {
      const current = index++;
      const keyword = keywords[current];

      try {
        const rank = await getRank(keyword, domain);
        results[current] = { keyword, rank };
      } catch {
        results[current] = { keyword, rank: -1 };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/rank") {
    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {
      try {
        const { keywords, domain } = JSON.parse(body);

        if (!keywords || !domain) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: "Missing keywords or domain" }));
        }

        const results = await processKeywords(keywords, domain);

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });

        res.end(JSON.stringify(results));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
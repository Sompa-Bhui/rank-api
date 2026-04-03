const http = require("http");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRank(keyword, domain) {
  let rank = -1;

  const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const html = await response.text();

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const links = document.querySelectorAll("a");

  let position = 1;

  for (let link of links) {
    const href = link.getAttribute("href");

    if (href && href.includes("http")) {
      if (href.includes(domain)) {
        rank = position;
        break;
      }
      position++;
    }
  }

  return rank;
}

async function processKeywords(keywords, domain) {
  const results = [];

  for (let keyword of keywords) {
    try {
      const rank = await getRank(keyword, domain);
      results.push({ keyword, rank });
      await delay(1000); // avoid blocking
    } catch {
      results.push({ keyword, rank: -1 });
    }
  }

  return results;
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/rank")) {
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
  } else if (req.method === "GET" && req.url === "/") {
    res.writeHead(200);
    res.end("API is running 🚀");
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
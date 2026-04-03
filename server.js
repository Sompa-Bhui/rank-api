const http = require("http");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRank(keyword, domain) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=20`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await response.text();

    if (!html || html.includes("captcha")) {
      return {
        keyword,
        rank: -1,
        status: "Blocked by Google"
      };
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;

    let position = 1;
    let found = false;

    const links = document.querySelectorAll("a");

    for (let link of links) {
      const href = link.getAttribute("href");

      if (href && href.startsWith("/url?q=")) {
        const clean = href.split("/url?q=")[1]?.split("&")[0];

        if (clean) {
          if (clean.includes(domain)) {
            found = true;
            return {
              keyword,
              rank: position,
              status: "Found"
            };
          }
          position++;
        }
      }
    }

    return {
      keyword,
      rank: -1,
      status: "Not Found in top results"
    };

  } catch (error) {
    return {
      keyword,
      rank: -1,
      status: "Error",
      message: error.message
    };
  }
}

async function processKeywords(keywords, domain) {
  const results = [];

  for (let keyword of keywords) {
    const result = await getRank(keyword, domain);
    results.push(result);
    await delay(2000);
  }

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
          return res.end(JSON.stringify({ error: "Missing data" }));
        }

        const results = await processKeywords(keywords, domain);

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });

        res.end(JSON.stringify(results));

      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200);
    return res.end("API running");
  }

  res.writeHead(404);
  res.end("Not Found");
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
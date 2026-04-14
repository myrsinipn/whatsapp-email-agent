require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const { convert } = require("html-to-text");

const config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000
  }
};

async function searchEmails({ senderHints = [], keywords = [], dateFrom = null, dateTo = null, limit = 5 }) {
  console.log("Connecting to email...");
  const connection = await imaps.connect(config);
  await connection.openBox("INBOX");
  console.log("Inbox opened");

  // Build IMAP search criteria dynamically
  const conditions = [];

  if (dateFrom) {
    const dateStr = dateFrom.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    conditions.push(["SINCE", dateStr]);
  }

  if (dateTo) {
    const dateStr = dateTo.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    conditions.push(["BEFORE", dateStr]);
  }

  if (senderHints.length > 0) {
    const allConditions = [
      ...senderHints.map(hint => ["FROM", hint]),
      ...senderHints.map(hint => ["SUBJECT", hint])
    ];

    let orChain = allConditions.length === 1
      ? allConditions[0]
      : ["OR", allConditions[0], allConditions[1]];

    for (let i = 2; i < allConditions.length; i++) {
      orChain = ["OR", orChain, allConditions[i]];
    }
    conditions.push(orChain);
  }

  const searchCriteria = conditions.length > 0 ? conditions : ["ALL"];
  const fetchOptions = { bodies: [""] };

  let messages = await connection.search(searchCriteria, fetchOptions);
  console.log(`IMAP returned ${messages.length} messages`);

  // Fallback to last 100 if nothing found
  if (messages.length === 0) {
    console.log("No IMAP matches, falling back to last 100");
    const all = await connection.search(["ALL"], fetchOptions);
    messages = all.slice(-100);
  }

  // Parse emails
  const results = [];
  for (const item of messages) {
    try {
      const all = item.parts.find(p => p.which === "");
      const parsed = await simpleParser(all.body);

      let text = parsed.text || "";
      if (!text && parsed.html) {
        text = convert(parsed.html, {
          wordwrap: false,
          selectors: [
            { selector: "a", options: { ignoreHref: true } },
            { selector: "img", format: "skip" }
          ]
        });
      }

      results.push({
        subject: parsed.subject,
        from: parsed.from?.text,
        date: parsed.date,
        text: text.substring(0, 2000)
      });
    } catch (err) {
      console.error("Error parsing email:", err.message);
    }
  }

  connection.end();

  // Sort by date newest first, take limit
  results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const top = results.slice(0, limit);
  console.log("Top results:");
  top.forEach(r => console.log(` - ${r.from} | ${r.subject} | ${r.date}`));

  return top;
}

module.exports = { searchEmails };
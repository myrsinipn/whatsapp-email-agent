require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { default: Anthropic } = require("@anthropic-ai/sdk");
const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");


const { searchEmails } = require("./emailTool");

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000, 
});

const DIAGRAM_KEYWORDS = ["chart", "graph", "diagram", "plot", "visualize", "mind map", "table", "show me"];

function isDiagramRequest(message) {
  return DIAGRAM_KEYWORDS.some(k => message.toLowerCase().includes(k));
}

async function planSearch(userMessage) {
  const today = new Date().toISOString().split("T")[0];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    system: `You are an email search planner. Given a user query about their emails or newsletters,
return ONLY a valid JSON object (no markdown, no backticks) with this structure:
{
  "senderHints": ["sender name or domain to search for, e.g. alphasigma, morning brew"],
  "keywords": ["topic keywords to match in subject/body"],
  "dateFrom": "YYYY-MM-DD or null",
  "dateTo": "YYYY-MM-DD or null",
  "limit": <number of emails to fetch, 1-20>,
  "intent": "single" or "digest",
  "diagramRequested": true or false
}

Today's date is ${today}.
- intent "single" = user wants info from one specific email
- intent "digest" = user wants a summary across many emails
- For vague time ranges like "last few months" use 90 days back
- For "last week" use 7 days back
- For "latest" or "last" with no time = just set limit to 3, no dateFrom
- senderHints should be lowercase partial matches
- Be generous with limit for digest intents (10-20)`,
    messages: [{ role: "user", content: userMessage }]
  });

  try {
    const raw = response.content[0].text;
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("Failed to parse search plan:", e.message);
    return {
      senderHints: [],
      keywords: userMessage.split(" ").filter(w => w.length > 3),
      dateFrom: null,
      dateTo: null,
      limit: 5,
      intent: "single",
      diagramRequested: false
    };
  }
}

async function generateDiagram(userMessage, emailContext) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: `You are a data extraction assistant. Given email content and a user request,
extract data and return ONLY valid JSON with no markdown or backticks:
{
  "chartType": "bar" or "line" or "pie" or "polarArea",
  "title": "Chart title",
  "labels": ["label1", "label2"],
  "data": [10, 20]
}`,
    messages: [
      { role: "user", content: `Email content:\n${emailContext}\n\nRequest: ${userMessage}` }
    ]
  });

  let chartConfig;
  try {
    const raw = response.content[0].text;
    const clean = raw.replace(/```json|```/g, "").trim();
    chartConfig = JSON.parse(clean);
  } catch (e) {
    throw new Error("Could not parse chart config: " + e.message);
  }

  const chartData = {
    type: chartConfig.chartType || "bar",
    data: {
      labels: chartConfig.labels,
      datasets: [{
        label: chartConfig.title,
        data: chartConfig.data,
        backgroundColor: [
          "#4e79a7","#f28e2b","#e15759","#76b7b2",
          "#59a14f","#edc948","#b07aa1","#ff9da7"
        ]
      }]
    },
    options: {
      plugins: { title: { display: true, text: chartConfig.title } }
    }
  };

  const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartData))}&w=600&h=400`;
  console.log("Fetching chart from QuickChart...");

  const chartResponse = await axios.get(url, {
  responseType: "arraybuffer",
  httpsAgent: insecureAgent  
});
  const filePath = path.join(__dirname, "temp_chart.png");
  fs.writeFileSync(filePath, chartResponse.data);
  console.log("Chart saved to:", filePath);
  return filePath;
}

async function runAgent(messages) {
  const userMessage = messages[messages.length - 1]?.content;
  console.log("runAgent called with:", userMessage);

  // Step 1: Claude plans the search
  const plan = await planSearch(userMessage);
  console.log("Search plan:", JSON.stringify(plan, null, 2));

  // Step 2: Fetch emails based on plan
  const toolResults = await searchEmails({
    senderHints: plan.senderHints,
    keywords: plan.keywords,
    dateFrom: plan.dateFrom ? new Date(plan.dateFrom) : null,
    dateTo: plan.dateTo ? new Date(plan.dateTo) : null,
    limit: plan.limit
  });
  const context = JSON.stringify(toolResults);
  console.log(`Fetched ${toolResults.length} emails for context`);

  // Step 3: Diagram if requested
  if (isDiagramRequest(userMessage) || plan.diagramRequested) {
    console.log("Diagram request detected");
    try {
      const imagePath = await generateDiagram(userMessage, context);
      return { type: "image", path: imagePath };
    } catch (err) {
      console.error("Diagram generation failed:", err);
      return { type: "text", content: "Sorry, I couldn't generate the diagram: " + err.message };
    }
  }

  // Step 4: Claude synthesizes answer
  const systemPrompt = plan.intent === "digest"
    ? `You are an assistant that synthesizes information from the user's newsletters and emails.
       When given multiple emails, extract and group the most important insights, trends, and news across all of them.
       Be specific — mention names, numbers, and key takeaways. Format clearly.`
    : `You are an assistant that answers questions using the user's emails and newsletters.
       Be specific and reference the actual content of the emails provided.`;

  const userMessages = messages.filter(m => m.role !== "system");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    system: `${systemPrompt}\n\nRelevant emails:\n${context}`,
    messages: userMessages.length > 0
      ? userMessages
      : [{ role: "user", content: userMessage }]
  });

  return { type: "text", content: response.content[0].text };
}

module.exports = { runAgent };
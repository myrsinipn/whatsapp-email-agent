# WhatsApp Agent with Email Intelligence

An AI-powered assistant that connects **WhatsApp**, **email inbox**, and a **language model agent** to automatically search, analyze, and summarize emails.

This project extends an existing WhatsApp LLM assistant by adding **email retrieval, intelligent querying, and visualization capabilities**.

---

## Features

* WhatsApp integration via `whatsapp-web.js`
* LLM-powered agent using Anthropic Claude
* Email search via IMAP (Gmail supported)
* Intelligent query planning (agent decides how to search emails)
* Automatic chart/diagram generation from email data
* Digest mode (summarize multiple emails)
* Single-email Q&A mode

---

##  Architecture

```
User (WhatsApp)
        ↓
   LLM Agent (Claude)
        ↓
  Search Planner (JSON plan)
        ↓
   Email Tool (IMAP)
        ↓
   Retrieved Emails
        ↓
 ┌───────────────┐
 │ Text Response │
 │ OR            │
 │ Chart Image   │
 └───────────────┘
```

---

##  How It Works

### 1. User sends a message via WhatsApp

Example:

* "Summarize my latest newsletters"
* "Show me a chart of trends in AI emails"

### 2. Agent plans the search

The LLM generates a structured plan:

* sender hints
* keywords
* date range
* number of emails
* intent (single vs digest)

### 3. Email retrieval

The system connects to your inbox using IMAP and fetches relevant emails.

### 4. Response generation

* **Text answer** → synthesized from emails
* **Chart** → generated using QuickChart if requested

---

##  Setup

### 1. Clone the repository

```bash
git clone https://github.com/myrsinipn/your-repo.git
cd your-repo
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Create `.env` file

Create a `.env` file based on:

```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
ANTHROPIC_API_KEY=your_api_key
```


---

### 4. Run the app

```bash
npm start
```

---

##  Example Use Cases

*  "Summarize emails from last week"
*  "What are the main trends in my newsletters?"
*  "Create a chart of topics mentioned in recent emails"
*  "Find emails from Morning Brew about AI"

---

##  My Contributions

This project is based on an existing WhatsApp LLM assistant and extended with:

*  Email integration via IMAP
*  LLM-based search planning (structured JSON output)
*  Dynamic chart generation from email data
*  End-to-end automation pipeline (WhatsApp → Agent → Email → Response)
*  Email parsing and cleaning (HTML → text)

---

##  Credits

This project is based on an existing repository:

* Original WhatsApp LLM Assistant by IonGPT

https://github.com/iongpt/LLM-for-Whatsapp.git

Modifications and extensions were implemented to support email intelligence and automation workflows.

---

##  Notes

* Use an **App Password** for Gmail (not your main password)
* IMAP must be enabled in your email settings
* Large inboxes may increase response time

---

##  Tech Stack

* Node.js
* Electron
* whatsapp-web.js
* Anthropic Claude API
* IMAP (imap-simple)
* mailparser
* QuickChart API

---

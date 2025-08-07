# Cloudflare Worker Setup Guide

This guide explains how to set up and deploy a Cloudflare Worker using Wrangler CLI with secrets and external API access.

---

## ✅ Prerequisites

Make sure the following are installed:

- [Node.js](https://nodejs.org/) v20.0 or higher  
- [npm](https://www.npmjs.com/)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install/)

Install Wrangler:

```bash
npm install -D wrangler@latest
```

---

## 🚀 Setup Steps

### 1. Create a Cloudflare Worker

```bash
npm create cloudflare@latest -- <name-of-worker>
```

Follow the prompts to initialize the project.

---

### 2. Replace Project Files

- Replace the `src` folder in your new worker project with the `src` folder from the GitHub repository.
- Replace the `wrangler.jsonc` file with the one from the repository.
  - Be sure to update the `FIREBASE_DOCUMENT_ID` value in `wrangler.jsonc` with your own.

---

### 3. Add Environment Secrets

Run the following commands to add your secrets:

```bash
wrangler secret put GOOGLE_CLIENT_EMAIL
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put OPENAI_API_KEY
```

You will be prompted to enter the values for each.

---

### 4. Deploy the Worker

```bash
npm run deploy
```

Your worker will be deployed to a Cloudflare address like:

```
https://ai-planner-worker.alireza78-bk.workers.dev/
```

---

## 🛰️ Example cURL Request

Use the following `curl` command to test your worker:

```bash
curl -X POST https://ai-planner-worker.alireza78-bk.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{ "destination": "Paris, France", "durationDays": 2 }'
```

---

## 📄 License

MIT or your preferred license.

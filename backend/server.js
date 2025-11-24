const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pdfParse = require("pdf-parse");
const { QdrantClient } = require("@qdrant/js-client-rest");
const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const multer = require("multer");

dotenv.config();

const app = express();
app.use(cors());

// ✅ Fix for “PayloadTooLargeError”
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Initialize APIs
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// --- Upload PDF, chunk, and store in Qdrant ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text.trim();

    if (!text) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "No readable text in PDF" });
    }

    // Split into smaller chunks
    const chunks = [];
    const chunkSize = 500;
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    // Generate embeddings
    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const emb = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk,
        });
        return emb.data[0].embedding;
      })
    );

    // Prepare points for Qdrant
    const points = embeddings.map((vec, idx) => ({
      id: uuidv4(),
      vector: vec,
      payload: { text: chunks[idx] },
    }));

    await qdrant.upsert("my-collection", { points });

    fs.unlinkSync(req.file.path);

    res.json({ message: "✅ File processed and stored successfully!" });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Error processing file" });
  }
});

// --- Chat route: RAG retrieval + LLM response ---
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });

    const search = await qdrant.search("pdf_docs", {
      vector: emb.data[0].embedding,
      limit: 3,
    });

    const context = search.map((s) => s.payload.text).join("\n");
    console.log("Retrieved context:", context);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a helpful assistant.` },
        {
          role: "user",
          content: `Question: ${message}`,
        },
      ],
      temperature: 2,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat error" });
  }
});

const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

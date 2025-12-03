const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pdfParse = require("pdf-parse");
const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ----------------------- MULTER MEMORY STORAGE (IMPORTANT) -----------------------
const storage = multer.memoryStorage();
const upload = multer({ storage }); // 💥 No disk usage — fully Render compatible

// Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Qdrant Client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// ---------------------- Ensure Qdrant Collection Exists ----------------------
async function ensureCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === "pdf_docs");

  if (!exists) {
    console.log("📌 Creating Qdrant collection (768-dim)...");
    await qdrant.createCollection("pdf_docs", {
      vectors: {
        size: 768, // Gemini 004 embedding dimension
        distance: "Cosine",
      },
    });
    console.log("✅ Collection created successfully!");
  }
}
ensureCollection();

// ---------------------- Upload PDF (Memory Buffer) ----------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // PDF buffer directly from memory
    const pdfBuffer = req.file.buffer;

    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text.trim();

    if (!text) {
      return res.status(400).json({ error: "No readable text found in PDF" });
    }

    // -------- Chunking --------
    const chunks = [];
    const chunkSize = 500;

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    // -------- Generate embeddings --------
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const result = await embedModel.embedContent(chunk);
        return result.embedding.values; // 768-dim
      })
    );

    // -------- Store in Qdrant --------
    const points = embeddings.map((vec, idx) => ({
      id: uuidv4(),
      vector: vec,
      payload: { text: chunks[idx] },
    }));

    await qdrant.upsert("pdf_docs", { points });

    res.json({ message: "✅ File processed & stored successfully!" });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Error processing file" });
  }
});

// ---------------------- Chat Endpoint ----------------------
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Generate embedding for user query
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embedResponse = await embedModel.embedContent(message);
    const queryEmbedding = embedResponse.embedding.values;

    // Qdrant search
    const search = await qdrant.search("pdf_docs", {
      vector: queryEmbedding,
      limit: 3,
    });

    const context = search.map((s) => s.payload.text).join("\n\n");

    // Generate answer using Gemini 2.5 Flash
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Use ONLY the PDF context below to answer the user's question.
If answer is not in the PDF, say: "I could not find this in the document."

Context:
${context}

User Question:
${message}
`;

    const result = await chatModel.generateContent(prompt);
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat error" });
  }
});

// ---------------------- Start Server ----------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

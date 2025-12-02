const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pdfParse = require("pdf-parse");
const { QdrantClient } = require("@qdrant/js-client-rest");
const Groq = require("groq-sdk");
const { pipeline } = require("@xenova/transformers");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const multer = require("multer");

dotenv.config();
 
const app = express();
const allowedOrigins = ["http://localhost:3000", "http://localhost:5001","https://rag-chatbot-mauve-pi.vercel.app"];
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// ✅ Fix for “PayloadTooLargeError”
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
 
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});
 
// Embeddings via local transformer (CPU)
const VECTOR_SIZE = 384;
const COLLECTION = "pdf_docs_xenova";
let embedder;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
  }
  return embedder;
}

async function embedText(text) {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
  } catch (e) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}

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

    // Generate embeddings (local)
    await ensureCollection();
    const embeddings = await Promise.all(
      chunks.map(async (chunk) => embedText(chunk))
    );

    // Prepare points for Qdrant
    const points = embeddings.map((vec, idx) => ({
      id: uuidv4(),
      vector: vec,
      payload: { text: chunks[idx] },
    }));

    await qdrant.upsert(COLLECTION, { points });

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

    await ensureCollection();
    const embVec = await embedText(message);

    const search = await qdrant.search(COLLECTION, {
      vector: embVec,
      limit: 3,
    });

    const context = search.map((s) => s.payload.text).join("\n");
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` },
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

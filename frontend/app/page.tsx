"use client"
import { useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

export default function App() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi 👋 Upload a PDF to begin chatting!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const BACKEND_URL = "https://rag-chatbot-vnrj.onrender.com";

  // ===================== 📂 Upload PDF =====================
const handleFileUpload = async (file: File | null | undefined) => {
  if (!file) return;
  setUploading(true);
  setFileName(file.name);

  try {
    const formData = new FormData();
    formData.append("file", file); // ✅ must match upload.single("file")

    const res = await fetch(`${BACKEND_URL}/upload`, {
      method: "POST",
      body: formData, // ✅ no headers needed; browser sets boundary automatically
    });

    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: data.message || `✅ Uploaded "${file.name}" successfully!`,
      },
    ]);
  } catch (err) {
    console.error("Upload error:", err);
    setMessages((prev) => [
      ...prev,
      { role: "bot", text: "⚠️ Failed to upload file." },
    ]);
  } finally {
    setUploading(false);
  }
};


  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          const base64 = result.split(",")[1] ?? "";
          resolve(base64);
        } else {
          reject(new Error("Unexpected FileReader result"));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    });
  }

  // ===================== 💬 Chatbot Query =====================
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
 const res = await fetch(`${BACKEND_URL}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: userMsg.text }), // ✅ changed "question" → "message"
});

      const data = await res.json();
      console.log("Response data:", data);
      const botMsg = {
        role: "bot",
        text: data.reply || "Sorry, I couldn’t find that in the document.",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "⚠️ Error connecting to server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Auto scroll to latest message
  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      behavior: "smooth",
    });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 text-lg font-semibold flex justify-between items-center">
        <span>📚 RAG Chatbot Demo</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0] ?? null;
              handleFileUpload(f);
            }}
          />
          <div className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
            {uploading ? "Uploading..." : fileName ? "Change PDF" : "Upload PDF"}
          </div>
        </label>
      </div>

      {/* Message list (virtualized) */}
      <div className="flex-1 overflow-hidden">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          itemContent={(index, message) => (
            <div
              className={`p-3 m-2 max-w-[75%] break-words rounded-2xl shadow ${
                message.role === "user"
                  ? "self-end bg-blue-600 ml-auto text-white"
                  : "self-start bg-gray-800 mr-auto text-gray-100"
              }`}
              style={{ whiteSpace: "pre-wrap", lineHeight: "1.4em" }}
            >
              {message.text}
            </div>
          )}
          className="flex flex-col px-3"
          followOutput
        />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-gray-800 bg-gray-850 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about the document..."
          disabled={loading || uploading}
          className="flex-1 p-2 rounded-lg bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading || uploading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

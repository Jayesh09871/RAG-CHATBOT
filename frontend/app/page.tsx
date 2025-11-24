"use client"
import { useEffect, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";

export default function App() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi 👋 Upload a PDF to begin chatting!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const virtuosoRef = useRef(null);

  const BACKEND_URL = "http://localhost:5001";

  // ===================== 📂 Upload PDF =====================
const handleFileUpload = async (file) => {
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


  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
      {/* Header */}
      <div className="p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">RAG ChatBot</h1>
          </div>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              disabled={uploading}
            />
            <div className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              uploading 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
            }`}>
              {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : fileName ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  Change PDF
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Upload PDF
                </>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/30 to-transparent z-10 pointer-events-none"></div>
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          itemContent={(index, message) => (
            <div className={`w-full flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-4 py-2`}>
              <div className={`max-w-3xl w-full flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}>
                  {message.role === 'user' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z"></path>
                    </svg>
                  )}
                </div>
                <div className={`px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20'
                    : 'bg-gray-800 text-gray-100 rounded-tl-none shadow-lg shadow-gray-900/20'
                }`}>
                  <div className="text-sm whitespace-pre-wrap" style={{ lineHeight: '1.5' }}>
                    {message.text}
                  </div>
                  <div className="text-xs mt-1 opacity-60 text-right">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          )}
          className="h-full px-4 py-4 space-y-2"
          followOutput="auto"
          initialTopMostItemIndex={messages.length - 1}
        />
      </div>

      {/* Input area */}
      <div className="p-4 bg-gray-900/50 backdrop-blur-sm border-t border-gray-700/50">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Ask about the document..."
              disabled={loading || uploading}
              className="w-full pl-5 pr-14 py-3 bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent text-gray-100 placeholder-gray-500 transition-all duration-200"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || uploading}
              className={`absolute right-2 p-2 rounded-xl ${
                !input.trim() || loading || uploading
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-gray-700/50'
              } transition-colors duration-200`}
              aria-label="Send message"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-center text-gray-500 mt-2">
            {fileName ? `Currently analyzing: ${fileName}` : 'Upload a PDF to start chatting'}
          </p>
        </div>
      </div>
    </div>
  );
}

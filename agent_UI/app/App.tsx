import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { History, Bot, Sparkles } from "lucide-react";
import { ChatMessage } from "./components/ChatMessage";
import { MessageInput } from "./components/MessageInput";
import { HistoryPanel } from "./components/HistoryPanel";
import { ThinkingLoader } from "./components/ThinkingLoader";

// Stable SESSION_ID from localStorage
const getSessionId = () => {
  if (typeof window === 'undefined') return 'default-session';
  let id = localStorage.getItem('agent_session_id');
  if (!id) {
    id = Math.random().toString(36).substring(7);
    localStorage.setItem('agent_session_id', id);
  }
  return id;
};

const SESSION_ID = getSessionId();
const API_BASE_URL = "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  reasoning?: ReasoningStep[];
}

interface ReasoningStep {
  id: string;
  type: "started" | "tool" | "result" | "completed" | "error";
  tool?: string;
  content: string;
  timestamp: Date;
}

interface HistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  tools: string[];
  summary: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Load history on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/history/${SESSION_ID}`)
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          // Populate main chat messages
          const mappedMessages = data.history.map((m: any, i: number) => ({
            id: `hist-${i}`,
            role: m.type === "human" ? "user" : "agent",
            content: m.content,
            timestamp: new Date()
          }));
          setMessages(mappedMessages);

          // Populate history panel items (group into interactions)
          const historyItems: HistoryItem[] = [];
          for (let i = 0; i < data.history.length; i += 2) {
            const humanMsg = data.history[i];
            const aiMsg = data.history[i+1];
            if (humanMsg && humanMsg.type === "human") {
              historyItems.push({
                id: `hitem-${i}`,
                query: humanMsg.content,
                timestamp: new Date(),
                tools: [], // Backend currently doesn't persist tool list per turn easily
                summary: aiMsg ? (aiMsg.content.slice(0, 100) + "...") : "Awaiting response..."
              });
            }
          }
          setHistory(historyItems.reverse());
        }
      })
      .catch(err => console.error("History fetch error:", err));
  }, []);

  const mapLogsToReasoning = (logs: any[]): ReasoningStep[] => {
    return logs.map((log, i) => {
      let type: ReasoningStep["type"] = "started";
      let content = "";

      switch (log.type) {
        case "chain_start":
          type = "started";
          content = "Agent started processing your request";
          break;
        case "agent_action":
          type = "tool";
          content = `Calling tool: ${log.input}`;
          break;
        case "tool_start":
          type = "tool";
          content = `Executing tool: ${log.tool}`;
          break;
        case "tool_end":
          type = "result";
          content = `Result: ${log.output}`;
          break;
        case "tool_error":
          type = "error";
          content = `Error: ${log.error}`;
          break;
        case "agent_finish":
          type = "completed";
          content = "Final response generated";
          break;
        default:
          type = "started";
          content = "Processing step";
      }

      return {
        id: `r-${Date.now()}-${i}`,
        type,
        tool: log.tool,
        content,
        timestamp: new Date()
      };
    });
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID, message: content }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();

      const agentMessage: Message = {
        id: `msg-${Date.now()}-agent`,
        role: "agent",
        content: data.answer,
        timestamp: new Date(),
        reasoning: data.structured_logs ? mapLogsToReasoning(data.structured_logs) : [],
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "agent",
        content: "⚠️ I'm sorry, I'm having trouble connecting to the backend server. Please make sure it's running on port 8000.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background relative flex flex-col">
      {/* Background Glow */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 50%, var(--emerald-glow) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)",
        }}
      />

      {/* FIXED HEADER */}
      <header
        className="fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-20"
        style={{
          background: "var(--glass-bg)",
          borderColor: "var(--glass-border)",
          height: "72px"
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/70"
              animate={{
                boxShadow: [
                  "0 0 20px var(--emerald-glow)",
                  "0 0 30px var(--emerald-glow)",
                  "0 0 20px var(--emerald-glow)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Bot className="w-6 h-6 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold">
                Autonomous AI Agent
                <Sparkles className="w-4 h-4 text-primary" />
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Powered by Llama 3.3 via Groq
              </p>
            </div>
          </div>

          <motion.button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-lg border transition-all duration-200"
            style={{
              background: "var(--glass-bg)",
              borderColor: "var(--glass-border)",
            }}
            whileHover={{ scale: 1.05, boxShadow: "0 8px 20px rgba(16, 185, 129, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">History</span>
          </motion.button>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <main className="flex-1 overflow-y-auto pt-[72px] pb-[120px] px-6">
        <div className="max-w-4xl mx-auto py-8">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          <AnimatePresence>
            {isProcessing && (
              <div className="flex justify-start mb-6">
                <ThinkingLoader />
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* FIXED FOOTER */}
      <footer
        className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-20"
        style={{
          background: "var(--glass-bg)",
          borderColor: "var(--glass-border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-6">
          <MessageInput onSend={handleSendMessage} isProcessing={isProcessing} />
        </div>
      </footer>

      <AnimatePresence>
        {isHistoryOpen && (
          <HistoryPanel
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            history={history}
            onSelectItem={(id) => {
              console.log("Selected history item:", id);
              setIsHistoryOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
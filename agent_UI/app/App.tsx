import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { History, Bot, Sparkles, Terminal, Activity } from "lucide-react";
import { ChatMessage } from "./components/ChatMessage";
import { MessageInput } from "./components/MessageInput";
import { ThinkingLoader } from "./components/ThinkingLoader";
import { TracePanel, AgentStep } from "./components/TracePanel";
import { MemoryDrawer } from "./components/MemoryDrawer";

// Stable SESSION_ID from sessionStorage
const getSessionId = () => {
  if (typeof window === "undefined") return "default-session";
  let id = sessionStorage.getItem("agent_session_id");
  if (!id) {
    id = Math.random().toString(36).substring(7);
    sessionStorage.setItem("agent_session_id", id);
  }
  return id;
};

const SESSION_ID = getSessionId();
const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memoryRefreshCounter, setMemoryRefreshCounter] = useState(0);
  
  // Trace telemetry steps state
  const [currentTraceSteps, setCurrentTraceSteps] = useState<AgentStep[]>([]);
  
  // Health check state
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  // Mobile layout state
  const [isTraceVisibleMobile, setIsTraceVisibleMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounced 30s Health Check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (res.ok) {
          setIsBackendHealthy(true);
        } else {
          setIsBackendHealthy(false);
        }
      } catch {
        setIsBackendHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load message history on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/history/${SESSION_ID}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (data.history) {
          const mappedMessages = data.history.map((m: any, i: number) => ({
            id: `hist-${i}`,
            role: m.type === "human" ? "user" : "agent",
            content: m.content,
            timestamp: new Date(),
          }));
          setMessages(mappedMessages);
        }
      })
      .catch((err) => console.error("History fetch error:", err));
  }, []);

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
      };

      // Set the trace reasoning steps for the left/trace panel
      if (data.steps) {
        setCurrentTraceSteps(data.steps);
      } else if (data.intermediate_steps) {
        setCurrentTraceSteps(data.intermediate_steps);
      } else {
        setCurrentTraceSteps([]);
      }

      setMessages((prev) => [...prev, agentMessage]);
      setMemoryRefreshCounter((prev) => prev + 1); // trigger auto-refresh for MemoryDrawer
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "agent",
        content: "⚠️ I'm sorry, I'm having trouble connecting to the backend server. Please make sure the API is running and reachable.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#0a0a0f] text-[#e8e9ed] font-sans flex flex-col overflow-hidden relative">
      {/* Background Glow */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 10% 30%, var(--primary) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 40%)",
        }}
      />

      {/* HEADER */}
      <header className="h-[64px] shrink-0 border-b border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold tracking-wide text-foreground flex items-center gap-1.5">
              Autonomous AI Agent
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
            </h1>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">
              Llama 3.3 · Groq
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span className="text-[10px] opacity-40">SESSION:</span>
            <span className="text-foreground font-semibold">{SESSION_ID.substring(0, 8)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy === true
                  ? "bg-primary animate-pulse"
                  : isBackendHealthy === false
                  ? "bg-destructive"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-muted-foreground uppercase text-[8px] tracking-wider hidden sm:inline">
              {isBackendHealthy === true ? "online" : isBackendHealthy === false ? "offline" : "connecting"}
            </span>
          </div>

          {/* Toggle trace button for mobile layout */}
          {isMobile && (
            <button
              onClick={() => setIsTraceVisibleMobile(!isTraceVisibleMobile)}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                isTraceVisibleMobile
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-white/[0.02] border-white/5 text-muted-foreground"
              }`}
            >
              <Terminal className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsMemoryOpen(true)}
            className="flex items-center gap-2 p-2 sm:px-3.5 sm:py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 text-xs font-semibold tracking-wide text-foreground transition-all duration-200"
          >
            <History className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Memory</span>
          </button>
        </div>
      </header>

      {/* WORKSPACE PANELS */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Telemetry (visible on desktop or active on mobile) */}
        <div
          className={`w-[30%] min-w-[320px] max-w-[400px] shrink-0 h-full transition-transform duration-300 z-10 ${
            isMobile
              ? isTraceVisibleMobile
                ? "absolute inset-y-0 left-0 w-full max-w-full translate-x-0"
                : "absolute inset-y-0 left-0 w-full max-w-full -translate-x-full"
              : "block"
          }`}
        >
          <TracePanel
            steps={currentTraceSteps}
            onClose={isMobile ? () => setIsTraceVisibleMobile(false) : undefined}
          />
        </div>

        {/* Right Panel: Chat (always visible) */}
        <div className="flex-1 flex flex-col h-full bg-[#0a0a0f]/40 relative">
          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground select-none">
                  <div className="p-4 rounded-full bg-white/[0.01] border border-white/5 mb-4 animate-bounce">
                    <Sparkles className="w-10 h-10 text-primary/40" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Welcome to Autonomous telemetry console</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mt-2 leading-relaxed">
                    Ask me math queries, files manipulation tasks, or web knowledge inquiries to initialize operational agents.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}

              <AnimatePresence>
                {isProcessing && (
                  <div className="flex justify-start py-2">
                    <ThinkingLoader />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Input Area */}
          <div className="p-6 bg-gradient-to-t from-slate-950/80 to-transparent border-t border-white/5">
            <div className="max-w-3xl mx-auto">
              <MessageInput onSend={handleSendMessage} isProcessing={isProcessing} />
            </div>
          </div>
        </div>
      </div>

      {/* Memory Drawer Modal Overlay */}
      <MemoryDrawer
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        sessionId={SESSION_ID}
        apiUrl={API_BASE_URL}
        triggerRefresh={memoryRefreshCounter}
      />
    </div>
  );
}
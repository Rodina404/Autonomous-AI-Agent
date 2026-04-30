import { motion } from "motion/react";
import { ReasoningTrace } from "./ReasoningTrace";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  reasoning?: ReasoningStep[];
}

interface ReasoningStep {
  id: string;
  type: "started" | "tool" | "result" | "completed";
  tool?: string;
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAgent = message.role === "agent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-6`}
    >
      <div className={`max-w-[80%] ${isAgent ? "mr-auto" : "ml-auto"}`}>
        <div
          className={`rounded-2xl px-5 py-4 ${
            isAgent
              ? "bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-lg"
              : "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-lg"
          }`}
          style={
            isAgent
              ? {
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                }
              : undefined
          }
        >
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </div>
          <div className="mt-2 opacity-60" style={{ fontSize: "0.8125rem" }}>
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {isAgent && message.reasoning && message.reasoning.length > 0 && (
          <div className="mt-3">
            <ReasoningTrace steps={message.reasoning} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

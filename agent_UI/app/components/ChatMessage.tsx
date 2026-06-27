import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "agent";
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"} mb-6`}
    >
      <div className={`max-w-[85%] ${isAgent ? "mr-auto" : "ml-auto"}`}>
        <div
          className={`rounded-2xl px-5 py-4 border ${
            isAgent
              ? "bg-slate-900/40 border-white/5 text-foreground shadow-xl backdrop-blur-md"
              : "bg-primary border-primary/20 text-primary-foreground shadow-lg"
          }`}
          style={
            isAgent
              ? {
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
                }
              : undefined
          }
        >
          {isAgent ? (
            <div className="prose prose-invert prose-teal max-w-none text-sm leading-relaxed space-y-2">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    return (
                      <code
                        className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-xs select-all text-primary font-semibold"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre({ node, children, ...props }) {
                    return (
                      <pre
                        className="font-mono bg-black/60 border border-white/5 p-3 rounded-lg text-xs overflow-x-auto select-all my-2 text-foreground"
                        {...props}
                      >
                        {children}
                      </pre>
                    );
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>;
                  },
                  p({ children }) {
                    return <p className="leading-relaxed">{children}</p>;
                  },
                  strong({ children }) {
                    return <strong className="text-primary font-semibold">{children}</strong>;
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-sm font-sans whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}

          <div
            className={`mt-2 text-[10px] opacity-40 font-mono ${
              isAgent ? "text-muted-foreground" : "text-primary-foreground"
            }`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from "react";
import { motion } from "motion/react";
import { Send, Paperclip, Loader2 } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
  isProcessing: boolean;
}

export function MessageInput({ onSend, isProcessing }: MessageInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <motion.div
        className="rounded-2xl backdrop-blur-xl border transition-all duration-300 overflow-hidden"
        style={{
          background: "var(--glass-bg)",
          borderColor: isFocused ? "var(--primary)" : "var(--glass-border)",
          boxShadow: isFocused
            ? "0 0 30px var(--emerald-glow), 0 8px 32px rgba(0, 0, 0, 0.3)"
            : "0 4px 16px rgba(0, 0, 0, 0.2)",
        }}
        animate={{
          scale: isFocused ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-end gap-3 p-4">
          <button
            type="button"
            className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 text-muted-foreground hover:text-foreground"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask the AI agent anything..."
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 text-foreground placeholder:text-muted-foreground"
            style={{ minHeight: "24px" }}
            rows={1}
            disabled={isProcessing}
          />

          <motion.button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            whileHover={{ scale: input.trim() && !isProcessing ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() && !isProcessing ? 0.95 : 1 }}
            style={{
              boxShadow: input.trim()
                ? "0 0 20px var(--emerald-glow)"
                : "none",
            }}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="absolute -inset-0.5 rounded-2xl opacity-0 -z-10 blur-xl"
        style={{
          background: "linear-gradient(45deg, var(--primary), var(--chart-2))",
        }}
        animate={{
          opacity: isFocused ? 0.3 : 0,
        }}
        transition={{ duration: 0.3 }}
      />
    </form>
  );
}

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Send, Loader2, Keyboard } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
  isProcessing: boolean;
}

export function MessageInput({ onSend, isProcessing }: MessageInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize handler
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSend(input.trim());
      setInput("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <motion.div
        className="rounded-xl border transition-all duration-300 overflow-hidden bg-slate-900/40 border-white/5"
        style={{
          boxShadow: isFocused
            ? "0 0 25px rgba(0, 212, 170, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)"
            : "0 4px 16px rgba(0, 0, 0, 0.3)",
        }}
        animate={{
          borderColor: isFocused ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-end gap-3 p-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              // Submit on Enter, allow Shift+Enter for newlines
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 text-sm text-foreground placeholder:text-muted-foreground font-sans leading-relaxed py-1"
            style={{ minHeight: "24px" }}
            rows={1}
            disabled={isProcessing}
          />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:flex items-center gap-1 select-none">
              <Keyboard className="w-3 h-3" /> Enter
            </span>
            
            <motion.button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="flex-shrink-0 p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              whileHover={{ scale: input.trim() && !isProcessing ? 1.05 : 1 }}
              whileTap={{ scale: input.trim() && !isProcessing ? 0.95 : 1 }}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </form>
  );
}

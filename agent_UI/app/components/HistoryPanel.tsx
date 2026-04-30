import { motion } from "motion/react";
import { History, X, Wrench, Calculator, Search, FileText } from "lucide-react";

interface HistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  tools: string[];
  summary: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectItem: (id: string) => void;
}

const toolIcons: Record<string, React.ReactNode> = {
  Calculator: <Calculator className="w-3.5 h-3.5" />,
  "Web Search": <Search className="w-3.5 h-3.5" />,
  "File Manager": <FileText className="w-3.5 h-3.5" />,
};

export function HistoryPanel({ isOpen, onClose, history, onSelectItem }: HistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl z-50 overflow-hidden"
        style={{
          background: "var(--background)",
          borderLeft: "1px solid var(--glass-border)",
          boxShadow: "-20px 0 60px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="h-full flex flex-col">
          <div
            className="flex items-center justify-between p-6 backdrop-blur-xl border-b"
            style={{
              background: "var(--glass-bg)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2>Interaction History</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {history.length} conversation{history.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No history yet</p>
                  <p className="text-sm mt-1">Your conversations will appear here</p>
                </div>
              ) : (
                history.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectItem(item.id)}
                    className="rounded-xl p-4 cursor-pointer transition-all duration-200 backdrop-blur-lg border"
                    style={{
                      background: "var(--glass-bg)",
                      borderColor: "var(--glass-border)",
                    }}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 8px 30px rgba(16, 185, 129, 0.15)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm mb-1">{item.query}</h3>
                        <div className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleDateString()} at{" "}
                          {item.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                    {item.tools.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {item.tools.map((tool) => (
                          <div
                            key={tool}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs"
                          >
                            {toolIcons[tool] || <Wrench className="w-3.5 h-3.5" />}
                            <span>{tool}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.summary}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, RefreshCw, Database, Clock, Lightbulb } from "lucide-react";

interface Episode {
  id: string;
  content: string;
  type: string;
  timestamp?: string;
}

interface MemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  apiUrl: string;
  triggerRefresh: number; // Increment this to force auto-refresh
}

export function MemoryDrawer({ isOpen, onClose, sessionId, apiUrl, triggerRefresh }: MemoryDrawerProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMemory = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/memory?session_id=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data.episodes || []);
      }
    } catch (err) {
      console.error("Failed to fetch memory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemory();
    }
  }, [isOpen, sessionId, apiUrl, triggerRefresh]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-950 border-l border-white/5 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Episodic Memory</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchMemory}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Episodes Section */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Recent Episodes
                </h3>
                <div className="space-y-3">
                  {episodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic pl-1">No episodes recorded in this session yet.</p>
                  ) : (
                    episodes.slice(-5).reverse().map((ep) => (
                      <div
                        key={ep.id}
                        className={`p-3 rounded-lg border text-sm ${
                          ep.type === "human"
                            ? "bg-white/[0.01] border-white/5 text-muted-foreground"
                            : "bg-primary/5 border-primary/10 text-foreground"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-mono tracking-wider opacity-60 mb-1">
                          {ep.type === "human" ? "User Request" : "Agent Response"}
                        </div>
                        <div className="line-clamp-3 overflow-hidden text-ellipsis select-all">
                          {ep.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Facts Section */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Stored Facts
                </h3>
                <div className="p-4 rounded-lg border border-dashed border-white/5 bg-white/[0.01] text-center">
                  <p className="text-xs text-muted-foreground">
                    Fact extraction model will list key concepts derived from conversation [planned].
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

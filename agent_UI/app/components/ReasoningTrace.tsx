import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Play, Wrench, CheckCircle2, AlertCircle } from "lucide-react";

interface ReasoningStep {
  id: string;
  type: "started" | "tool" | "result" | "completed" | "error";
  tool?: string;
  content: string;
  timestamp: Date;
}

interface ReasoningTraceProps {
  steps: ReasoningStep[];
}

export function ReasoningTrace({ steps }: ReasoningTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const getStepIcon = (type: string) => {
    switch (type) {
      case "started":
        return <Play className="w-4 h-4 text-primary" />;
      case "tool":
        return <Wrench className="w-4 h-4 text-blue-400" />;
      case "result":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden backdrop-blur-lg border transition-all duration-300"
      style={{
        background: "var(--glass-bg)",
        borderColor: isExpanded ? "var(--primary)" : "var(--glass-border)",
        boxShadow: isExpanded
          ? "0 0 20px var(--emerald-glow), 0 8px 32px rgba(0, 0, 0, 0.4)"
          : "0 4px 16px rgba(0, 0, 0, 0.2)",
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isExpanded ? 360 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <Wrench className="w-4 h-4 text-primary" />
          </motion.div>
          <span className="text-sm text-muted-foreground">Reasoning Trace</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
            {steps.length} steps
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onHoverStart={() => setHoveredStep(step.id)}
                  onHoverEnd={() => setHoveredStep(null)}
                  className="flex gap-3 p-3 rounded-lg transition-all duration-200"
                  style={{
                    background:
                      hoveredStep === step.id
                        ? "rgba(16, 185, 129, 0.1)"
                        : "transparent",
                    borderLeft:
                      hoveredStep === step.id
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                  }}
                >
                  <div className="flex-shrink-0 mt-0.5">{getStepIcon(step.type)}</div>
                  <div className="flex-1 min-w-0">
                    {step.tool && (
                      <div className="text-xs text-primary mb-1">
                        {step.type === "tool" ? "Calling tool:" : "Tool:"} {step.tool}
                      </div>
                    )}
                    <div className="text-sm text-foreground/90 break-words">
                      {step.content}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {step.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

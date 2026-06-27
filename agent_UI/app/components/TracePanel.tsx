import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Cpu, Terminal, FileText, Globe } from "lucide-react";

export interface AgentStep {
  tool: string;
  tool_input: string;
  observation: string;
}

interface TracePanelProps {
  steps: AgentStep[];
  onClose?: () => void;
}

export function TracePanel({ steps, onClose }: TracePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getToolBadge = (toolName: string) => {
    switch (toolName) {
      case "calculator_tool":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            🔢 Calculator
          </span>
        );
      case "file_reader_tool":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            📁 File Manager
          </span>
        );
      case "web_search_tool":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            🌐 Web Search
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-white/10">
            ⚙️ {toolName}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/60 border-r border-white/5 backdrop-blur-xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
            Telemetry & Reasoning
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 px-2.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground text-xs transition-all duration-200"
          >
            Back to Chat
          </button>
        )}
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
            <Cpu className="w-8 h-8 opacity-20 mb-2 animate-pulse text-primary" />
            <p>Awaiting operations...</p>
            <p className="text-[10px] mt-1 opacity-60">No tool calls in this response.</p>
          </div>
        ) : (
          steps.map((step, idx) => {
            const isExpanded = expandedSteps[idx] || false;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden"
              >
                {/* Step Header */}
                <div
                  onClick={() => toggleStep(idx)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-muted-foreground">Step #{idx + 1}</span>
                    {getToolBadge(step.tool)}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Step Content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/5 bg-black/40 px-4 py-3 space-y-3"
                    >
                      {/* Tool Input */}
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Arguments
                        </div>
                        <pre className="p-2 rounded bg-white/[0.02] border border-white/5 text-foreground overflow-x-auto select-all">
                          {step.tool_input}
                        </pre>
                      </div>

                      {/* Tool Output */}
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                          Response
                        </div>
                        <pre className="p-2 rounded bg-white/[0.02] border border-white/5 text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                          {step.observation}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

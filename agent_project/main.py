"""
Entry point for the Autonomous AI Agent application.

Run with:
    python main.py

The script loads environment variables from a .env file, initialises the
ReAct agent and its sliding-window memory, then drives an interactive CLI
loop until the user types 'quit' or sends a keyboard interrupt.
"""

import os
import sys
import json
from datetime import datetime

# Force utf-8 encoding for standard output/error to prevent UnicodeEncodeError on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

import warnings
from langchain_core._api.deprecation import LangChainDeprecationWarning
warnings.filterwarnings("ignore", category=LangChainDeprecationWarning)

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment — must happen BEFORE importing agent modules so that
# os.environ values (GROQ_API_KEY, GROQ_MODEL) are already set when
# ChatGroq is instantiated inside agent.py.
# ---------------------------------------------------------------------------
load_dotenv()  # reads .env in the current working directory (silent if absent)

from agent.agent import build_agent, run_agent  # noqa: E402
from agent.memory import get_memory, clear_memory  # noqa: E402


# ---------------------------------------------------------------------------
# History Persistence
# ---------------------------------------------------------------------------
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "agent_history.json")

def load_history() -> list:
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
                for entry in history:
                    if "timestamp" in entry:
                        entry["timestamp"] = datetime.fromisoformat(entry["timestamp"])
                return history
        except Exception as e:
            print(f"Failed to load history: {e}", file=sys.stderr)
    return []

def save_history(history: list) -> None:
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            serializable_history = []
            for entry in history:
                copy_entry = entry.copy()
                if isinstance(copy_entry.get("timestamp"), datetime):
                    copy_entry["timestamp"] = copy_entry["timestamp"].isoformat()
                serializable_history.append(copy_entry)
            json.dump(serializable_history, f, indent=2)
    except Exception as e:
        print(f"Failed to save history: {e}", file=sys.stderr)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _print_banner() -> None:
    """Print the startup banner with live environment values."""
    print("  ╔══════════════════════════════════════╗")
    print("  ║     Autonomous AI Agent (Groq)       ║")
    print("  ║  Model : llama-3.3-70b-versatile     ║")
    print("  ║  Tools : calc | files | web search   ║")
    print("  ║  Commands : quit  clear  history      ║")
    print("  ╚══════════════════════════════════════╝\n")


import textwrap

def display_result(result: dict) -> None:
    logs = result.get("structured_logs", [])
    steps = result.get("intermediate_steps", [])
    answer = result.get("answer", "")
    W = 52  # box inner width

    def pad(text, width):
        return text.ljust(width)

    # ── Reasoning Trace block (only if tools were used) ──
    tool_logs = [l for l in logs if l["type"] in
                 ("tool_start", "tool_end", "tool_error", "agent_action")]

    if tool_logs:
        print("\n  ┌" + "─" * W + "┐")
        print("  │" + "  🔍 Reasoning Trace".ljust(W) + "│")
        print("  ├" + "─" * W + "┤")

        for log in logs:
            t = log["type"]

            if t == "chain_start":
                line = "▶ Agent started"
                print("  │  " + pad(line, W-3) + "│")

            elif t == "agent_action":
                print("  ├" + "─" * W + "┤")
                line = f"⚙  Calling tool  : {log['tool']}"
                print("  │  " + pad(line, W-3) + "│")
                # word-wrap the tool input
                input_lines = textwrap.wrap(
                    f"   Input          : {log['input']}", width=W-3)
                for il in input_lines:
                    print("  │  " + pad(il, W-3) + "│")

            elif t == "tool_end":
                output_lines = textwrap.wrap(
                    f"✔  Result         : {log['output']}", width=W-3)
                for ol in output_lines:
                    print("  │  " + pad(ol, W-3) + "│")

            elif t == "tool_error":
                print("  │  " + pad(f"✘  Tool error: {log['error']}", W-3) + "│")

            elif t == "agent_finish":
                print("  ├" + "─" * W + "┤")
                print("  │  " + pad("✓ Agent finished", W-3) + "│")

        print("  └" + "─" * W + "┘")

    # ── Final Answer block ──
    print("\n  ╔" + "═" * W + "╗")
    print("  ║" + pad("  Agent Answer", W) + "║")
    print("  ╠" + "═" * W + "╣")

    answer_lines = textwrap.wrap(answer, width=W-4)
    for line in (answer_lines or [answer]):
        print("  ║  " + pad(line, W-2) + "║")

    if steps:
        tools_str = ", ".join(result.get("tools_used", [])) or "unknown"
        print("  ╠" + "═" * W + "╣")
        print("  ║  " + pad(f"Tool     : {tools_str}", W-2) + "║")
        print("  ║  " + pad(f"Steps    : {result['steps_taken']}", W-2) + "║")

    print("  ╚" + "═" * W + "╝\n")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    """
    Initialise the agent and run the interactive CLI loop.

    Control flow
    ------------
    - 'quit' / 'exit'  → clean shutdown
    - 'clear'          → wipe conversation memory, continue
    - 'history'        → show recent chat history
    - empty input      → skip silently, re-prompt
    - anything else    → invoke the agent, print the answer

    All inner-loop exceptions are caught so the program never crashes
    permanently; only KeyboardInterrupt causes an orderly exit.
    """
    _print_banner()

    # Initialise memory and executor once; share them across the whole session.
    memory = get_memory()
    session_history = load_history()

    try:
        agent_executor = build_agent()
    except Exception as exc:  # e.g. missing GROQ_API_KEY
        print(
            f"\n[ERROR] Could not initialise the agent: {exc}\n"
            "Make sure GROQ_API_KEY and TAVILY_API_KEY are set in your .env file.",
            file=sys.stderr,
        )
        sys.exit(1)

    while True:
        try:
            user_input: str = input("\nYou: ").strip()
        except KeyboardInterrupt:
            print("\nInterrupted.")
            sys.exit(0)
        except EOFError:
            # Non-interactive environment (piped input exhausted)
            print("\nGoodbye!")
            sys.exit(0)

        # --- Special commands ---
        if user_input.lower() in ("quit", "exit"):
            print("Goodbye!")
            sys.exit(0)

        if user_input.lower() == "clear history":
            clear_memory(memory)
            session_history.clear()
            save_history(session_history)
            print("History and memory cleared.")
            continue

        if user_input.lower() == "clear":
            clear_memory(memory)
            print("Memory cleared.")
            continue

        if user_input.lower() == "history":
            if not session_history:
                print("No conversation history yet.")
            else:
                print("\n    ┌──── Structured Conversation History ────┐")
                for idx, entry in enumerate(session_history[-5:], 1):
                    time_str = entry["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
                    query = entry["query"]
                    actions = [log["tool"] for log in entry.get("verbose", []) if log["type"] == "agent_action"]
                    # Get unique tools
                    tools_used_list = list(dict.fromkeys(actions))
                    tools_str = ", ".join(tools_used_list) if tools_used_list else "None"
                    
                    print(f"    │ [{idx}] Date/Time : {time_str}")
                    print(f"    │     Query     : {query}")
                    print(f"    │     Tools     : {tools_str}")
                    print("     │     final answer: ")
                    
                    ans = entry.get("answer", "")
                    ans_lines = textwrap.wrap(ans, width=100)
                    for line in (ans_lines or [ans]):
                        print("  ║  " + line.ljust(100) + "║")
                    
                    print("    ├──────────────────────────────────────────────────────────────────────────────┤")
                print("    └──────────────────────────────────────────────────────────────────────────────┘")
            continue

        if not user_input:
            continue

        # --- Agent invocation ---
        try:
            result: dict = run_agent(user_input, agent_executor, memory)
            
            # Graceful handle for max iterations
            ans = result.get("answer", "")
            if "Agent stopped due to iteration limit or time limit." in ans or "Agent stopped due to max iterations" in ans:
                result["answer"] = "I apologize, but I reached my thinking limit on this complex task. I've stopped to prevent an infinite loop. Please try breaking your request into smaller steps!"
            
            # Add to session history
            session_history.append({
                "timestamp": datetime.now(),
                "query": user_input,
                "tools": result.get("tools_used", []),
                "verbose": result.get("structured_logs", []),
                "answer": result.get("answer", "")
            })
            save_history(session_history)
            
            display_result(result)

        except KeyboardInterrupt:
            # Allow Ctrl-C mid-generation to abort the current call without
            # killing the whole session.
            print("\n[Interrupted — ready for next input]")
            continue

        except Exception as exc:
            # run_agent itself already swallows exceptions and returns a dict,
            # but guard here in case something truly unexpected escapes.
            print(
                "\nAgent: Sorry, something went wrong. Please try again.",
                file=sys.stdout,
            )
            print(f"[INTERNAL ERROR] {exc}", file=sys.stderr)
            continue


# ---------------------------------------------------------------------------
# Entry guard
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# Manual test cases (do NOT uncomment — for documentation only)
# ---------------------------------------------------------------------------

# Test 1 (calculator):
#   Input : "What is 15% of 847 plus the square root of 225?"
#   Expect: agent chains calculator calls → multi-step math answer

# Test 2 (file reader):
#   Input : "Read the sample.txt file and summarize it"
#   Expect: agent calls file_reader_tool("sample.txt") → returns file content
#           then produces a brief summary

# Test 3 (web search):
#   Input : "What is the latest version of Python?"
#   Expect: agent calls web_search_tool → returns search snippets with version info

# Test 4 (multi-step / tool chaining):
#   Input : "Search for the Fibonacci sequence, then calculate the 10th Fibonacci number"
#   Expect: agent first calls web_search_tool to confirm the sequence definition,
#           then calls calculator_tool("fibonacci(10)") or explicit arithmetic
#           → final answer: 55

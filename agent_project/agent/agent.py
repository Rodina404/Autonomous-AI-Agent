"""
Core Autonomous AI Agent logic.

This module assembles the full ReAct agent pipeline using LangChain's
new create_agent API (v1.2+):
  - ChatGroq LLM (model name and API key read from environment)
  - Three tools: calculator, file_reader, web_search
  - Message-based conversation history (managed externally)
  - CompiledStateGraph with automatic tool-calling loop

Public API
----------
build_agent()                                   → CompiledStateGraph
run_agent(user_input, agent, memory)            → dict
"""

import os
from typing import Any, Dict, List

from langchain.agents import create_agent
from langchain_core.messages import HumanMessage
from langchain_core.callbacks.base import BaseCallbackHandler
from langchain_groq import ChatGroq

from agent.tools import calculator_tool, file_reader_tool, web_search_tool
from agent.memory import get_memory, ConversationMemory  # re-exported for callers

tools = [calculator_tool, file_reader_tool, web_search_tool]


# ---------------------------------------------------------------------------
# Custom Callback Handler
# ---------------------------------------------------------------------------

class StructuredLogHandler(BaseCallbackHandler):
    """Captures agent reasoning steps into a structured log list."""

    def __init__(self):
        self.logs: List[Dict] = []

    def on_chain_start(self, serialized, inputs, **kwargs):
        self.logs.append({
            "type": "chain_start",
            "input": str(inputs)[:200] if inputs else ""
        })

    def on_tool_start(self, serialized, input_str, **kwargs):
        tool_name = serialized.get("name", "unknown_tool")
        self.logs.append({
            "type": "tool_start",
            "tool": tool_name,
            "input": input_str
        })

    def on_tool_end(self, output, **kwargs):
        # Truncate long outputs for display
        display = str(output)
        if len(display) > 200:
            display = display[:200] + "... [truncated]"
        self.logs.append({
            "type": "tool_end",
            "output": display
        })

    def on_tool_error(self, error, **kwargs):
        self.logs.append({
            "type": "tool_error",
            "error": str(error)
        })

    def on_chat_model_start(self, serialized, messages, **kwargs):
        self.logs.append({
            "type": "agent_action",
            "tool": "llm",
            "input": "Thinking..."
        })

    def on_chain_end(self, outputs, **kwargs):
        self.logs.append({"type": "chain_end"})


# ---------------------------------------------------------------------------
# System / ReAct prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a task-execution assistant. You have access to tools
and you MUST use them according to these strict rules:

CRITICAL SCOPE RULE: These rules ONLY apply to the LATEST message sent by the user. Do NOT invoke tools to re-evaluate, re-calculate, or re-run queries that are already present in the chat history.

HISTORICAL QUERIES: If the user is asking about the conversation history, previous questions, or metadata about the session (e.g., "what was my second query?"), you MUST answer directly from your memory without invoking any tools.

RULE 1 — MATH: Any arithmetic, calculation, percentage, modulo, or numerical
expression in the latest message — no matter how simple — MUST be sent to calculator_tool.
Never calculate in your head. Even "2+2" must use calculator_tool.

RULE 2 — FILES: Any request mentioning a filename, "read", "open", "file",
"sample.txt", or similar in the latest message MUST use file_reader_tool immediately.
Never summarize or guess file contents.

RULE 3 — FACTS/SEARCH: Any question about current events, definitions,
people, companies, or general knowledge in the latest message MUST use web_search_tool.
Never answer factual questions from your training data.

RULE 4 — NO DIRECT ANSWERS: You are NOT allowed to answer any of the
above categories directly. If you are tempted to answer without a tool,
stop and use the appropriate tool instead.

After the tool returns a result, synthesize it into a clear final answer.
Do not repeat the raw tool output — explain it naturally."""


# ---------------------------------------------------------------------------
# LLM factory
# ---------------------------------------------------------------------------

def _build_llm() -> ChatGroq:
    """
    Instantiate a ChatGroq LLM from environment variables.

    Environment variables
    ---------------------
    GROQ_API_KEY  : (required) Groq cloud API key.
    GROQ_MODEL    : model tag to use (default: "llama-3.3-70b-versatile").

    Returns
    -------
    ChatGroq

    Raises
    ------
    ValueError
        If GROQ_API_KEY is missing or empty.
    """
    api_key: str | None = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY not set in environment. "
            "Add it to your .env file and restart."
        )

    model_name: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    return ChatGroq(
        model=model_name,
        api_key=api_key,
        temperature=0,
    )


# ---------------------------------------------------------------------------
# Agent / graph factory
# ---------------------------------------------------------------------------

def build_agent():
    """
    Build and return a fully configured agent graph backed by Groq.

    Uses LangChain's create_agent (v1.2+) which returns a
    CompiledStateGraph with automatic tool-calling loop.

    Returns
    -------
    CompiledStateGraph
        Ready to call with .invoke().

    Raises
    ------
    ValueError
        Propagated from _build_llm() if GROQ_API_KEY is not set.
    """
    llm = _build_llm()

    return create_agent(
        model=llm,
        tools=tools,
        system_prompt=_SYSTEM_PROMPT,
    )


# ---------------------------------------------------------------------------
# Public run interface
# ---------------------------------------------------------------------------

def run_agent(
    user_input: str,
    agent,
    memory: "ConversationMemory",
) -> dict[str, Any]:
    """Run the agent and return a structured result dict.

    The new create_agent API uses message-based input/output:
      Input:  {"messages": [HumanMessage, AIMessage, ...]}
      Output: {"messages": [...all messages including tool calls...]}
    """
    # Build message list from memory + new user input
    history_messages = memory.get_messages()
    all_messages = history_messages + [HumanMessage(content=user_input)]

    log_handler = StructuredLogHandler()

    try:
        result = agent.invoke(
            {"messages": all_messages},
            config={"callbacks": [log_handler]},
        )

        # Extract the final AI response from the output messages
        output_messages = result.get("messages", [])
        final_answer = ""
        tools_used = []
        safe_steps = []

        for msg in output_messages:
            # Skip messages that were in the input
            if msg in all_messages:
                continue

            if hasattr(msg, "tool_calls") and msg.tool_calls:
                # This is an AI message with tool calls
                for tc in msg.tool_calls:
                    tools_used.append(tc.get("name", "unknown"))
                    safe_steps.append({
                        "tool": tc.get("name", "unknown"),
                        "tool_input": str(tc.get("args", "")),
                        "observation": "",  # Will be filled by ToolMessage
                    })
            elif hasattr(msg, "type") and msg.type == "tool":
                # This is a ToolMessage — fill the observation
                if safe_steps:
                    safe_steps[-1]["observation"] = str(msg.content)[:500]

        # The last AI message is the final answer
        for msg in reversed(output_messages):
            if hasattr(msg, "type") and msg.type == "ai" and msg.content:
                final_answer = msg.content
                break

        # Save conversation to memory
        memory.add_user_message(user_input)
        memory.add_ai_message(final_answer)

        return {
            "question": user_input,
            "answer": final_answer,
            "response": final_answer,  # Phase 2 compat alias
            "steps_taken": len(safe_steps),
            "steps": safe_steps,  # Phase 2 compat alias
            "tools_used": list(dict.fromkeys(tools_used)),  # unique, ordered
            "structured_logs": log_handler.logs,
            "intermediate_steps": safe_steps,
        }
    except Exception as e:
        # Save user message to memory even on error to maintain conversation flow
        memory.add_user_message(user_input)
        memory.add_ai_message(f"Agent error: {str(e)}")
        return {
            "question": user_input,
            "answer": f"Agent error: {str(e)}",
            "response": f"Agent error: {str(e)}",
            "steps_taken": 0,
            "steps": [],
            "tools_used": [],
            "structured_logs": log_handler.logs,
            "intermediate_steps": [],
        }

__all__ = ["build_agent", "run_agent", "get_memory", "ConversationMemory"]

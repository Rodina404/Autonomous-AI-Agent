"""
Core Autonomous AI Agent logic.

This module assembles the full ReAct agent pipeline:
  - ChatGroq LLM (model name and API key read from environment)
  - Three tools: calculator, file_reader, web_search
  - Sliding-window conversation memory (via agent.memory)
  - AgentExecutor with verbose logging and error recovery

Public API
----------
build_agent()                                   → AgentExecutor
run_agent(user_input, agent_executor, memory)   → dict
"""

import os
from typing import Any, Dict, List, Union
from uuid import UUID

from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_classic.memory import ConversationBufferWindowMemory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.callbacks.base import BaseCallbackHandler
from langchain_groq import ChatGroq

from agent.tools import calculator_tool, file_reader_tool, web_search_tool
from agent.memory import get_memory  # re-exported for callers who import from here

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
            "input": inputs.get("input", "")
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

    def on_agent_action(self, action, **kwargs):
        self.logs.append({
            "type": "agent_action",
            "tool": action.tool,
            "input": str(action.tool_input)
        })

    def on_agent_finish(self, finish, **kwargs):
        self.logs.append({
            "type": "agent_finish",
            "output": finish.return_values.get("output", "")[:100]
        })

    def on_chain_end(self, outputs, **kwargs):
        self.logs.append({"type": "chain_end"})


# ---------------------------------------------------------------------------
# System / ReAct prompt
# ---------------------------------------------------------------------------

_SYSTEM_TEMPLATE = """\
You are a task-execution assistant. You have access to tools
and you MUST use them according to these strict rules:

RULE 1 — MATH: Any arithmetic, calculation, percentage, modulo, or numerical
expression — no matter how simple — MUST be sent to calculator_tool.
Never calculate in your head. Even "2+2" must use calculator_tool.

RULE 2 — FILES: Any request mentioning a filename, "read", "open", "file",
"sample.txt", or similar MUST use file_reader_tool immediately.
Never summarize or guess file contents.

RULE 3 — FACTS/SEARCH: Any question about current events, definitions,
people, companies, or general knowledge MUST use web_search_tool.
Never answer factual questions from your training data.

RULE 4 — NO DIRECT ANSWERS: You are NOT allowed to answer any of the
above categories directly. If you are tempted to answer without a tool,
stop and use the appropriate tool instead.

After the tool returns a result, synthesize it into a clear final answer.
Do not repeat the raw tool output — explain it naturally."""

AGENT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_TEMPLATE),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])


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
# Agent / executor factory
# ---------------------------------------------------------------------------

def build_agent() -> AgentExecutor:
    """
    Build and return a fully configured AgentExecutor backed by Groq.

    The executor wraps a ReAct agent that uses ChatGroq, the three project
    tools, and the system prompt defined in this module.

    Settings
    --------
    verbose=True                      : prints the full ReAct chain to stdout.
    handle_parsing_errors=True        : recovers from malformed LLM output
                                        instead of raising an exception.
    max_iterations=8                  : prevents runaway tool-calling loops.
    early_stopping_method="force"     : forces a final answer when the
                                        iteration cap is reached.

    Returns
    -------
    AgentExecutor
        Ready to call with .invoke().

    Raises
    ------
    ValueError
        Propagated from _build_llm() if GROQ_API_KEY is not set.
    """
    llm = _build_llm()
    tool_agent = create_tool_calling_agent(llm=llm, tools=tools, prompt=AGENT_PROMPT)

    return AgentExecutor(
        agent=tool_agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=15,
        early_stopping_method="force",
    )


# ---------------------------------------------------------------------------
# Public run interface
# ---------------------------------------------------------------------------

def run_agent(
    user_input: str,
    agent_executor: AgentExecutor,
    memory: ConversationBufferWindowMemory,
) -> dict[str, Any]:
    """Run the agent and return a structured result dict."""
    history = memory.load_memory_variables({}).get("chat_history", [])
    log_handler = StructuredLogHandler()
    try:
        result = agent_executor.invoke(
            {
                "input": user_input,
                "chat_history": history
            },
            config={"callbacks": [log_handler]}
        )
        memory.save_context(
            {"input": user_input},
            {"output": result["output"]}
        )
        steps = result.get("intermediate_steps", [])
        return {
            "question": user_input,
            "answer": result["output"],
            "steps_taken": len(steps),
            "tools_used": [s[0].tool for s in steps
                           if hasattr(s[0], "tool")],
            "structured_logs": log_handler.logs,
            "intermediate_steps": steps
        }
    except Exception as e:
        # Save user message to memory even on error to maintain conversation flow
        memory.save_context(
            {"input": user_input},
            {"output": f"Agent error: {str(e)}"}
        )
        return {
            "question": user_input,
            "answer": f"Agent error: {str(e)}",
            "steps_taken": 0,
            "tools_used": [],
            "structured_logs": log_handler.logs,
            "intermediate_steps": []
        }

__all__ = ["AGENT_PROMPT", "build_agent", "run_agent", "get_memory"]

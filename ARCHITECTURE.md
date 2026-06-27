# System Architecture: Telemetric ReAct Engine with Hybrid Memory

This document details the architectural design, control flow, and data pipelines of the Autonomous AI Agent. The system implements a reasoning-and-acting (ReAct) paradigm, integrating an asynchronous API layer, a double-tier vector-relational memory system, and a telemetric frontend.

---

## The ReAct Reasoning Loop

The core execution model of the agent relies on the ReAct (Reasoning and Acting) framework. Instead of mapping user queries directly to final outputs, the engine interleaves reasoning steps ("Thoughts") with action execution ("Actions" and "Observations"). This iterative loop enables the agent to decompose multi-step problems, monitor progress, and adapt to intermediate execution feedback.

```
       +-----------------------+
       |      User Query       |
       +-----------+-----------+
                   |
                   v
+------------------+-------------------+
|  [LLM] Generate Thought & Action    | <------+
+------------------+-------------------+        |
                   |                            |
                   v                            | Loop (Max 15 iterations)
+------------------+-------------------+        |
|  [Tool] Execute Action / Command     |        |
+------------------+-------------------+        |
                   |                            |
                   v                            |
+------------------+-------------------+        |
|  [System] Return Observation         | -------+
+------------------+-------------------+
                   | (No tool calls remaining)
                   v
+------------------+-------------------+
|  [LLM] Output Final Response         |
+------------------+-------------------+
```

### Operational Example Trace
For the query `"what is 144 * 7"`, the agent processes the request using the following structured execution sequence:

```yaml
Thought: The user is asking for the product of 144 and 7. Since this is an arithmetic calculation, I must use the calculator_tool to resolve it instead of computing it internally.
Action: calculator_tool
Action Input: 144 * 7
Observation: Result: 1008

Thought: The calculator tool returned 1008. I have the complete answer. I will now synthesize this into the final response.
Final Answer: The product of 144 and 7 is 1008.
```

By enforcing these boundaries through system prompt constraints (e.g., forbidding direct answers for math or file operations), the agent avoids common hallucination patterns inherent to language models.

---

## Hybrid Memory System

The agent utilizes a two-tier memory architecture designed to balance semantic search capabilities with chronological exactness. Simple window buffers discard critical context as conversations grow, while complete historic contexts exhaust context windows. The hybrid system addresses this trade-off by splitting memory into two dedicated layers:

```
                  +--------------------------------+
                  |           User Input           |
                  +---------------+----------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------+-----------+                   +-----------+-----------+
|    SQLite Database    |                   |  FAISS Vector Store   |
|  - Chronological log  |                   |  - Semantic search    |
|  - Complete history   |                   |  - Relevant contexts  |
+-----------+-----------+                   +-----------+-----------+
```

### 1. Chronological relational layer (SQLite)
The relational database tracks every transaction in its exact sequence. It maintains the absolute history of user requests, assistant answers, and intermediate telemetry logs. SQLite ensures that exact sequential context is preserved for direct user-facing logs and session recoveries, protecting history against session restarts.

### 2. Semantic vector store layer (FAISS)
The vector database processes incoming queries, converts them into high-dimensional vector embeddings, and performs cosine similarity queries against historical entries. Rather than loading the entire conversation, the agent retrieves the top `k` most semantically relevant historic exchanges. This injects context-specific historical details without consuming excessive token space.

---

## Tool Execution Contract

The interface between the agentic reasoning graph and the external environment is defined by a strict execution contract. Every tool must inherit from LangChain's `BaseTool` interface or use the `@tool` decorator, providing:
1. A unique, machine-readable string name identifier.
2. A detailed docstring describing the tool's capabilities, input parameters, and constraints. The language model reads this docstring as a system prompt instruction to determine when and how to call the tool.
3. Strongly typed input validation schemas (such as Pydantic models).

```
                      +-------------------+
                      |   Agent Graph     |
                      +---------+---------+
                                |
                   (Dispatches tool execution)
                                |
                                v
                      +---------+---------+
                      |   Tool Contract   |
                      |   - name / docs   |
                      |   - input schema  |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                  |                  |
      (Success path)      (Error path)      (Uncaught exception)
             |                  |                  |
             v                  v                  v
     +-------+-------+  +-------+-------+  +-------+-------+
     | Return output |  | Handled error |  | Sandbox catch |
     |  string data  |  |  string data  |  | return string |
     +-------+-------+  +-------+-------+  +-------+-------+
```

### Error Isolation and Sandboxing
To prevent uncaught exceptions inside tools from crashing the agent's main execution loop, all tool runs are wrapped in isolation blocks:
- **Handled Errors**: Expected edge cases (e.g., file not found or division by zero) return standard, non-crashing diagnostic strings like `Error: invalid math expression`. The agent treats this string as an observation and acts accordingly (e.g., correcting the argument layout).
- **Uncaught Exceptions**: If a tool crashes unexpectedly, the decorator or graph sandbox catches the exception and returns the traceback as a text observation, preventing server-level thread termination.
- **Stopping Signal**: The loop stops and issues the final answer when the model returns a message containing no `tool_calls` attributes, indicating it has sufficient context to answer the user query.

---

## Session Management

The FastAPI backend manages user sessions using tab-isolated session identification keys:

```
+------------------+      POST /api/chat {session_id}      +------------------+
|                  | ------------------------------------> |                  |
|    React UI      |                                       |  FastAPI Server  |
|  sessionStorage  | <------------------------------------ |  In-memory Map   |
|                  |          Returns JSON response        |                  |
+------------------+                                       +------------------+
```

* **Client State Storage**: The Vite frontend generates a random UUID key on initial load and stores it inside `sessionStorage`. This isolates the session to the current tab, ensuring that opening new browser tabs initializes fresh contexts without cross-tab session contamination.
* **Server State Mapping**: The backend maps incoming session IDs to internal instances containing the compiled agent graph and conversation memory structures.
* **Storage Trade-offs**: 
  - **In-Memory Store**: Delivers sub-millisecond retrievals, making it ideal for high-speed local development and isolated deployments.
  - **Trade-off**: The state is lost if the backend server restarts. In enterprise production, this memory map should be backed by a persistent data cache like Redis.

---

## Streaming Pipeline

The communication protocol from the backend API to the UI console uses asynchronous data pipelines to maximize interface responsiveness:

```
+------------------------+                 +------------------------+
|     FastAPI Server     |                 |        React UI        |
+-----------+------------+                 +-----------+------------+
            |                                          |
            | --- [1] POST /api/chat ----------------> |
            |                                          | (Displays thinking state)
            | <--------- [2] Streaming Telemetry ------ |
            |                                          | (Renders steps live)
            | <--------- [3] Markdown JSON response -- |
            |                                          | (Renders final answer)
```

1. **Immediate Feedback**: Rather than holding connections open until execution completes, the backend returns a `200 OK` status immediately and streams telemetry traces.
2. **Telemetry Streaming**: During tool-calling cycles, the server sends real-time updates as JSON streams. This updates the left panel of the UI with active step details, preventing the interface from appearing frozen.
3. **Markdown Rendering**: Once execution completes, the final synthesized response is returned as a complete markdown payload and rendered to the main chat pane.

---

## Known Limitations and Future Work

1. **Context Window Limitations**: Long chat sessions accumulate massive message vectors. Although the memory window restricts active history to `k` frames, complex multi-step reasoning chains can still overflow small context thresholds.
2. **State Volatility**: The current server session store resides entirely in volatile RAM. A server restart clears all active memory buffers. Implementing Redis-backed state stores is planned.
3. **Tavily Rate Caps**: The web search capability depends on external Tavily API rate quotas. If keys expire or rate limits are reached, the tool fails and limits the agent to its training data.
4. **Single-User Memory Design**: Current FAISS structures operate globally per process rather than segregating namespaces by user identity, which presents potential data leaks in multi-user settings.

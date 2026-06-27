import os
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from dotenv import load_dotenv

# Load env variables before importing agent modules
load_dotenv()

from agent.agent import build_agent, run_agent  # noqa: E402
from agent.memory import get_memory, ConversationMemory  # noqa: E402

# ---------------------------------------------------------------------------
# Path for persistent history
# ---------------------------------------------------------------------------
HISTORY_FILE = "agent_history.json"

# ---------------------------------------------------------------------------
# State Management
# ---------------------------------------------------------------------------
# In-memory session store mapping session_id -> {"agent": graph, "memory": ConversationMemory}
sessions: Dict[str, Dict[str, Any]] = {}

def get_session(session_id: str) -> Dict[str, Any]:
    """Retrieve or create a new agent session."""
    if session_id not in sessions:
        try:
            # Build fresh memory and agent per session
            memory = get_memory()
            agent = build_agent()
            sessions[session_id] = {
                "agent": agent,
                "memory": memory
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
    
    return sessions[session_id]


def save_history():
    """Save all session histories to a JSON file."""
    data = {}
    for sid, session in sessions.items():
        memory: ConversationMemory = session["memory"]
        data[sid] = memory.get_history_dicts()
    
    with open(HISTORY_FILE, "w") as f:
        json.dump(data, f)

def load_history():
    """Load session histories from JSON file on startup."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                data = json.load(f)
                for sid, messages in data.items():
                    memory = get_memory()
                    memory.load_from_dicts(messages)
                    
                    sessions[sid] = {
                        "agent": build_agent(),
                        "memory": memory
                    }
        except Exception as e:
            print(f"Error loading history: {e}")

# ---------------------------------------------------------------------------
# App Initialization — startup event loads history AFTER env vars are ready
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load persisted sessions on startup, not at module import time."""
    load_history()
    yield

app = FastAPI(
    title="Autonomous AI Agent API",
    description="REST API for the LangChain-based AI Agent",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for testing. In production, restrict to your UI domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    message: str

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """Health check endpoint for frontend status dot and deployment verification."""
    return {
        "status": "ok",
        "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "tools": ["calculator", "file_reader", "web_search"],
    }


@app.get("/api/memory")
async def get_memory_endpoint(session_id: str = ""):
    """Return memory contents for the given session (episodes + facts)."""
    if not session_id or session_id not in sessions:
        return {"episodes": [], "facts": []}
    
    memory: ConversationMemory = sessions[session_id]["memory"]
    history_dicts = memory.get_history_dicts()
    
    episodes = []
    for i, msg in enumerate(history_dicts):
        episodes.append({
            "id": f"ep-{i}",
            "content": msg["content"],
            "type": msg["type"],
            "timestamp": "",  # Simple memory doesn't track timestamps
        })
    
    return {
        "episodes": episodes[-10:],  # Last 10 entries
        "facts": [],  # No structured fact extraction yet
    }


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Accepts user input, passes it through the LangChain agent, 
    and returns structured logs and the final markdown answer.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    session = get_session(request.session_id)
    agent = session["agent"]
    memory = session["memory"]
    
    try:
        # Run agent
        result = run_agent(request.message, agent, memory)
        
        # Graceful iteration limit fallback
        ans = result.get("answer", "")
        if "Agent stopped due to iteration limit or time limit." in ans or "Agent stopped due to max iterations" in ans:
            result["answer"] = "I apologize, but I reached my thinking limit on this complex task. I've stopped to prevent an infinite loop. Please try breaking your request into smaller steps!"
            result["response"] = result["answer"]
            
        # Persist after each turn
        save_history()
        
        # Include session_id in response for Phase 2 frontend compat
        result["session_id"] = request.session_id
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    """Returns the chat history for a given session."""
    if session_id not in sessions:
        return {"history": []}
        
    memory: ConversationMemory = sessions[session_id]["memory"]
    return {"history": memory.get_history_dicts()}

@app.delete("/api/clear/{session_id}")
async def clear_session(session_id: str):
    """Clears the memory for a given session."""
    if session_id in sessions:
        del sessions[session_id]
        # Remove from persistent file too
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r") as f:
                    data = json.load(f)
                if session_id in data:
                    del data[session_id]
                    with open(HISTORY_FILE, "w") as f:
                        json.dump(data, f)
            except Exception:
                pass
        return {"status": "success", "message": f"Session {session_id} cleared."}
    return {"status": "success", "message": "Session not found."}

if __name__ == "__main__":
    import uvicorn
    # Run server locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from dotenv import load_dotenv

# Load env variables before importing agent modules
load_dotenv()

from agent.agent import build_agent, run_agent
from agent.memory import get_memory

# ---------------------------------------------------------------------------
# App Initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Autonomous AI Agent API",
    description="REST API for the LangChain-based AI Agent",
    version="1.0.0"
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
# State Management
# ---------------------------------------------------------------------------
# In-memory session store mapping session_id -> {"executor": AgentExecutor, "memory": Memory}
sessions: Dict[str, Dict[str, Any]] = {}

def get_session(session_id: str) -> Dict[str, Any]:
    """Retrieve or create a new agent session."""
    if session_id not in sessions:
        try:
            # Build fresh memory and agent per session
            memory = get_memory()
            executor = build_agent()
            sessions[session_id] = {
                "executor": executor,
                "memory": memory
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
    
    return sessions[session_id]

import json

# Path for persistent history
HISTORY_FILE = "agent_history.json"

def save_history():
    """Save all session histories to a JSON file."""
    data = {}
    for sid, session in sessions.items():
        messages = session["memory"].load_memory_variables({}).get("chat_history", [])
        data[sid] = [{"type": "human" if m.type == "human" else "ai", "content": m.content} for m in messages]
    
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
                    for m in messages:
                        if m["type"] == "human":
                            memory.chat_memory.add_user_message(m["content"])
                        else:
                            memory.chat_memory.add_ai_message(m["content"])
                    
                    sessions[sid] = {
                        "executor": build_agent(),
                        "memory": memory
                    }
        except Exception as e:
            print(f"Error loading history: {e}")

# Load history when the app starts
load_history()

# ---------------------------------------------------------------------------
# API Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    message: str

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Accepts user input, passes it through the LangChain agent, 
    and returns structured logs and the final markdown answer.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    session = get_session(request.session_id)
    executor = session["executor"]
    memory = session["memory"]
    
    try:
        # Run agent
        result = run_agent(request.message, executor, memory)
        
        # Graceful iteration limit fallback
        ans = result.get("answer", "")
        if "Agent stopped due to iteration limit or time limit." in ans or "Agent stopped due to max iterations" in ans:
            result["answer"] = "I apologize, but I reached my thinking limit on this complex task. I've stopped to prevent an infinite loop. Please try breaking your request into smaller steps!"
            
        # Persist after each turn
        save_history()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    """Returns the chat history for a given session."""
    if session_id not in sessions:
        return {"history": []}
        
    memory = sessions[session_id]["memory"]
    messages = memory.load_memory_variables({}).get("chat_history", [])
    
    # Format messages for the frontend
    formatted_history = []
    for msg in messages:
        formatted_history.append({
            "type": "human" if msg.type == "human" else "ai",
            "content": msg.content
        })
        
    return {"history": formatted_history}

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
            except:
                pass
        return {"status": "success", "message": f"Session {session_id} cleared."}
    return {"status": "success", "message": "Session not found."}

if __name__ == "__main__":
    import uvicorn
    # Run server locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)

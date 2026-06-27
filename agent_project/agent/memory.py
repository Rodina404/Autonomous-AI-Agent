"""
Memory management for the Autonomous AI Agent.

This module manages the conversation context that is passed to the agent
on every turn.  It uses a simple message list with a rolling window of
the last k exchanges, preventing unbounded token growth while still
giving the agent useful short-term context.

LangChain v1.2+ removed ConversationBufferWindowMemory, so this module
provides an equivalent using plain message lists.

Public API
----------
get_memory()          → ConversationMemory
ConversationMemory    — the memory class
"""

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage


class ConversationMemory:
    """Simple sliding-window conversation memory using LangChain messages.

    Keeps the last `k` human/AI exchange pairs (2*k messages total).
    Compatible with the create_agent message-based API.
    """

    def __init__(self, k: int = 10):
        self.k = k
        self._messages: list[BaseMessage] = []

    def get_messages(self) -> list[BaseMessage]:
        """Return the current message history (windowed to last k pairs)."""
        # Each pair is 2 messages (human + ai), so keep last 2*k
        max_messages = self.k * 2
        if len(self._messages) > max_messages:
            return self._messages[-max_messages:]
        return list(self._messages)

    def add_user_message(self, content: str) -> None:
        """Add a user message to history."""
        self._messages.append(HumanMessage(content=content))

    def add_ai_message(self, content: str) -> None:
        """Add an AI response to history."""
        self._messages.append(AIMessage(content=content))

    def get_history_dicts(self) -> list[dict]:
        """Return messages as plain dicts for JSON serialization."""
        result = []
        for msg in self._messages:
            msg_type = "human" if isinstance(msg, HumanMessage) else "ai"
            result.append({"type": msg_type, "content": msg.content})
        return result

    def load_from_dicts(self, messages: list[dict]) -> None:
        """Restore memory from a list of plain dicts."""
        self._messages.clear()
        for m in messages:
            if m["type"] == "human":
                self._messages.append(HumanMessage(content=m["content"]))
            else:
                self._messages.append(AIMessage(content=m["content"]))

    def clear(self) -> None:
        """Wipe all stored messages."""
        self._messages.clear()


def get_memory(k: int = 10) -> ConversationMemory:
    """
    Create and return a fresh ConversationMemory instance.

    Parameters
    ----------
    k : int
        Number of exchange pairs to retain (default: 10).

    Returns
    -------
    ConversationMemory
        A ready-to-use memory object.  Pass it to run_agent() so the
        agent accumulates context across turns.
    """
    return ConversationMemory(k=k)


def clear_memory(memory: ConversationMemory) -> None:
    """
    Wipe all stored messages from the given memory buffer.

    Parameters
    ----------
    memory : ConversationMemory
        The memory instance to clear (mutated in place).
    """
    memory.clear()


__all__ = ["get_memory", "clear_memory", "ConversationMemory"]

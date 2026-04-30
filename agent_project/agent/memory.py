"""
Memory management for the Autonomous AI Agent.

This module manages the conversation context that is passed to the agent
on every turn.  It uses LangChain's ConversationBufferWindowMemory to
keep a rolling window of the last 10 human/AI exchanges, preventing
unbounded token growth while still giving the agent useful short-term
context.

Public API
----------
get_memory()          → ConversationBufferWindowMemory
clear_memory(memory)  → None
"""

from langchain_classic.memory import ConversationBufferWindowMemory


def get_memory() -> ConversationBufferWindowMemory:
    """
    Create and return a fresh ConversationBufferWindowMemory instance.

    Configuration
    -------------
    k=10              : retain the last 10 human/AI exchanges.
    memory_key        : 'chat_history' — must match the {chat_history}
                        variable in the agent's PromptTemplate.
    return_messages   : True — returns a list of BaseMessage objects so
                        that ChatGroq can consume them directly without
                        extra serialisation.

    Returns
    -------
    ConversationBufferWindowMemory
        A ready-to-use memory object.  Pass it to run_agent() so the
        agent accumulates context across turns.
    """
    return ConversationBufferWindowMemory(
        k=10,
        memory_key="chat_history",
        return_messages=True,
    )


def clear_memory(memory: ConversationBufferWindowMemory) -> None:
    """
    Wipe all stored messages from the given memory buffer.

    Call this when the user starts a new topic or explicitly asks to
    reset the conversation.  The same memory object can be reused
    immediately after clearing.

    Parameters
    ----------
    memory : ConversationBufferWindowMemory
        The memory instance to clear (mutated in place).
    """
    memory.clear()


__all__ = ["get_memory", "clear_memory"]

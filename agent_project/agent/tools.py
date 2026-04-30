"""
Custom tools for the Autonomous AI Agent.

This module defines three LangChain tools the agent can invoke:
  - calculator_tool  : safely evaluates math expressions via sympy
  - file_reader_tool : reads .txt / .csv files from the ./files/ directory
  - web_search_tool  : queries Tavily Search and returns the top results
"""

import csv
import os
from pathlib import Path

import sympy
from langchain.tools import tool
from tavily import TavilyClient


# ---------------------------------------------------------------------------
# TOOL 1 — calculator_tool
# ---------------------------------------------------------------------------

@tool
def calculator_tool(expression: str) -> str:
    """
    Evaluate a mathematical expression and return the numeric result.

    Use this tool whenever the user asks you to compute, calculate, or solve
    a math problem.  Supply the raw expression as a string, for example:
      - "2 + 2"
      - "sqrt(144)"
      - "15 * (3 + 7)"
      - "sin(pi / 2)"

    The tool uses SymPy for safe evaluation — never Python's eval().
    Inputs longer than 200 characters are rejected outright.
    Returns a string like "Result: 42.0" on success, or an error message.
    """
    # Guard: length limit
    if len(expression) > 200:
        return "Error: expression is too long (max 200 characters)."

    try:
        result = sympy.sympify(expression, evaluate=True)
        # Convert to float when possible for a clean numeric display
        numeric = float(result.evalf())
        # Show as int when the value is whole, otherwise keep decimals
        if numeric == int(numeric):
            return f"Result: {int(numeric)}"
        return f"Result: {numeric}"
    except sympy.SympifyError as exc:
        return f"Error: invalid math expression — {exc}"
    except Exception as exc:  # e.g. ZeroDivisionError surfaced by sympy
        return f"Error: could not evaluate expression — {exc}"


# ---------------------------------------------------------------------------
# TOOL 2 — file_reader_tool
# ---------------------------------------------------------------------------

# Resolve the ./files/ directory relative to this file at import time so the
# path is always consistent regardless of the working directory.
_FILES_DIR = Path(__file__).resolve().parent.parent / "files"


@tool
def file_reader_tool(filename: str) -> str:
    """
    Read a file from the agent's local ./files/ directory and return its contents.

    Supported formats:
      - .txt  : returns the full text content of the file.
      - .csv  : returns the first 5 rows formatted as a readable table.

    Pass only the plain filename (e.g. "sample.txt", "data.csv").
    Path traversal sequences such as ".." or "/" are not allowed and will be
    rejected immediately for security reasons.

    Returns the file contents as a string on success, or an error message.
    """
    # Security: reject path-traversal attempts
    if ".." in filename or "/" in filename or "\\" in filename:
        return "Error: invalid filename — path traversal sequences are not allowed."

    file_path = _FILES_DIR / filename

    try:
        ext = file_path.suffix.lower()

        if ext == ".txt":
            content = file_path.read_text(encoding="utf-8")
            return content if content.strip() else "(file is empty)"

        elif ext == ".csv":
            rows: list[list[str]] = []
            with file_path.open(newline="", encoding="utf-8") as fh:
                reader = csv.reader(fh)
                for i, row in enumerate(reader):
                    if i >= 5:
                        break
                    rows.append(row)

            if not rows:
                return "(CSV file is empty)"

            # Build a simple aligned table
            col_widths = [max(len(cell) for cell in col) for col in zip(*rows)]
            lines: list[str] = []
            for i, row in enumerate(rows):
                line = " | ".join(cell.ljust(col_widths[j]) for j, cell in enumerate(row))
                lines.append(line)
                if i == 0:  # separator after header row
                    lines.append("-+-".join("-" * w for w in col_widths))
            return f"First {len(rows)} row(s) of '{filename}':\n" + "\n".join(lines)

        else:
            return (
                f"Error: unsupported file type '{ext}'. "
                "Only .txt and .csv files are supported."
            )

    except FileNotFoundError:
        return f"Error: file not found — '{filename}' does not exist in ./files/."
    except PermissionError:
        return f"Error: permission denied — cannot read '{filename}'."
    except Exception as exc:
        return f"Error: could not read file — {exc}"


# ---------------------------------------------------------------------------
# TOOL 3 — web_search_tool  (powered by Tavily)
# ---------------------------------------------------------------------------

@tool
def web_search_tool(query: str) -> str:
    """
    Search the web using Tavily and return the top results.

    Use this tool when the user asks about current events, facts, definitions,
    or anything that requires up-to-date information from the internet.
    Pass the search query as a plain string, for example:
      - "latest Python 3.13 features"
      - "capital of France"
      - "how does RLHF work"

    Queries longer than 300 characters are rejected.
    Returns a formatted string with the top search results on success,
    or an error message if the search fails.

    Requires the TAVILY_API_KEY environment variable to be set.
    """
    # Guard: length limit
    if len(query) > 300:
        return "Error: query is too long (max 300 characters)."

    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return "Error: TAVILY_API_KEY is not set in the environment."

    try:
        client = TavilyClient(api_key=api_key)
        response = client.search(query=query, max_results=3)

        results = response.get("results", [])
        if not results:
            return f"No results found for: {query}"

        lines = [f"Search results for '{query}':"]
        for i, item in enumerate(results, start=1):
            title = item.get("title", "No title")
            content = item.get("content", "").strip()
            url = item.get("url", "")
            snippet = content[:300] + "..." if len(content) > 300 else content
            lines.append(f"{i}. {title}\n   {snippet}\n   Source: {url}")

        return "\n\n".join(lines)

    except Exception as exc:
        return f"Error: search failed — {exc}"


# ---------------------------------------------------------------------------
# Public export consumed by agent.py
# ---------------------------------------------------------------------------

tools = [calculator_tool, file_reader_tool, web_search_tool]

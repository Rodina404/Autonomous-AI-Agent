"""
Setup verification script.

This script verifies that all required packages are installed correctly
and that the GROQ_API_KEY / TAVILY_API_KEY environment variables are present.
"""

import os
import sys

from dotenv import load_dotenv

# Load .env so the key checks below work even without exporting the variables.
load_dotenv()


def check_imports() -> bool:
    """Verify all required packages can be imported."""
    packages = [
        "langchain",
        "langchain_community",
        "langchain_groq",
        "tavily",
        "sympy",
        "duckduckgo_search",
        "pydantic",
        "dotenv",
    ]

    missing = []
    for package in packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)

    if missing:
        print(f"Error: The following packages are missing: {', '.join(missing)}")
        return False
    return True


def check_env_vars() -> bool:
    """Verify required API keys are present in the environment."""
    ok = True

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        print("Error: GROQ_API_KEY is not set. Add it to your .env file.")
        ok = False
    else:
        print(f"GROQ_API_KEY   : found (***...{groq_key[-4:]})")

    tavily_key = os.environ.get("TAVILY_API_KEY", "")
    if not tavily_key:
        print("Error: TAVILY_API_KEY is not set. Add it to your .env file.")
        ok = False
    else:
        print(f"TAVILY_API_KEY : found (***...{tavily_key[-4:]})")

    groq_model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    print(f"GROQ_MODEL     : {groq_model}")

    return ok


if __name__ == "__main__":
    print("Checking environment setup...")

    imports_ok = check_imports()
    env_ok = check_env_vars()

    if imports_ok and env_ok:
        print("\nSetup OK — ready to run: python main.py")
        sys.exit(0)
    else:
        print("\nSetup Failed. Please check the errors above.")
        sys.exit(1)

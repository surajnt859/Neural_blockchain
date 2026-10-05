# TinyTalker GPT Mini Demo
# Lightweight chat and summarization demo model.

import json

MODEL_NAME = "TinyTalker GPT Mini"


def generate_reply(prompt: str):
    prompt_lower = (prompt or "").strip().lower()
    if "summarize" in prompt_lower:
        reply = "Summary: This is a lightweight demo model for rapid text generation and summarization."
    elif "hello" in prompt_lower or "hi" in prompt_lower:
        reply = "Hello! I am TinyTalker GPT Mini, optimized for lightweight conversational AI."
    else:
        reply = "This demo model responds with a concise and helpful output for local showcase testing."

    return {
        "model": MODEL_NAME,
        "reply": reply,
        "metadata": {"type": "text-generation", "context_window": 1024, "latency_ms": 42},
    }


if __name__ == "__main__":
    print(json.dumps(generate_reply("Summarize this project."), indent=2))

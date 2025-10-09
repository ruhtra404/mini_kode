# mini Kode Agent

This repository showcases a step-by-step recreation of a “mini Kode” workflow. With a few hundred lines of Python we rebuild the essential loops behind Anthropic’s engineering assistant and release them in two major stages:

- **v1 (baseline)** – demonstrates the core *model-as-agent* loop: the LLM is the only decision maker, the CLI just exposes tools for reading, editing, writing files, and running shell commands.
- **v2 (todos)** – layers structured planning on top of v1 with a shared todo board and system reminders so the model stays disciplined during multi-step tasks.

Below is a detailed walkthrough of how each version operates and what changed between them.

---

## v1: Minimal “Model as Agent” Loop

The first version proves a simple principle: **code supplies tools, the model drives the work**. About 400 lines of Python cover the following pillars:

### 1. System prompt guardrails
- The `SYSTEM` string reminds the model that it lives inside the repository, must act through tools, and should summarize when finished.
- This keeps multi-turn conversations action oriented instead of drifting into idle chat.

### 2. Unified tool dispatch
- The CLI exposes four tools: `bash`, `read_file`, `write_file`, and `edit_text`.
- When the model outputs a `tool_use` block, the dispatcher runs the corresponding helper and returns a `tool_result` block with truncated, colorized output.
- Safety checks gate the tools (path validation, banned commands, output clamping) to prevent runaway actions.

### 3. Terminal experience
- A background `Spinner` thread indicates model latency.
- `pretty_tool_line` and `pretty_sub_line` format every tool call in a readable, ANSI-colored layout.
- The full conversation is stored in `messages`, preserving context across tool invocations.

### 4. Main event loop
- The CLI prints the current workspace, accepts user input, and appends it to history.
- Each turn calls `client.messages.create`; if the model wants tools, the loop recursively executes them until plain text is returned.
- Errors are caught by `log_error_debug` so the session doesn’t crash.

> **Key insight:** a stable tool shell plus a focused system prompt is enough to let the model behave like a real coding agent. UI polish is optional; tool access is everything.

---

## v2: Structured Planning and System Reminders

Version 2 answers a natural question: *how do we keep the model organized over longer tasks?* The upgrade introduces a todo board, a reminder mechanism, and English-only copy to keep the workflow predictable.

### 1. Todo toolchain
- **`TodoManager`** maintains up to 20 entries, guarantees at most one `in_progress` item, and validates IDs, statuses, and descriptions.
- **`TodoWrite`** becomes a first-class tool. The model calls it to create/update/complete todos; the CLI immediately renders colored status lines plus summary stats.
- **Status colors** use a consistent palette: grey for pending, blue for in progress, green with strikethrough for completed.

### 2. System reminders
- **Initial reminder:** before the first user message, a system block instructs the model to manage multi-step work through the todo board.
- **10-turn reminder:** if ten consecutive turns pass without a todo update, another reminder block is injected to nudge the model back to structured planning.
- **Auto reset:** every todo update resets the counter so reminders only trigger when discipline lapses.

### 3. Interaction changes
- On input, user text and any pending reminders are bundled into a single content list so the model sees consistent context.
- On output, todo results are printed immediately and appended to history, giving the model a short-term memory of its own plan.
- All messages, summaries, and errors are now in English to match the neutral CLI aesthetic.

### 4. Benefits
- **Structured guardrails:** the model has to plan before acting, reducing “winging it” behavior.
- **Self-supervision:** the todo board is an external memory surface that keeps current priorities visible.
- **Auditability:** the session transcript contains every todo change, which makes reviews and debugging easier.

> **Looking for a production-ready toolkit?** Check out [Kode](https://github.com/shareAI-lab/Kode), the open-source Claude Code implementation we maintain. It adds Windows Bash support, WebSearch/WebFetch, Docker adapters, and IDE plugins on top of the ideas explored here.

---

## Summary

- **v1 philosophy:** prove the minimal model-as-agent loop—tools are thin wrappers, the LLM carries the project.
- **v2 philosophy:** enforce explicit planning via todos and system reminders so the workflow stays organized and transparent.

Future iterations will experiment with sub-agent tasks, richer reminder matrices, and will keep backporting mature features from Kode into this learning-friendly codebase. Contributions and experiments are welcome!

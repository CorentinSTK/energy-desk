# First message to paste into Claude Code (VS Code)
Paste everything between the lines into the Claude Code panel, in plan mode.

---
Hi Claude. We're starting a new project from scratch in this folder. Please:

1. Read `BUILD_SPEC.md` and `CLAUDE.md` in full. They are the source of truth for scope, data sources,
   architecture, design and how we work together.

2. Check my environment and tell me what is missing, with the exact install commands for my OS:
   `git --version`, `node --version` (need 20+), `npm --version`, `python3 --version` (need 3.11+),
   `uv --version`, and whether the GitHub CLI (`gh`) is installed and logged in.

3. Summarise the project back to me in 10 lines or fewer, then list any questions or concerns about
   the spec (gaps, risks, things you would change and why). Don't start coding yet.

4. Propose a detailed plan for **Milestone M0 only** (scaffold, design system, CI, deploy):
   - the folder structure you will create,
   - every library you will install and why (one line each),
   - the design tokens and the list of core components for `/styleguide`,
   - the CI workflow,
   - what I need to do myself (accounts, keys, Vercel/GitHub settings) and exactly when.

5. Wait for my approval before writing any code. Once approved, work in small steps, run the checks
   after each one, and show me the result in the browser before moving on.

I'll talk to you in French; keep code, comments, commits and UI text in English.

---
## Later milestones
At the start of each new session, paste:
> Read `BUILD_SPEC.md`, `CLAUDE.md` and the last entries of `docs/SESSION_LOG.md`.
> Tell me where we are, then propose the plan for the next milestone. Don't code before I approve.

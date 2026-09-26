---
title: "Obese Context"
date: 2026-10-02
tags: llm, context-engineering, agents-md, claude-md, kiro, cursor, copilot, prompt-engineering, token-economics, ai-tooling, documentation, technical-writing, agentic-ai
---

# Obese Context

Call it what it is: your context files are obese. A 1,477-line `CLAUDE.md`. A system prompt that has grown one sentence per bug fix for eighteen months and has never lost one. A design doc with nine restatements of the same constraint. They load on every single request, they cost money on every single request, and — this is the part that surprised me — **they make the model measurably worse, not just slower.**

The mechanism was assumed for years to be "irrelevant content distracts the model." That turned out to be wrong, or at least badly incomplete. In October 2025, a controlled study found that LLM performance degrades by **13.9% to 85%** as input length grows — and it still degrades when you replace the filler with whitespace, and it *still* degrades when you mask the filler out entirely so the model mathematically cannot attend to it. Length itself is the disease. Not the content.

That distinction matters for naming, so let's settle the name first.

---

## 1. Is "obese" already taken?

Honest answer: no, not in this context. Here is what *is* in use:

| Term | In use since | Means | Source |
|---|---|---|---|
| **Context rot** | Jul 2025 | Performance degrading as input grows | Chroma, 18-model study |
| **Context bloat** | 2025 | Volume crowding out relevant content | Practitioner usage |
| **Prompt bloat** | 2026 | Append-only system prompt accretion | agentpatternscatalog.org |
| **Prompt bloating** | 2025 | Tool-schema inflation, esp. MCP | arXiv 2510.14537 (JSPLIT) |
| **Lost in the middle** | 2023 | U-shaped attention; middle gets less recall | Liu et al. |
| **AI slop** | 2025 | Low-quality generated *output* | Mainstream |

"Obese" has precedent in web performance for bloated artefacts (fat bundles, heavy pages), but not for agent context files. So this is an open slot.

**Why not just say "bloat"?** Because bloat is the wrong word, and the research is why. *Bloat* implies the excess is removable fat and the remaining core is fine — delete the fat, ship the lean part, done. The October 2025 finding says otherwise: even input where every extra token is *provably, mechanically irrelevant* still degrades output. The length is the harm. There is no lean core hiding inside a fat document.

*Obese* names volume-as-condition rather than volume-as-substance, which is the actual finding. It also has a useful property: it is slightly rude, and slightly rude is what makes someone open the file and cut it.

The risk is that a body metaphor applied to a colleague's work can land badly. Use it for the artefact, not the author.

---

## 2. The evidence, briefly

| Study | What it found | Number |
|---|---|---|
| Chroma, *Context Rot* (Jul 2025) | 18 models incl. GPT-4.1, Claude 4, Gemini 2.5, Qwen3. Perf degrades non-uniformly as input grows; distractors are not equally harmful | — |
| arXiv 2510.05381 (Oct 2025) | 5 open + closed models. Perf drops **even with perfect retrieval, with whitespace filler, and with distractors fully masked** | **13.9%–85%** |
| Liu et al., *Lost in the Middle* (2023) | Attention is U-shaped; mid-context content recalled far worse | 20–40% recall loss mid-context |
| ProCut (EMNLP Industry 2025) | Segment-level pruning of production prompts | **78%** token cut in production; 73% and 84% on two real prompts |
| GSM-IC | Reasoning accuracy starts falling with irrelevant context injected | knee at **~3,000 tokens** |

Three practical consequences:

- **Input tokens are the cheap part.** Output tokens cost several times more, and verbose prompts produce verbose outputs. You pay for the obesity twice.
- **Position is free leverage.** Put the task instruction at the top. Mid-document instructions get ignored.
- **A bigger context window does not fix it.** Effective limits are widely reported at 30–50% of advertised. Target under 40% utilisation.

The fix the arXiv paper proposes is the one worth stealing: **retrieve-then-reason** — have the model recite the relevant evidence, then solve the problem from that short recitation instead of the original haystack. +4% on RULER, from three lines of prompt.

---

## 3. Four kinds of fat

| Kind | Looks like | Fix |
|---|---|---|
| **Lint leakage** | Restating what `ruff`/`eslint`/a formatter already enforces | Delete it. The tool is the source of truth, not the prose. **Most common defect: 62% of repos surveyed.** |
| **Skill leakage** | Rare, task-specific procedure dumped in the always-loaded file | Move it to an on-demand skill. **35%.** |
| **Init fossilisation** | `/init` output, never edited since | Delete and rewrite by hand. **24%.** |
| **Blind references** | `see docs/architecture.md` with no signal about when to read it | Add a one-line pitch: what is in there, when it matters. **16%.** |

Those four prevalences come from a June 2026 mining study of 100 popular repos (arXiv 2606.15828, reported via agentpatterns.ai — worth checking against the preprint before you quote it). The headline: **91 of 100 repos carried at least one.** This is the modal state, not a fringe failure.

The other two defects in that catalog are *conflicting instructions* (28% — same rule stated two contradictory ways) and *context bloat itself* (42% — past roughly 200 lines, agents stop reliably honouring content).

And the finding that should end the debate on auto-generated context files: measured on SWE-bench Lite and AGENTbench, **LLM-generated context files scored −3% task success at +20% inference cost versus no file at all.** Human-written ones were roughly break-even. A generated `AGENTS.md` is, on the available evidence, worse than nothing.

---

## 4. Where the fat lives, per tool

This is the part people get wrong: the same instruction has a different cost profile in every tool, because the tools load context differently.

| Tool | File | Scoping mechanism | Always-on? |
|---|---|---|---|
| Codex CLI | `AGENTS.md` (+ `AGENTS.override.md`) | Nested dir walk, nearest wins; reportedly capped at 32 KiB | Yes |
| Claude Code | `CLAUDE.md` | 3 layers: user, project root, subdirs | Yes |
| Cursor | `.cursor/rules/*.mdc` | `alwaysApply` flag only — no conditional globs | Mostly |
| Kiro | `.kiro/steering/*.md` | **`inclusion: always \| fileMatch \| manual \| auto`** | Depends |
| GitHub Copilot | `.github/copilot-instructions.md` | Flat file; `.github/instructions/*.instructions.md` adds path rules | Yes |
| Gemini CLI | `GEMINI.md` | Concatenates up *and* down the tree | Yes |

`AGENTS.md` is the cross-tool standard — 60k+ repos, stewarded by the Agentic AI Foundation under the Linux Foundation, read natively by Codex, Copilot, Cursor, Windsurf, Devin, Gemini CLI, Zed, Jules, and others. Put shared rules there.

**But note the tax.** Kiro's own docs are blunt about it: `AGENTS.md` "does not support inclusion modes and is always included." You get portability by giving up conditional loading. And on Kiro CLI, inclusion modes aren't supported at all — every steering file loads, every time. So the lean strategy is: `AGENTS.md` for the irreducible universal core, and the *tool-native* scoped file for everything conditional. Don't use a flat always-on file as a dumping ground just because every tool can read it.

---

## 5. The rule set your agent can load

This is the payload. Save as `AGENTS.md`. It is deliberately short, because a rule set for cutting fat cannot itself be fat.

```markdown
# AGENTS.md

## Output rules
- Write code and docs to the same standard: no restating, no summary of what you just wrote.
- No opening that restates the request. Start with the answer or the code.
- No "In this document, we will explore...". Delete the sentence.
- Hedging clauses ("it's important to note that", "as mentioned earlier") — cut.
- If a section is one sentence, it is a list item, not a heading.
- Target: shortest artifact that is still complete. If two sentences say one thing, keep one.

## Before writing any human-facing file
State the file's purpose, audience, and a hard word or line budget.
Get the budget agreed before writing, not after.

## Context hygiene
- Do not add a rule here that a linter or formatter already enforces.
- Do not put a rarely-used procedure here. Put it in a skill and reference it in one line.
- If a rule needs justification to be obeyed, it belongs in an eval, not in prose.
- Every line in this file is re-read on every request. Delete anything you cannot justify.
```

That last bullet is the whole argument in one line: **an always-loaded file pays rent on every request forever, so it needs a positive reason to exist for every line.** Adding a line is free. Deleting one feels risky. That asymmetry is the entire mechanism of the disease, and it is why the fix has to be a rule the agent follows, not a principle a human remembers.

Two techniques worth stealing from Kiro specifically, because they solve the staleness half:

- **Inclusion modes.** `fileMatch` loads guidance only when you're editing matching files. React conventions should never load during a Python debugging session.
- **Live references.** `#[[file:path]]` embeds current file content at read time, so your steering file never holds a stale copy. Reference, don't duplicate.

---

## 6. Techniques to avoid

| Don't | Do instead |
|---|---|
| Restate the linter's rules in prose | Let the linter own them; note the *command* |
| One `AGENTS.md` for the whole monorepo | Root file for invariants, per-package files for local rules |
| Copy the same rules into `CLAUDE.md` *and* `AGENTS.md` | One canonical file; a one-line `@AGENTS.md` import |
| Dump task-specific procedure in always-on context | On-demand skill, referenced in one line |
| Reference docs by bare path | One line: what's inside, when to read it |
| Add a sentence per bug fix | Prune quarterly, or the file only ever grows |
| Enumerate every edge case in the prompt | Handle the common case; let the rare case fail loudly |
| Read the whole repo into context | Retrieve the relevant slice, then reason from it |

---

## 7. This post's own budget

The rule above says state a budget before writing. So: purpose — convince a working engineer that context files are a measurable liability and give them a cuttable starting point. Audience — engineers shipping agent tooling. Budget — 2,200 words, 8 sections, 5 tables, 1 code block.

You are reading about 2,050, of which roughly 400 are references. Three sections I wrote and cut: a walkthrough of prompt-compression survey methods (LLMLingua, Gisting, xRAG, PISCO), a history of context-file formats from `.cursorrules` onward, and a section on placement heuristics that repeated what table 2 already said. All interesting, all somebody else's content, none of which changed what you'd do on Monday.

That is the whole post. Your files are too big, the size itself is the harm, and the fix is a short file with a budget and a deletion habit.

---

## 8. References

**The size-is-the-harm finding**
- **Context Length Alone Hurts LLM Performance Despite Perfect Retrieval**, arXiv 2510.05381 (Oct 2025). The masking experiment and the retrieve-then-reason mitigation. [arxiv.org](https://arxiv.org/html/2510.05381v1) · [ACL Anthology](https://aclanthology.org/anthology-files/pdf/findings/2025.findings-emnlp.1264.pdf)
- **Chroma**, *Context Rot: How Increasing Input Tokens Impacts LLM Performance* (Jul 2025). 18 models. [trychroma.com](https://www.trychroma.com/research/context-rot)
- **Liu et al.**, *Lost in the Middle: How Language Models Use Long Contexts* (2023). [arxiv.org](https://arxiv.org/abs/2307.03172)
- **ProCut: LLM Prompt Compression via Attribution Estimation*, EMNLP Industry 2025. Production token reductions. [aclanthology.org](https://aclanthology.org/2025.emnlp-industry.20.pdf)
- **JSPLIT**, arXiv 2510.14537. MCP tool-schema prompt bloating. [arxiv.org](https://arxiv.org/html/2510.14537v1)

**Context-file quality**
- **dos Santos et al.**, arXiv 2606.15828 (Jun 2026), first empirical mining study of `AGENTS.md` / `CLAUDE.md`; six-defect catalog and prevalences. Read via [agentpatterns.ai](https://agentpatterns.ai/patterns/anti-patterns/configuration-smells-agents-md/) — verify against the preprint before citing.
- **Gloaguen et al.**, arXiv 2602.11988. Benchmark evidence that generated context files can cost success rather than buy it. Same caveat on provenance.
- **Prompt Bloat**, agentpatternscatalog.org — the accretion anti-pattern and its PR-review/length-budget remedy. [agentpatternscatalog.org](https://www.agentpatternscatalog.org/patterns/prompt-bloat/)
- **Redis**, *Prompt bloat: causes, costs & fixes for LLM apps* — the identification-without-exclusion framing and the four-bloat-type taxonomy. [redis.io](https://redis.io/en/blog/prompt-bloat-llm-apps/)

**Tooling (primary sources)**
- **AGENTS.md** — the open format, 60k+ repos, AAIF/Linux Foundation stewardship, Gemini CLI config. [agents.md](https://agents.md/)
- **Kiro**, *Steering* — inclusion modes, `#[[file:]]` live references, and the note that `AGENTS.md` bypasses inclusion modes. [kiro.dev/docs/steering](https://kiro.dev/docs/steering/)
- **Cursor**, *Rules*; **GitHub**, *Customizing Copilot* (`copilot-instructions.md`, `.instructions.md`); **Gemini CLI**, `GEMINI.md`. Vendor docs for the always-on versus conditional-load distinction.

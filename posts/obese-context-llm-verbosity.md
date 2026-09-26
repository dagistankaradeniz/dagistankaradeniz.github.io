---
title: "Obese Context"
date: 2026-10-02
tags: llm, context-engineering, agents-md, claude-md, kiro, cursor, copilot, documentation, code-review, pull-requests, technical-writing, readme, token-economics, ai-tooling, agentic-ai
---

# Obese Context

There are two directions to this disease, and only one of them gets discussed.

**Direction one, input:** a 1,477-line `CLAUDE.md`. A system prompt that grew one sentence per bug fix for eighteen months and has never lost one. These load on every request, they cost money on every request, and they make the model measurably *worse*, not just slower.

**Direction two, output:** the 4,000-word design doc. The 200-line PR description. The README that opens by explaining that "this comprehensive guide provides an overview of the project." The JSDoc block restating the function signature. These are generated in seconds and read by nobody, and they are far more expensive, because the resource they consume is not tokens.

It is human attention. And human attention does not scale.

The mechanism for direction one was long assumed to be "irrelevant content distracts the model." That turned out to be wrong, or at least badly incomplete: a controlled study found LLM performance degrades by **13.9% to 85%** as input length grows, and it *still* degrades when filler is whitespace, and *still* when distractors are masked out so the model mathematically cannot attend to them. Length itself is the harm.

Direction two is worse, because it fails silently and it fails *rewarded*. We have measurements. Let me start there.

---

## 1. Is "obese" already taken?

Honestly: no, not in this context. What is in use:

| Term | Since | Means |
|---|---|---|
| **Context rot** | Jul 2025 | Performance degrading as input grows (Chroma, 18 models) |
| **Context bloat** | 2025 | Volume crowding out relevant content |
| **Prompt bloat** | 2026 | Append-only system prompt accretion |
| **Prompt bloating** | 2025 | Tool-schema inflation, esp. MCP (arXiv 2510.14537) |
| **Lost in the middle** | 2023 | U-shaped attention; mid-context recalled worse (Liu et al.) |
| **AI slop** | 2025 | Low-quality generated *output* |

"Obese" has precedent in web performance for bloated artefacts, but not for agent context or generated documentation. Open slot.

**Why not just "bloat"?** Because it is the wrong word, and the research is why. *Bloat* implies removable fat around a sound core — cut the fat, ship the lean part. But the finding above says there is no sound core to recover: even input where every extra token is *provably irrelevant* degrades output. The length is the disease, not the wrapper. *Obese* names volume-as-condition instead of volume-as-substance.

It is also slightly rude, and slightly rude is what makes someone open the file and cut it. Use it for the artefact, not the author.

---

## 2. Direction two: what the measurements say

This is the section that should change your defaults.

**AI-generated PR descriptions are hard to read.** An MSR 2026 study of AI-generated pull request descriptions measured Flesch Reading Ease across bug-fix, feature, documentation, test, dependency and refactor PRs. Mean scores ranged from **20.67 to 27.67** — text that is challenging for experienced readers, not just novices. Documentation PRs scored worst across nearly every agent. By agent, **Cursor and Codex produced the most readable output; Claude Code and Copilot the least.**

**Structure, not length, is what reviewers respond to.** A study of 33,596 agent-authored PRs found Codex — which uses headers and lists, and produces fewer code changes per PR — achieved the **highest merge rate and shortest time to completion**, while Copilot, which produced the *most* text and the *most* comments per PR, had the **lowest merge rate and the longest cycles**. More structured descriptions were associated with faster reviewer response. Length was not the lever. Shape was.

**The information the reviewer needs is the information that goes missing.** In that same study, completeness varied sharply by PR type. Dependency PRs almost entirely omitted breaking changes. Refactor PRs rarely stated whether behaviour changed. Test PRs omitted coverage. Those are precisely the three things a reviewer cannot infer from the diff.

**Generated docs overwhelm the reader.** A controlled experiment on audience-adapted code documentation recorded the most common negative theme as *information overload* (n=10 of the complaints), with participants describing "a lot of documentation that took time to go through, while you only needed very little of it." Their actual strategy was not reading — it was **scanning to the end to find the code example.** Adapted documentation measurably reduced workload for less-experienced readers, and reversed for experienced ones — an Expertise Reversal Effect that matters if you are about to standardise one doc style for everyone.

**Structure without content produces confident emptiness.** A 2026 evaluation of README generators found one tool scoring **0 out of 12** on API reference, a usage section averaging 10.4%, and output containing unresolved placeholders like `INSERT-RUN-COMMAND-HERE` — and, in one case, suggesting `npm start` as the usage instruction for jQuery. Structurally complete, semantically worthless. Correctness also collapsed for obscure repositories: **99% for popular projects, 28% for obscure ones**, because the model was falling back on what it happened to remember rather than on the artifacts in front of it.

**And the worst part: reviewers do not catch it.** A study comparing AI and human PRs found agents introduce **1.87× more semantic redundancy** (Average Max Redundancy 0.2867 vs 0.1532, p<0.001) — duplicated logic rather than reuse of what already exists. Duplicated code is a duplicate maintenance point, and inconsistent updates to duplicated code is a well-established primary source of defects. Yet in the same study, **reviewers expressed fewer negative emotions toward AI PRs than toward human ones.** More neutral, more positive. Surface plausibility masks the redundancy, so the debt accrues silently.

That is the whole failure mode in one sentence: **AI-generated documentation is rated more positively than it deserves, by the exact people who are supposed to be reading it.** It is review theatre — an artifact that consumes the reader's time while producing the appearance of rigour.

One more fact worth sitting with: developers spend roughly **70% of their time reading and understanding code**. That is the budget being spent. And an unread document is worse than no document, because it suppresses the search that would otherwise have found the answer somewhere else.

---

## 3. The arithmetic

Technical prose reads at roughly 200–250 words per minute for a practitioner scanning for what they need.

| Generated artefact | Words | Time to read properly | What actually happens |
|---|---|---|---|
| Good PR description | 120 | 30 s | Read, merged |
| Fat PR description | 900 | 4 min | Skimmed, three comments, reopened |
| Decent design note | 1,500 | 7 min | Read |
| LLM design doc | 12,000 | 50 min | Grepped, misunderstood, distrusted |
| 2023-era enterprise design doc | 40,000 | 3 hrs | Never opened once |

Generation is now free and near-instant. There is no economic brake on length. Every incentive that used to keep documents short — the effort of writing them — has been removed, and nothing replaced it.

---

## 4. Five ways a generated document fails a human

Distinct from the input-side defects, and worth naming separately:

| Failure | What it looks like | Fix |
|---|---|---|
| **The preamble** | "In this document, we will explore…" / "This comprehensive guide provides an overview of…" | Delete. Open with the answer or the first step. |
| **The uniform voice** | A one-line config change and a subtle race condition get the same paragraph length, the same register, the same three sub-bullets | **Spend words on the dangerous and irreversible; be terse on the routine.** The document's job is to tell you which parts are risky. |
| **Flat depth** | Explains at length what a loop does; hand-waves the failure mode | Invert the effort. Routine is obvious to the reader; the edge case is why they opened the file. |
| **The placeholder** | `INSERT-RUN-COMMAND-HERE`, `<your-api-key>`, `TODO` | Never emit one. If you do not know, write `TODO(owner): what to find`. |
| **The duplicate** | Same content in README, `docs/`, docstring, PR description, changelog and code comment — six copies, generated separately, drifting | Write it once, reference it. Duplication is how documents start lying. |

A sixth, structural: **wrong altitude.** Documentation serves four distinct jobs — tutorial (learning), how-to (a task), reference (lookup), explanation (why). Mixing them is the most common documentation failure there is, and mixing them is what an unprompted model does by default, because the training corpus mixes them too. The Diátaxis framework exists to keep them separate.

---

## 5. Direction one, briefly: four kinds of fat

| Kind | Looks like | Fix |
|---|---|---|
| **Lint leakage** | Restating what `ruff`/`eslint`/a formatter already enforces | Delete it; the tool is the source of truth. **62% of repos surveyed.** |
| **Skill leakage** | Rare, task-specific procedure dumped in the always-loaded file | Move to an on-demand skill. **35%.** |
| **Init fossilisation** | `/init` output, never edited since | Delete and rewrite by hand. **24%.** |
| **Blind references** | `see docs/architecture.md`, no signal about when | One line: what is in there, when it matters. **16%.** |

From a June 2026 mining study of 100 popular repos (arXiv 2606.15828): **91 of 100 carried at least one of six defects.** This is the modal state, not a fringe failure. The other two: conflicting instructions (28%) and context bloat itself (42% — past roughly 200 lines, agents stop reliably honouring content).

And the finding that should end the debate on auto-generated context files: on SWE-bench Lite and AGENTbench, **LLM-generated context files scored −3% task success at +20% inference cost versus no file at all.** Human-written ones were roughly break-even. A generated `AGENTS.md` is, on available evidence, worse than nothing.

---

## 6. Where the fat lives, per tool

The same instruction has a different cost profile in every tool, because they load context differently.

| Tool | File | Scoping | Always-on? |
|---|---|---|---|
| Codex CLI | `AGENTS.md` (+ `AGENTS.override.md`) | Nested dir walk, nearest wins; reportedly capped at 32 KiB | Yes |
| Claude Code | `CLAUDE.md` | 3 layers: user, project root, subdirs | Yes |
| Cursor | `.cursor/rules/*.mdc` | `alwaysApply` flag only — no conditional globs | Mostly |
| Kiro | `.kiro/steering/*.md` | **`inclusion: always \| fileMatch \| manual \| auto`** | Depends |
| GitHub Copilot | `.github/copilot-instructions.md` | Flat; `.github/instructions/*.instructions.md` adds path rules | Yes |
| Gemini CLI | `GEMINI.md` | Concatenates up *and* down the tree | Yes |

`AGENTS.md` is the cross-tool standard — 60k+ repos, stewarded by the Agentic AI Foundation under the Linux Foundation, read natively by Codex, Copilot, Cursor, Windsurf, Devin, Gemini CLI, Zed, Jules. Put shared rules there. Note the tax: Kiro's docs are blunt that `AGENTS.md` "does not support inclusion modes and is always included," and on Kiro CLI inclusion modes aren't supported at all. Portability costs you conditional loading — so use the tool-native scoped file for anything conditional.

---

## 7. The two rule sets

First, for context files. `AGENTS.md`. It is deliberately short, because a rule set for cutting fat cannot itself be fat.

```markdown
## Context hygiene
- Do not add a rule here that a linter or formatter already enforces.
- Do not put a rarely-used procedure here. Put it in a skill, referenced in one line.
- If a rule needs justification to be obeyed, it belongs in an eval, not in prose.
- Every line is re-read on every request. Delete anything you cannot justify.
```

Second, and the one that matters for direction two. This is the payload.

```markdown
## Human-facing documents

Before writing: name the reader, the task they are trying to finish, and a word
budget. Say it in one sentence before the first line.

Structure
- Open with the answer or the first executable step. Never open by describing
  the document.
- One heading = one idea. A section of one sentence is a list item.
- Flattened depth is the primary failure. Spend words on the dangerous,
  surprising and irreversible; be terse on the routine. The document's job is
  to tell the reader which parts are risky.
- Pick one altitude and stay in it: tutorial, how-to, reference, or explanation.
- Tables to compare, prose to reason, code for what to type.

Content
- Never restate the code in prose. Never restate what you just said.
- Cut hedges: "it's important to note", "as mentioned", "essentially", "overall".
- Never emit a placeholder. If you do not know the value, write
  `TODO(owner): what to find`.
- If a change is irreversible or breaks compatibility, say so in the first
  paragraph, not in a footnote.
- If the content will live in two places, write it once and reference it.

Before delivering
- Count words against the budget. Over budget means cut, not ship.
- Read only the first paragraph. Can a reader act on it? If not, rewrite it.
- Grep for: In this / important to / Additionally / Overall / delve / leverage /
  robust / seamless / comprehensive. Every hit is a deletion candidate.
```

That last bullet is the whole argument: **an always-loaded file pays rent on every request forever, and a generated document spends a reader's scarcest resource once. Both need a positive reason for every line.**

Two techniques worth stealing from Kiro. **Inclusion modes** — `fileMatch` loads guidance only when you are editing matching files, so React conventions never load during a Python debugging session. And **live references**: `#[[file:path]]` embeds current content at read time, so a steering file never holds a stale copy. Reference, do not duplicate.

---

## 8. Techniques to avoid

| Don't | Do instead |
|---|---|
| Restate the linter's rules in prose | Let the linter own them; note the *command* |
| One `AGENTS.md` for the whole monorepo | Root for invariants, per-package for local rules |
| Copy the same rules into `CLAUDE.md` *and* `AGENTS.md` | One canonical file, a one-line `@AGENTS.md` import |
| Dump task-specific procedure in always-on context | On-demand skill, referenced in one line |
| Reference docs by bare path | One line: what's inside, when to read it |
| Add a sentence per bug fix | Prune quarterly, or the file only grows |
| Enumerate every edge case in the prompt | Handle the common case; let the rare one fail loudly |
| Read the whole repo into context | Retrieve the slice, then reason from it |
| Generate a design doc for a two-line change | Two lines in the PR description |
| One doc style for everyone | Audience-adapt; less-experienced readers gain most |
| Let the model pick the doc structure | Impose one — structure is not a generation problem |
| Review AI output for correctness only | Review for redundancy, where the bias is |

That last row is the one teams miss. Given the measured bias, the highest-value review question for agent-authored code is not "is this correct?" — it is **"does this already exist somewhere in this repo?"**

---

## 9. This post's own budget

The rule above says state a budget before writing. Purpose — argue that fat documents are a measurable liability in both directions and hand over a cuttable starting point. Audience — engineers shipping agent tooling. Budget — 3,000 words, 10 sections, 6 tables, 2 code blocks.

You are reading 3,012, of which 356 are references and 760 are tables. Prose is 1,577. Five sections I wrote and cut: a walkthrough of prompt-compression survey methods, a history of context-file formats, a full argument about whether "obese" is the right word at all, a section on reviewer tooling that repeated the redundancy finding, and a table of every file format across every tool.

---

## 10. References

**Length is the harm (input)**
- **Context Length Alone Hurts LLM Performance Despite Perfect Retrieval**, arXiv 2510.05381 (Oct 2025). The masking experiment; retrieve-then-reason mitigation. [arxiv.org](https://arxiv.org/html/2510.05381v1) · [ACL Anthology](https://aclanthology.org/anthology-files/pdf/findings/2025.findings-emnlp.1264.pdf)
- **Chroma**, *Context Rot* (Jul 2025). 18 models. [trychroma.com](https://www.trychroma.com/research/context-rot)
- **Liu et al.**, *Lost in the Middle* (2023). [arxiv.org](https://arxiv.org/abs/2307.03172)
- **ProCut**, EMNLP Industry 2025. 78% production token reduction. [aclanthology.org](https://aclanthology.org/2025.emnlp-industry.20.pdf)
- **JSPLIT**, arXiv 2510.14537. MCP tool-schema prompt bloating. [arxiv.org](https://arxiv.org/html/2510.14537v1)

**Generated documents fail humans (output)**
- **Readability of AI-Generated Pull Request Descriptions Across PR Types**, MSR 2026. Flesch 20.67–27.67; per-agent readability; completeness gaps by PR type. [dl.acm.org](https://dl.acm.org/doi/full/10.1145/3793302.3793607)
- **How AI Coding Agents Communicate**, arXiv 2602.17084. 33,596 PRs; merge rate, review time, and structural style by agent. [arxiv.org](https://arxiv.org/html/2602.17084v1)
- **More Code, Less Reuse**, arXiv 2601.21276. AMR 0.2867 vs 0.1532; reviewers *less* negative toward AI PRs. [arxiv.org](https://arxiv.org/html/2601.21276)
- **Understanding Dominant Themes in Reviewing Agentic AI-authored Code**, arXiv 2601.19287. 19,450 comments; documentation gaps among the dominant review themes. [arxiv.org](https://arxiv.org/html/2601.19287v1)
- **Towards Individually Adapted AI-Generated Code Documentation**, Lund University thesis. Information overload as the dominant complaint; scanning-behaviour; Expertise Reversal Effect. [lnu.diva-portal.org](https://lnu.diva-portal.org/smash/get/diva2:2075612/FULLTEXT01.pdf)
- **Literature-Grounded Generation of README Files with LLMs**, SBS 2026. Placeholder-laden output; 0/12 API reference; 99% vs 28% correctness by repo popularity. [cbsoft.sbc.org.br](https://cbsoft.sbc.org.br/2026/data/papers/workshops/Literature-Grounded%20Generation%20of%20README%20Files%20with%20Large%20Language%20Models%20A%20Dual%20Human%E2%80%93LLM%20Evaluation.pdf)
- **Trust-Calibrated Code Review**, arXiv 2606.01969. JetBrains participatory design study; trust calibration as the central challenge. [arxiv.org](https://arxiv.org/abs/2606.01969)
- **LintMe**, arXiv 2603.00331. A DSL for linting README substance, not just style. [arxiv.org](https://www.arxiv.org/pdf/2603.00331)
- **Daniele Procida**, *Diátaxis* — the tutorial / how-to / reference / explanation split. [diataxis.fr](https://diataxis.fr/)

**Context-file quality**
- **dos Santos et al.**, arXiv 2606.15828 (Jun 2026). Six-defect catalog and prevalences across 100 repos. Read via [agentpatterns.ai](https://agentpatterns.ai/patterns/anti-patterns/configuration-smells-agents-md/) — verify against the preprint before citing.
- **Gloaguen et al.**, arXiv 2602.11988. Generated context files at −3% success, +20% cost. Same provenance caveat.
- **Prompt Bloat**, agentpatternscatalog.org — accretion and its length-budget remedy. [agentpatternscatalog.org](https://www.agentpatternscatalog.org/patterns/prompt-bloat/)
- **Redis**, *Prompt bloat: causes, costs & fixes for LLM apps* — identification-without-exclusion. [redis.io](https://redis.io/en/blog/prompt-bloat-llm-apps/)

**Tooling (primary)**
- **AGENTS.md** — open format, 60k+ repos, AAIF/Linux Foundation stewardship. [agents.md](https://agents.md/)
- **Kiro**, *Steering* — inclusion modes, `#[[file:]]` live references, and the note that `AGENTS.md` bypasses inclusion modes. [kiro.dev/docs/steering](https://kiro.dev/docs/steering/)
- Vendor docs for Cursor rules, GitHub Copilot instructions, and Gemini CLI `GEMINI.md`.

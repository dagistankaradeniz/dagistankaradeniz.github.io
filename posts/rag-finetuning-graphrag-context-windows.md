---
title: "RAG vs Fine-Tuning vs Graph RAG vs Context Windows: A Practical Comparison"
date: 2026-05-29
tags: llm, rag, graph-rag, fine-tuning, context-window, embeddings, vector-search, knowledge-graph, python
---

# RAG vs Fine-Tuning vs Graph RAG vs Context Windows: A Practical Comparison

When a large language model needs to answer a question outside its training distribution — a query about your internal policy document, last week's incident report, or a domain ontology it has never seen — there are four mainstream techniques to give it the missing knowledge: stuff everything into the **context window**, retrieve relevant chunks with **RAG**, traverse a knowledge graph with **Graph RAG**, or bake the knowledge into the model weights via **fine-tuning**. Each has a very different cost profile, latency footprint, accuracy envelope, and operational complexity.

This post is a side-by-side comparison: how each technique works, where each one breaks down, the cases where it is decisively the right choice, and the hybrid architectures that combine them in production. All Python examples use open-source tooling unless explicitly marked as paid.

---

## The Four Approaches in One Diagram

```
                 ┌──────────────────────────────────────────────┐
                 │              User Query                       │
                 └──────────────────────────────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬─────────────────┐
        │              │               │               │                 │
        ▼              ▼               ▼               ▼                 ▼
   ┌─────────┐   ┌──────────┐    ┌──────────┐   ┌────────────┐    ┌────────────┐
   │  Long   │   │   RAG    │    │  Graph   │   │ Fine-Tuned │    │  Hybrid    │
   │ Context │   │ (vector  │    │   RAG    │   │   Model    │    │ (combine)  │
   │ Window  │   │ search)  │    │ (KG +    │   │  (weights  │    │            │
   │         │   │          │    │  vectors)│   │   updated) │    │            │
   └─────────┘   └──────────┘    └──────────┘   └────────────┘    └────────────┘
        │              │               │               │                 │
        └──────────────┴───────────────┴───────────────┴─────────────────┘
                                       │
                                       ▼
                           ┌──────────────────────┐
                           │   Generated Answer   │
                           └──────────────────────┘
```

The four techniques are not mutually exclusive — production systems almost always combine two or more. The choice between them is driven by **data freshness**, **token economics**, **answer traceability**, and the shape of the relationships in your knowledge.

---

## 1. Context Windows: Just Put Everything in the Prompt

### How It Works

Modern frontier models accept context windows in the hundreds of thousands to millions of tokens. Gemini 1.5 Pro supports 1M (and experimentally 2M) tokens (Google DeepMind, 2024). Claude 3.5/4 family supports 200K tokens (Anthropic, 2024). GPT-4.1 supports 1M tokens (OpenAI, 2025). Open-source models like Llama 3.1 (128K), Qwen 2.5 (128K), and Jamba 1.5 (256K) brought long contexts to self-hosted deployments.

The "approach" is the simplest possible: serialise relevant documents into the prompt, send the question, get the answer.

```python
# Using an open-source long-context model via Hugging Face
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_id = "meta-llama/Llama-3.1-8B-Instruct"  # 128K context, open weights
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id, torch_dtype=torch.bfloat16, device_map="auto"
)

def ask_with_full_context(documents: list[str], question: str) -> str:
    context = "\n\n---\n\n".join(documents)
    prompt = (
        f"You are answering using ONLY the following documents.\n\n"
        f"DOCUMENTS:\n{context}\n\n"
        f"QUESTION: {question}\n\nANSWER:"
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=512, do_sample=False)
    return tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
```

### Pros

- **No infrastructure beyond the LLM.** No vector DB, no retriever, no graph construction.
- **Full context is visible to the model.** Cross-document reasoning is possible without designing a retrieval step.
- **Trivially up-to-date.** Insert today's document and the answer reflects today's data.
- **Strong on small-to-medium corpora** that genuinely fit (say, a 100-page policy manual).

### Cons

- **Cost scales linearly (or worse) with input tokens.** A 1M-token prompt to GPT-4.1 costs roughly $2 per call at $2/M input tokens (OpenAI pricing, 2025) — *paid model*. Repeated queries over the same corpus are pure waste without caching.
- **Latency scales super-linearly.** Attention is O(n²) in sequence length (vanilla); even with FlashAttention-2 / FlashAttention-3 (Dao, 2023; Shah et al., 2024) the constant is large enough that 1M-token prompts take tens of seconds.
- **"Lost in the Middle" effect.** Liu et al. (2024) demonstrated that recall of facts placed in the middle of long contexts drops substantially compared to the start or end. Longer is not strictly better.
- **Hard ceiling.** Even 2M tokens is too small for a serious enterprise corpus (millions of documents).
- **No provenance.** The model cites nothing unless instructed to.

### When to Use

- The corpus is small and stable (≤ 100K tokens), e.g., an API reference, a single contract, a research paper.
- You need cross-document reasoning that no retriever would naturally surface.
- You are prototyping and not ready to invest in retrieval infrastructure.

### Prompt Caching: The Cost Mitigation

Anthropic's prompt caching (Claude — *paid*) and Google's context caching for Gemini (*paid*) reduce repeated-prompt cost by ~90% when the same prefix is reused. This makes "large static context + small dynamic query" workloads economical. Open-source equivalents are emerging via vLLM's **prefix caching** (open source), which caches the KV-cache of repeated prefixes across requests.

```python
# vLLM example with prefix caching enabled (open source)
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_prefix_caching=True,  # KV cache shared across queries with same prefix
    max_model_len=131072,
)
params = SamplingParams(temperature=0.0, max_tokens=512)

shared_prefix = f"DOCUMENTS:\n{long_static_corpus}\n\nQUESTION:"
queries = ["What is the refund policy?", "What is the SLA for tier-2 customers?"]
for q in queries:
    out = llm.generate(shared_prefix + f" {q}\n\nANSWER:", params)
    print(out[0].outputs[0].text)
```

---

## 2. Retrieval-Augmented Generation (RAG)

### How It Works

RAG (Lewis et al., 2020, *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*) decouples knowledge storage from the model. Documents are split into chunks, embedded into a vector space, and indexed. At query time, the user question is embedded, the top-k nearest chunks are retrieved, and they — not the full corpus — are inserted into the LLM prompt.

```
[Documents] → [Chunk] → [Embed] → [Vector DB]
                                       │
                                       │  similarity search
                                       ▼
[Query] → [Embed] ────────────► [Top-k chunks] → [LLM prompt] → [Answer]
```

The standard open-source stack:

- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2`, `BAAI/bge-large-en-v1.5`, `intfloat/e5-mistral-7b-instruct` (open source, MTEB leaderboard leaders)
- **Vector DB**: FAISS, Chroma, Qdrant, Weaviate, Milvus, pgvector (all open source)
- **Orchestration**: LangChain or LlamaIndex (open source)
- **LLM**: any open or commercial model

```python
# Minimal end-to-end RAG using fully open-source components
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

embedder = SentenceTransformer("BAAI/bge-large-en-v1.5")  # 1024-dim, MIT licence

def chunk(text: str, size: int = 512, overlap: int = 64) -> list[str]:
    tokens = text.split()
    return [
        " ".join(tokens[i:i + size])
        for i in range(0, len(tokens), size - overlap)
    ]

# Index
documents = [...]                                # list[str], your corpus
chunks    = [c for d in documents for c in chunk(d)]
vectors   = embedder.encode(chunks, normalize_embeddings=True)
index     = faiss.IndexFlatIP(vectors.shape[1])  # inner product == cosine on normalised vectors
index.add(vectors.astype("float32"))

# Query
def retrieve(query: str, k: int = 5) -> list[str]:
    qv = embedder.encode([query], normalize_embeddings=True).astype("float32")
    _, idx = index.search(qv, k)
    return [chunks[i] for i in idx[0]]

def rag_answer(query: str, llm_fn) -> str:
    context = "\n\n".join(retrieve(query, k=5))
    prompt = (
        f"Answer the question using only the context.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION: {query}\n\nANSWER:"
    )
    return llm_fn(prompt)
```

### Variants Worth Knowing

| Variant | What it adds |
|---|---|
| **Hybrid search** | Combine dense vectors (semantic) with BM25 / sparse (lexical) via Reciprocal Rank Fusion (Cormack et al., 2009). Catches exact-keyword matches that embeddings miss. |
| **Reranking** | Re-score top-k with a cross-encoder (e.g., `BAAI/bge-reranker-large`, open source) — slower but far more accurate than bi-encoder similarity. |
| **HyDE** (Gao et al., 2022) | Have the LLM draft a *hypothetical* answer, embed it, and use it as the retrieval query. |
| **Multi-query / RAG-Fusion** | Generate query variants and merge retrieved results. |
| **Self-RAG** (Asai et al., 2023) | The model emits reflection tokens deciding whether/when to retrieve. |
| **CRAG** (Yan et al., 2024) | Corrective RAG — a lightweight retrieval evaluator triggers fallback to web search when confidence is low. |

### Pros

- **Scales to billions of documents.** The vector DB handles the scale; only top-k chunks enter the prompt.
- **Decoupled freshness.** Re-index a document and the next query sees it; no retraining.
- **Provenance is natural.** Retrieved chunks are concrete citations.
- **Cheap per query.** Only k chunks (typically 5–20) are in the LLM prompt, regardless of corpus size.
- **Model-agnostic.** Swap the LLM without touching the index.

### Cons

- **Embedding-similarity ≠ relevance.** Bi-encoder retrieval is approximate; topically related but unhelpful chunks frequently surface.
- **Chunking is lossy.** A fact spread across paragraphs may be split such that no single chunk contains it. Recent fixes — **late chunking** (Günther et al., 2024) and **contextual retrieval** (Anthropic, 2024) — partially address this.
- **Multi-hop questions break.** "Who supervised the PhD advisor of Yoshua Bengio?" requires two hops; pure RAG retrieves chunks about Bengio but not the chain.
- **Synthesis across many documents is weak.** RAG is shallow — top-k chunks. Summarising a 10K-document corpus is not what RAG does.
- **Embedding model drift.** Switching embedding models means re-embedding the entire corpus.

### When to Use

- Q&A over a large, semi-structured corpus: documentation, knowledge base, customer support tickets.
- Frequent updates — you cannot retrain or re-prompt the world every time a document changes.
- You need citations.
- The questions are "lookup-shaped" rather than "synthesise-shaped".

### Evaluation: RAGAS, TruLens, ARES

Evaluate RAG quantitatively with:

- **RAGAS** (Es et al., 2023, open source) — faithfulness, answer relevance, context precision/recall metrics.
- **TruLens** (open source) — feedback functions for grounding and relevance.
- **ARES** (Saad-Falcon et al., 2023, open source) — LLM-judge-based RAG evaluation.

```python
# RAGAS faithfulness + context precision evaluation (open source)
from ragas import evaluate
from ragas.metrics import faithfulness, context_precision, answer_relevancy
from datasets import Dataset

ds = Dataset.from_dict({
    "question":    [...],
    "answer":      [...],   # generated answers
    "contexts":    [...],   # retrieved chunks per question
    "ground_truth":[...],
})
results = evaluate(ds, metrics=[faithfulness, context_precision, answer_relevancy])
print(results)
```

---

## 3. Graph RAG

### How It Works

Plain RAG retrieves *chunks*. Graph RAG retrieves *entities, relationships, and the subgraphs around them*. It addresses the two well-known failure modes of vector RAG: **multi-hop reasoning** and **global / corpus-wide synthesis**.

The seminal practical work is Microsoft Research's **GraphRAG** (Edge et al., 2024 — *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*). The technique has two phases:

**Indexing phase (offline):**

1. Chunk documents.
2. Use an LLM to extract entities and relationships from each chunk into a typed knowledge graph.
3. Run a community-detection algorithm (the Leiden algorithm, Traag et al., 2019) on the graph.
4. Use an LLM to generate a hierarchical summary for each community.

**Query phase (online):**

- **Local search** — anchor on entities matching the query, traverse N hops, retrieve connected chunks and entity descriptions.
- **Global search** — map-reduce community summaries to answer corpus-wide questions ("What are the recurring themes across these 10,000 incident reports?").

```
Documents → Chunks → LLM entity/relation extraction
                              │
                              ▼
                    Knowledge Graph (nodes + edges)
                              │
                              ▼
                    Leiden community detection
                              │
                              ▼
                Hierarchical community summaries
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   LOCAL  query → entity anchor →     GLOBAL query → map over
   subgraph traversal → context        community summaries → reduce
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                            Answer
```

### Open-Source Implementations

| Project | Notes |
|---|---|
| **Microsoft GraphRAG** (`graphrag` on PyPI, MIT licence) | Reference implementation from the paper |
| **nano-graphrag** | Minimal (~1000 LOC) reimplementation; great for understanding the internals |
| **LightRAG** (Guo et al., 2024) | Dual-level retrieval (low-level entity, high-level concept); cheaper than GraphRAG |
| **LlamaIndex KnowledgeGraphIndex / PropertyGraphIndex** | Built-in graph RAG with pluggable graph stores |
| **Neo4j + LangChain** `GraphCypherQAChain` | Query a Neo4j graph by having the LLM emit Cypher |

```python
# Minimal Graph RAG with NetworkX + sentence-transformers + open-source LLM
# (Conceptually similar to nano-graphrag; trimmed for clarity)
import json
import networkx as nx
from sentence_transformers import SentenceTransformer
from transformers import pipeline

embedder = SentenceTransformer("BAAI/bge-large-en-v1.5")
llm = pipeline("text-generation", model="meta-llama/Llama-3.1-8B-Instruct")

EXTRACT_PROMPT = """Extract entities and relationships from the text as JSON:
{{"entities":[{{"name":..., "type":..., "description":...}}],
 "edges":[{{"source":..., "target":..., "relation":..., "description":...}}]}}

TEXT: {chunk}
JSON:"""

def extract_graph(chunks: list[str]) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for c in chunks:
        raw = llm(EXTRACT_PROMPT.format(chunk=c), max_new_tokens=512)[0]["generated_text"]
        data = json.loads(raw.split("JSON:")[-1].strip())   # production: be more defensive
        for e in data["entities"]:
            g.add_node(e["name"], type=e["type"], description=e["description"])
        for r in data["edges"]:
            g.add_edge(r["source"], r["target"], relation=r["relation"])
    return g

def local_search(g: nx.MultiDiGraph, query: str, hops: int = 2) -> str:
    # Embed entity descriptions; find the closest as the anchor
    nodes = list(g.nodes(data=True))
    node_texts = [f"{n}: {d.get('description','')}" for n, d in nodes]
    node_vecs  = embedder.encode(node_texts, normalize_embeddings=True)
    q_vec      = embedder.encode([query], normalize_embeddings=True)[0]
    sims       = node_vecs @ q_vec
    anchor     = nodes[int(sims.argmax())][0]

    # Collect the N-hop subgraph
    subgraph_nodes = nx.single_source_shortest_path_length(g, anchor, cutoff=hops).keys()
    sg = g.subgraph(subgraph_nodes)
    facts = [
        f"{u} --[{d['relation']}]--> {v}"
        for u, v, d in sg.edges(data=True)
    ]
    return "\n".join(facts)
```

### Pros

- **Multi-hop reasoning becomes natural.** Each edge is one hop; traversing four edges answers a four-hop question that defeats vector RAG.
- **Global synthesis works.** Community summaries enable "What are the main themes?" queries that plain RAG cannot answer.
- **Strong provenance with structure.** Answers come with the subgraph of entities and edges they relied on — auditable.
- **Disambiguation.** "Apple" the company and "Apple" the fruit can be different nodes; embeddings collapse them.

### Cons

- **Expensive to build.** Indexing requires many LLM calls — entity extraction, relation extraction, community summarisation. Microsoft's published cost figures for GraphRAG indexing are *substantially* higher than vector RAG ingestion.
- **LLM extraction is imperfect.** Hallucinated entities, missed relationships, inconsistent typing. Schema-constrained extraction (Pydantic + structured outputs, or `instructor` library — open source) helps.
- **Updating the graph is non-trivial.** Adding a document means re-extracting, merging entities (entity resolution), and potentially re-running community detection.
- **Operational complexity.** You now run a graph store (Neo4j, Memgraph, Kùzu — all open source) in addition to (or instead of) a vector index.
- **Schema design matters.** A bad ontology produces a bad graph.

### When to Use

- Domains where relationships *are* the answer: investigations, fraud, biomedical KGs, intelligence analysis, supply-chain.
- Multi-hop questions are common ("Who funded the company that acquired X in 2019?").
- Corpus-wide synthesis ("What are the recurring failure modes across these 50K incident tickets?").
- Strong auditability requirements (regulated industries).

For background on the graph data models (Property Graph vs RDF) and why index-free adjacency makes traversals fast, see the earlier post on graph databases.

---

## 4. Fine-Tuning

### How It Works

Fine-tuning updates the model's weights so that the desired knowledge or behaviour is baked into the parameters themselves. Modern fine-tuning is almost never **full fine-tuning** (updating all weights — costly and prone to catastrophic forgetting). Three lighter variants dominate:

| Method | What it does | Open source? |
|---|---|---|
| **LoRA** (Hu et al., 2021) | Insert low-rank adapter matrices `A·B` into attention layers; train only those (~0.1–1% of params) | Yes — `peft` library |
| **QLoRA** (Dettmers et al., 2023) | LoRA on top of a 4-bit NF4-quantised base model; fits 65B models on a single 48GB GPU | Yes — `bitsandbytes`, `peft` |
| **DoRA** (Liu et al., 2024) | Weight-decomposed LoRA — better quality at similar parameter budget | Yes — `peft` |
| **Full FT** | Update every weight | Yes — but expensive |
| **Instruction tuning / SFT** | Fine-tune on (prompt, response) pairs — typical use of LoRA | Yes — `trl` (SFTTrainer) |
| **DPO** (Rafailov et al., 2023) | Preference tuning without an RL loop; replaces RLHF in many pipelines | Yes — `trl` (DPOTrainer) |
| **ORPO** (Hong et al., 2024) | Combines SFT + preference optimisation in one stage | Yes — `trl` |

```python
# QLoRA fine-tuning of Llama-3.1-8B on a custom instruction dataset
# All open source: transformers, peft, bitsandbytes, trl, datasets
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
import torch

model_id = "meta-llama/Llama-3.1-8B-Instruct"

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(model_id)
model     = AutoModelForCausalLM.from_pretrained(model_id, quantization_config=bnb, device_map="auto")
model     = prepare_model_for_kbit_training(model)

lora = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    bias="none", task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora)

ds = load_dataset("json", data_files="instructions.jsonl", split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=ds,
    args=SFTConfig(
        output_dir="./out",
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        bf16=True,
        max_seq_length=4096,
    ),
)
trainer.train()
trainer.model.save_pretrained("./lora-adapter")  # only the adapter, ~50–200 MB
```

### Pros

- **Inference is fast and cheap at run time.** No retrieval step, no extra context tokens — the knowledge is in the weights.
- **Teaches *behaviour*, not just facts.** Style, format, domain vocabulary, refusal behaviour, JSON output conformance — these are properly learned, not coaxed by a prompt.
- **Better for low-latency / on-device.** A fine-tuned small model can match a much larger generic model on a narrow task — Hu et al. (2021) and the subsequent literature show LoRA-tuned small models often beat zero-shot larger models in-domain.
- **No retrieval infrastructure needed at inference.** Especially relevant for edge deployment.

### Cons

- **Stale by construction.** Yesterday's news cannot be answered until you retrain. Knowledge cutoffs are baked in.
- **Catastrophic forgetting.** Naive full FT degrades general capabilities; mitigated but not eliminated by LoRA + careful data mixing.
- **Hallucination is *not* solved.** Fine-tuning on facts the base model does not already know reliably teaches it to confidently *fabricate* — Gekhman et al. (2024) showed that SFT on new factual knowledge increases hallucinations. The takeaway: fine-tune for **style and behaviour**, use RAG for **facts**.
- **Data and compute cost.** A good SFT dataset is hard to build. A 70B QLoRA run is non-trivial. Full FT of frontier models is out of reach for most teams.
- **No provenance.** The model cannot cite where it learned a fact.
- **Hosted fine-tuning is paid.** OpenAI, Anthropic, Google fine-tuning APIs are all *paid* services. Self-hosting with `peft` + `trl` is free apart from compute.

### When to Use

- **Behaviour and format**: structured output, domain tone, refusal policy, function-calling.
- **Compressing a larger model**: distil a 70B into a fine-tuned 8B for the specific task.
- **Latency-critical inference** where adding RAG retrieval is too slow.
- **Domain language adaptation** (legal, medical, code in a specific language/framework).
- **Stable, slow-changing knowledge** — but even here, RAG is usually safer for the facts.

---

## Side-by-Side Comparison

| Dimension | Long Context | RAG | Graph RAG | Fine-Tuning |
|---|---|---|---|---|
| **Where knowledge lives** | In prompt | External vector index | External KG + vectors | Model weights |
| **Setup cost** | None | Low–medium | High (LLM-driven extraction) | High (data + compute) |
| **Per-query latency** | High (long prompt) | Low–medium | Medium | Lowest |
| **Per-query cost** | Highest (large input) | Low | Medium | Low (no retrieval) |
| **Update freshness** | Immediate | Immediate (re-index doc) | Slower (re-extract, merge) | Slow (re-train) |
| **Multi-hop reasoning** | Possible (if all hops in context) | Weak | Strong | Limited to training data |
| **Global / corpus-wide synthesis** | Limited by window | Weak | Strong (community summaries) | Only as taught |
| **Provenance / citations** | Manual | Natural | Strong, structured | None |
| **Hallucination risk** | Moderate (lost-in-middle) | Lower (grounded) | Lower (grounded + structured) | Higher if taught new facts |
| **Behaviour / style control** | Prompt only | Prompt only | Prompt only | Strong |
| **Scales to (corpus size)** | 100K–1M tokens | Billions of docs | Millions of docs (extraction cost) | Bounded by data quality |
| **Operational complexity** | Lowest | Medium | Highest | Medium–High |
| **Open-source-friendly** | Fully | Fully | Fully | Fully |

---

## Hybrid Architectures

The architectures that actually ship in production are almost always hybrids. Below are the most common combinations and the use cases that drive them.

### A. Fine-Tune for Behaviour + RAG for Facts

The default high-quality recipe. Fine-tune a base model (LoRA) to enforce **output format** (e.g., a strict JSON schema for an API), **tone** (legal, medical), and **task structure** (chain-of-thought, citation format). Use RAG at inference for the **current facts**.

Why this works: Gekhman et al. (2024) — *Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations?* — shows that fine-tuning on facts not already in the base model is a hallucination *risk*. Fine-tuning on **format and reasoning patterns** is safer; facts belong in retrieved context.

**Use cases:** customer-support agents, structured extraction pipelines, domain-specific assistants (legal, medical, finance), code assistants with house style.

### B. Graph RAG + Vector RAG

Vector RAG is excellent at "find me a chunk about X"; Graph RAG is excellent at "follow the relationships from X". Combine them: vector retrieval for breadth (finding candidate chunks), graph traversal for depth (following relationships from the anchor entities found in those chunks). LlamaIndex's `PropertyGraphIndex` and Microsoft GraphRAG both support this pattern.

**Use cases:** investigative analysis (fraud, intelligence), biomedical research, complex enterprise Q&A where relationships matter but the corpus is too large for pure graph indexing of everything.

### C. Long Context + RAG (Cache-Augmented Generation)

Some research has begun to challenge whether RAG is strictly needed when very long contexts are cheap (Chan et al., 2024 — *CAG: Cache-Augmented Generation*). The pattern: pre-load a corpus into the KV cache once (via prompt caching) and answer many queries against it. This is **paid** for hosted models (Anthropic / Google caching) and **free** with self-hosted vLLM prefix caching.

In practice, the hybrid is: RAG retrieves the relevant *sections* of the corpus (e.g., the right 200 pages out of 10,000), then those sections are placed in a cached prompt prefix and queried many times.

**Use cases:** medium-sized stable corpora (a regulation, a single project's documentation) with many queries; interactive document chat.

### D. Graph RAG + Fine-Tuning

Fine-tune the LLM to *speak the graph's ontology* — to know what entity types and relations exist, and to generate well-formed queries against the graph (e.g., Cypher or SPARQL). Then use the fine-tuned model as the orchestrator over a Graph RAG store. Neo4j's `text2cypher` line of work and several published industry KG-assistant systems follow this pattern.

**Use cases:** enterprise knowledge-graph assistants, biomedical KGs (Wikidata, UMLS), production-grade agentic systems over structured + unstructured data.

### E. Long Context as Fallback for RAG

Self-RAG (Asai et al., 2023) and CRAG (Yan et al., 2024) introduce a *retrieval confidence* signal. When the retriever is confident, use the retrieved chunks (cheap); when not, fall back to a long-context pass over a broader slice of the corpus, or trigger an external web search. The router itself can be fine-tuned for the decision.

**Use cases:** open-domain Q&A, customer-facing assistants where coverage matters more than per-query cost.

---

## A Decision Framework

```
                   ┌──────────────────────────────────────┐
                   │  Is the corpus small (<100K tokens)  │
                   │  and stable, with few queries?       │
                   └─────────────────┬────────────────────┘
                              yes    │    no
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
        Long Context (+ prompt           ┌──────────────────────────────────┐
        caching if many queries)         │ Do relationships dominate, or    │
                                         │ need multi-hop / global synthesis│
                                         └─────────────────┬────────────────┘
                                                yes        │        no
                                ┌──────────────────────────┴──────────────────────┐
                                ▼                                                 ▼
                      Graph RAG (+ vector             ┌──────────────────────────────────┐
                      RAG for breadth)                │ Do you need behaviour / format /  │
                                                      │ style control or low latency?     │
                                                      └─────────────────┬────────────────┘
                                                              yes       │        no
                                            ┌─────────────────────────-─┴─────────────-──┐
                                            ▼                                            ▼
                                  Fine-tune (LoRA/QLoRA)                              Plain RAG
                                  + RAG for facts                                     (hybrid search +
                                                                                      reranker)
```

A few practical heuristics worth internalising:

- **If you are considering fine-tuning to teach facts, prefer RAG.** Use fine-tuning for behaviour, format, and style.
- **If you are considering long context to avoid building RAG, measure the cost over a month.** Caching helps, but at-scale RAG is usually cheaper.
- **If a question requires three or more hops, plain RAG will probably fail.** Reach for Graph RAG or query decomposition.
- **Always evaluate.** RAGAS, TruLens, or ARES give you faithfulness and grounding numbers — without them, you are flying blind.

---

## Tools at a Glance

| Category | Open Source | Paid (noted) |
|---|---|---|
| **Long-context models** | Llama 3.1 (128K), Qwen 2.5 (128K), Mistral Large 2 (128K), Jamba 1.5 (256K) | Gemini 1.5/2 Pro (paid, 1M–2M), GPT-4.1 (paid, 1M), Claude (paid, 200K) |
| **Embeddings** | sentence-transformers, BGE, E5, Nomic Embed, GTE | OpenAI `text-embedding-3` (paid), Cohere Embed v3 (paid), Voyage AI (paid) |
| **Vector DBs** | FAISS, Chroma, Qdrant, Weaviate, Milvus, pgvector | Pinecone (paid) |
| **Rerankers** | BGE Reranker, Jina Reranker, MS-MARCO cross-encoders | Cohere Rerank (paid) |
| **Orchestration** | LangChain, LlamaIndex, Haystack, DSPy | — |
| **Graph stores** | Neo4j Community, Memgraph, Kùzu, Apache Jena, Apache AGE (Postgres) | Neo4j AuraDB (paid), Amazon Neptune (paid) |
| **Graph RAG impls** | Microsoft GraphRAG, nano-graphrag, LightRAG, LlamaIndex PropertyGraphIndex | — |
| **Fine-tuning** | transformers, peft, trl, unsloth, axolotl, llama-factory | OpenAI / Anthropic / Google fine-tuning APIs (paid) |
| **Quantisation / serving** | bitsandbytes, GGUF / llama.cpp, vLLM, TGI, SGLang, Ollama | — |
| **Evaluation** | RAGAS, TruLens, ARES, DeepEval, promptfoo, lm-eval-harness | LangSmith (paid), Braintrust (paid) |

---

**References**

- [Lewis, P. et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS 2020](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html)
- [Edge, D. et al. (2024). From Local to Global: A Graph RAG Approach to Query-Focused Summarization. Microsoft Research](https://arxiv.org/abs/2404.16130)
- [Hu, E. et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models. ICLR 2022](https://arxiv.org/abs/2106.09685)
- [Dettmers, T. et al. (2023). QLoRA: Efficient Finetuning of Quantized LLMs. NeurIPS 2023](https://arxiv.org/abs/2305.14314)
- [Liu, S. et al. (2024). DoRA: Weight-Decomposed Low-Rank Adaptation. ICML 2024](https://arxiv.org/abs/2402.09353)
- [Rafailov, R. et al. (2023). Direct Preference Optimization: Your Language Model is Secretly a Reward Model. NeurIPS 2023](https://arxiv.org/abs/2305.18290)
- [Hong, J. et al. (2024). ORPO: Monolithic Preference Optimization without Reference Model](https://arxiv.org/abs/2403.07691)
- [Gekhman, Z. et al. (2024). Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations? EMNLP 2024](https://arxiv.org/abs/2405.05904)
- [Liu, N. F. et al. (2024). Lost in the Middle: How Language Models Use Long Contexts. TACL](https://arxiv.org/abs/2307.03172)
- [Gao, L. et al. (2022). Precise Zero-Shot Dense Retrieval without Relevance Labels (HyDE)](https://arxiv.org/abs/2212.10496)
- [Asai, A. et al. (2023). Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection. ICLR 2024](https://arxiv.org/abs/2310.11511)
- [Yan, S.-Q. et al. (2024). Corrective Retrieval Augmented Generation (CRAG)](https://arxiv.org/abs/2401.15884)
- [Es, S. et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation. EACL 2024](https://arxiv.org/abs/2309.15217)
- [Saad-Falcon, J. et al. (2023). ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation Systems. NAACL 2024](https://arxiv.org/abs/2311.09476)
- [Günther, M. et al. (2024). Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models](https://arxiv.org/abs/2409.04701)
- [Dao, T. (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691)
- [Traag, V. A., Waltman, L., & van Eck, N. J. (2019). From Louvain to Leiden: Guaranteeing Well-Connected Communities. Scientific Reports, 9](https://www.nature.com/articles/s41598-019-41695-z)
- [Cormack, G. V., Clarke, C. L. A., & Büttcher, S. (2009). Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods. SIGIR 2009](https://dl.acm.org/doi/10.1145/1571941.1572114)
- [Microsoft GraphRAG (GitHub)](https://github.com/microsoft/graphrag)
- [nano-graphrag (GitHub)](https://github.com/gusye1234/nano-graphrag)
- [LightRAG (GitHub)](https://github.com/HKUDS/LightRAG)
- [Hugging Face PEFT library](https://huggingface.co/docs/peft)
- [Hugging Face TRL library](https://huggingface.co/docs/trl)
- [LlamaIndex Property Graph Index documentation](https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/)
- [LangChain RAG documentation](https://python.langchain.com/docs/tutorials/rag/)
- [Anthropic — Contextual Retrieval (2024)](https://www.anthropic.com/news/contextual-retrieval)

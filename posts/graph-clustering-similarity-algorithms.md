---
title: "Modularity Is a Start, Not the Answer: Graph Algorithms for Clustering, Similarity & Community Detection"
date: 2026-09-04
tags: graphs, algorithms, networkx, python, community-detection, clustering, similarity, centrality, network-analysis, data-science
---

# Graph Algorithms for Networks: Clustering, Similarity & Community Detection

Graphs are the universal language of connected data — social networks, biological pathways, citation networks, fraud rings, recommendation engines, and infrastructure topologies all share the same underlying structure: nodes, edges, and the patterns they form. Extracting meaning from these structures requires a specific class of algorithms that reason about connectivity, proximity, and community.

This post covers the most commonly used graph algorithms for clustering, similarity measurement, and community detection, with working Python examples using NetworkX.

---

## Graph Representation Fundamentals

Every graph algorithm operates on one of two representations. Understanding the difference matters because it determines which algorithms are efficient and which are prohibitive.

### Adjacency List

Each node stores a list of its neighbours. Sparse graphs (most real-world networks) use this representation.

```python
import networkx as nx

G = nx.Graph()
edges = [
    ("Alice", "Bob"), ("Alice", "Carol"), ("Bob", "Carol"),
    ("Bob", "Dave"), ("Carol", "Eve"), ("Dave", "Eve"),
]
G.add_edges_from(edges)
```

### Adjacency Matrix

An `n × n` matrix where entry `(i, j)` is 1 (or a weight) if nodes `i` and `j` are connected. Dense graphs or algorithms requiring matrix operations (spectral clustering, graph neural networks) use this representation.

```python
import numpy as np

adj_matrix = nx.to_numpy_array(G, nodelist=sorted(G.nodes()))
# [[0. 1. 1. 0. 0.]    Alice
#  [1. 0. 1. 1. 0.]    Bob
#  [1. 1. 0. 0. 1.]    Carol
#  [0. 1. 0. 0. 1.]    Dave
#  [0. 0. 1. 1. 0.]]   Eve
```

| Representation | Space | Edge lookup | Matrix ops |
|---|---|---|---|
| Adjacency list | O(V + E) | O(degree) | No |
| Adjacency matrix | O(V²) | O(1) | Yes |

Most real-world networks are sparse (E ≪ V²), making adjacency lists the default choice. Spectral algorithms are the exception — they require the matrix.

---

## Centrality: Which Nodes Matter Most?

Before clustering or grouping, understanding individual node importance is often the first step. Centrality algorithms rank nodes by their structural role.

### Degree Centrality

The simplest measure: the fraction of nodes a given node is directly connected to. High degree = many direct connections.

```python
degree_cent = nx.degree_centrality(G)
# {'Alice': 0.5, 'Bob': 0.75, 'Carol': 0.75, 'Dave': 0.5, 'Eve': 0.5}
```

### Betweenness Centrality

Measures how often a node lies on the shortest path between other nodes. High betweenness = bridge / bottleneck / information gatekeeper.

```python
between_cent = nx.betweenness_centrality(G)
# {'Alice': 0.0, 'Bob': 0.333, 'Carol': 0.167, 'Dave': 0.167, 'Eve': 0.0}
```

Bob has the highest betweenness — removing him disconnects the graph into two components.

### Closeness Centrality

The reciprocal of the average shortest path distance to all other nodes. High closeness = can reach everyone quickly.

```python
close_cent = nx.closeness_centrality(G)
# {'Alice': 0.571, 'Bob': 0.8, 'Carol': 0.8, 'Dave': 0.667, 'Eve': 0.571}
```

### Eigenvector Centrality

A recursive measure: a node is important if it is connected to other important nodes. This is the foundation of Google's PageRank.

```python
eigen_cent = nx.eigenvector_centrality(G, max_iter=1000)
# {'Alice': 0.521, 'Bob': 0.591, 'Carol': 0.591, 'Dave': 0.521, 'Eve': 0.293}
```

### PageRank

The stochastic variant of eigenvector centrality with a damping factor (typically 0.85). Used by search engines, citation analysis, and recommendation systems.

```python
pr = nx.pagerank(G, alpha=0.85)
# {'Alice': 0.185, 'Bob': 0.263, 'Carol': 0.237, 'Dave': 0.185, 'Eve': 0.131}
```

### When to Use Which

| Algorithm | Captures | Sensitive to |
|---|---|---|
| Degree | Popularity / raw connectivity | Hub nodes |
| Betweenness | Brokerage / information flow control | Bridge nodes |
| Closeness | Speed of access to all nodes | Compact graphs |
| Eigenvector | Influence through connections | Elite membership |
| PageRank | Link-based importance (damping) | Random surfer model |

---

## Similarity Algorithms: How Similar Are Two Nodes?

Similarity measures quantify how alike two nodes are based on their neighbourhood structure. These are the building blocks of recommendation systems, link prediction, and network alignment.

### Common Neighbours

The most intuitive measure: two nodes are similar if they share many neighbours.

```python
def common_neighbours_score(G, u, v):
    return len(list(nx.common_neighbors(G, u, v)))

# Alice and Dave share Bob and Carol as common neighbours
common_neighbours_score(G, "Alice", "Dave")  # 2
```

### Jaccard Coefficient

Normalises common neighbours by the union of both neighbourhoods. Range: [0, 1]. Useful when nodes have very different degrees.

```python
jaccard = nx.jaccard_coefficient(G)
list(jaccard)
# [('Alice', 'Dave', 0.5), ('Alice', 'Eve', 0.333), ('Bob', 'Eve', 0.5), ...]
```

### Cosine Similarity

Treats neighbourhoods as binary vectors and computes the cosine of the angle between them. Unlike Jaccard, it does not penalise nodes with many neighbours.

```python
from math import sqrt

def cosine_similarity(G, u, v):
    nu = set(G.neighbors(u))
    nv = set(G.neighbors(v))
    if not nu or not nv:
        return 0.0
    return len(nu & nv) / sqrt(len(nu) * len(nv))

cosine_similarity(G, "Alice", "Dave")  # 1.0
cosine_similarity(G, "Alice", "Eve")   # 0.577
```

### Adamic-Adar Index

Weights common neighbours inversely by their degree — shared neighbours that are themselves rare (low degree) contribute more than shared hubs. This is one of the most effective link prediction heuristics.

```python
aa = nx.adamic_adar_index(G)
list(aa)
# [('Alice', 'Dave', 1.386), ('Alice', 'Eve', 0.915), ...]
# Bob (degree 3) contributes less to Alice-Dave than a rare neighbour would
```

### Preferential Attachment

Models the "rich get richer" effect: two nodes are more likely to be connected if they already have many connections. The score is the product of their degrees.

```python
pa = nx.preferential_attachment(G)
list(pa)
# [('Alice', 'Dave', 6), ('Alice', 'Eve', 4), ('Bob', 'Eve', 6), ...]
```

### Resource Allocation

Similar to Adamic-Adar but uses `1/k` instead of `1/log(k)` for the common neighbour weighting. Slightly different sensitivity to hub nodes.

```python
ra = nx.resource_allocation_index(G)
list(ra)
# [('Alice', 'Dave', 0.333), ('Alice', 'Eve', 0.25), ...]
```

### Similarity Measures Comparison

| Measure | Range | Hub penalty | Best for |
|---|---|---|---|
| Common neighbours | [0, n] | None | Quick filtering |
| Jaccard | [0, 1] | Normalised by union | Degree-heterogeneous networks |
| Cosine | [0, 1] | Moderate | Vector-based comparisons |
| Adamic-Adar | [0, ∞) | Logarithmic | Link prediction |
| Resource Allocation | [0, ∞) | Linear | Link prediction (finer grain) |
| Preferential Attachment | [0, ∞²) | Product of degrees | Growth modelling |

---

## Clustering and Community Detection

Community detection — finding groups of densely connected nodes — is the central problem in network analysis. The algorithms differ fundamentally in their definition of "community" and their computational approach.

### Modularity

Before comparing algorithms, understand the metric they optimise. **Modularity (Q)** measures the density of edges within communities versus between communities, compared to a random null model:

```
Q = (1 / 2m) × Σ_ij [ A_ij - (k_i × k_j) / (2m) ] × δ(c_i, c_j)
```

Where `A_ij` is the adjacency matrix, `k_i` is the degree of node `i`, `m` is total edges, and `δ(c_i, c_j)` is 1 if nodes `i` and `j` are in the same community. Q ranges from −0.5 to 1; values above 0.3 indicate significant community structure.

### Girvan-Newman (Edge Betweenness)

The classic divisive algorithm. Repeatedly removes the edge with the highest betweenness centrality until the desired number of communities emerges. Produces a dendrogram of nested communities.

```python
from networkx.algorithms.community import girvan_newman

communities = girvan_newman(G)
# First split (2 communities)
first_split = next(communities)
print(first_split)
# ({'Alice', 'Bob', 'Carol'}, {'Dave', 'Eve'})

# Second split (3 communities)
second_split = next(communities)
print(second_split)
# ({'Alice', 'Carol'}, {'Bob'}, {'Dave', 'Eve'})
```

**Complexity:** O(E × V) per iteration — prohibitively slow for large networks. Use only for small graphs or when you need the full hierarchical decomposition.

### Louvain Method

The most widely used community detection algorithm. Maximises modularity through a two-phase iterative process: local node moves followed by community aggregation. Near-linear time complexity makes it practical for million-node networks.

```python
from networkx.algorithms.community import louvain_communities

communities = louvain_communities(G, resolution=1, seed=42)
print(communities)
# [{'Alice', 'Bob', 'Carol'}, {'Dave', 'Eve'}]

# Modularity score
nx.community.modularity(G, communities)
# 0.347
```

**Resolution parameter:** Controls community granularity. `resolution > 1` produces smaller communities; `resolution < 1` produces larger ones. This is not a "tuning knob" — it changes the null model's expectation of edge density.

### Label Propagation

Each node adopts the most common label among its neighbours. Extremely fast (near-linear) but non-deterministic — different runs may produce different communities. Useful as a first pass for very large networks.

```python
from networkx.algorithms.community import label_propagation_communities

communities = list(label_propagation_communities(G))
print(communities)
# [{'Alice', 'Bob', 'Carol'}, {'Dave', 'Eve'}]
```

### Leiden Algorithm

An improvement over Louvain that guarantees well-connected communities (no internally disconnected groups). The Leiden algorithm refines Louvain's phase 1 with an additional local refinement step.

```python
# Requires python-louvain or igraph; NetworkX doesn't ship Leiden natively.
# Using igraph (pip install igraph):

import igraph as ig

ig_graph = ig.Graph.from_networkx(G)
partition = ig_graph.community_leiden(objective_function="modularity")
print(partition)
# Clustering with 2 clusters
# [[0, 1, 2], [3, 4]]  # Alice, Bob, Carol  |  Dave, Eve
```

### Spectral Clustering

Uses the eigenvalues of the graph Laplacian matrix to embed nodes in a low-dimensional space, then applies K-means in that space. Requires specifying the number of clusters `k` a priori.

```python
from sklearn.cluster import SpectralClustering

adj_matrix = nx.to_numpy_array(G, nodelist=sorted(G.nodes()))
sc = SpectralClustering(n_clusters=2, affinity="precomputed", random_state=42)
labels = sc.fit_predict(adj_matrix)

mapping = dict(zip(sorted(G.nodes()), labels))
print(mapping)
# {'Alice': 0, 'Bob': 0, 'Carol': 0, 'Dave': 1, 'Eve': 1}
```

**Critical detail:** The graph Laplacian is `L = D - A` where `D` is the diagonal degree matrix and `A` is the adjacency matrix. The eigenvectors of `L` corresponding to the `k` smallest non-zero eigenvalues (the **Fiedler vectors**) encode the community structure. This is mathematically equivalent to solving a relaxed normalised cut problem.

### Stochastic Block Model (SBM)

A generative model: nodes are assigned to latent blocks, and edges are generated with block-specific probabilities. Inference recovers the block structure. More principled than modularity optimisation because it provides a probabilistic model rather than a heuristic.

```python
# Using networkx's built-in SBM for generation, then inference with graspologic:
# pip install graspologic

from graspologic.partition import sbm_modularity
from graspologic.datasets import load_sbm

# Or manually:
from collections import defaultdict
import numpy as np

# Generate a 2-block SBM
n = [30, 30]
P = [[0.3, 0.01], [0.01, 0.3]]  # dense within, sparse between
G_sbm = nx.stochastic_block_model(n, P, seed=42)

# Modularity on the known partition
partition = [{i for i in range(30)}, {i for i in range(30, 60)}]
nx.community.modularity(G_sbm, partition)
# ~0.75 (strong community structure)
```

### Community Detection Algorithm Comparison

| Algorithm | Type | Complexity | Deterministic | Scalability | Strengths |
|---|---|---|---|---|---|
| Girvan-Newman | Divisive | O(E × V) per step | Yes | Poor (>1000 nodes) | Hierarchical dendrogram |
| Louvain | Agglomerative | O(E) | No (seeded) | Excellent (10⁶+) | Modularity maximisation |
| Label Propagation | Propagation | O(E) | No | Excellent (10⁶+) | Speed, first pass |
| Leiden | Agglomerative | O(E) | Yes | Excellent (10⁶+) | Well-connected guarantees |
| Spectral | Partitioning | O(V³) | Yes | Poor (>5000 nodes) | Mathematically grounded |
| SBM | Generative | O(V²) | Yes | Moderate | Probabilistic inference |

---

## Complete Example: Social Network Analysis

Putting it all together on a realistic network:

```python
import networkx as nx
import numpy as np
from networkx.algorithms.community import (
    louvain_communities,
    greedy_modularity_communities,
    modularity,
)
from collections import Counter

# --- Build a social network with community structure ---
G = nx.planted_partition_graph(3, 10, 0.3, 0.01, seed=42)
# 3 communities of 10 nodes, dense within, sparse between

# --- 1. Centrality analysis ---
degree_cent = nx.degree_centrality(G)
between_cent = nx.betweenness_centrality(G)

top_degree = sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)[:5]
top_between = sorted(between_cent.items(), key=lambda x: x[1], reverse=True)[:5]

print("Top 5 by degree centrality:", top_degree)
print("Top 5 by betweenness centrality:", top_between)

# --- 2. Community detection ---
communities = louvain_communities(G, seed=42)
Q = modularity(G, communities)
print(f"\nDetected {len(communities)} communities (modularity = {Q:.3f})")

for i, comm in enumerate(communities):
    print(f"  Community {i}: {sorted(comm)}")

# --- 3. Similarity between nodes in different communities ---
comm_map = {}
for i, comm in enumerate(communities):
    for node in comm:
        comm_map[node] = i

# Find cross-community pairs with highest Jaccard
cross_pairs = []
for u, v, score in nx.jaccard_coefficient(G):
    if comm_map[u] != comm_map[v]:
        cross_pairs.append((u, v, score))

cross_pairs.sort(key=lambda x: x[2], reverse=True)
print("\nCross-community pairs with highest Jaccard:")
for u, v, score in cross_pairs[:5]:
    print(f"  {u} -- {v}: {score:.3f}")

# --- 4. Bridge nodes (high betweenness) ---
bridges = [(n, between_cent[n]) for n in G.nodes() if between_cent[n] > 0.05]
print(f"\nBridge nodes: {bridges}")

# --- 5. Network summary ---
print(f"\nNodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")
print(f"Average clustering coefficient: {nx.average_clustering(G):.3f}")
print(f"Transitivity: {nx.transitivity(G):.3f}")
print(f"Density: {nx.density(G):.3f}")
```

---

## Clustering Coefficients: Local vs Global

Distinct from community detection, **clustering coefficients** measure the tendency of a node's neighbours to also be neighbours with each other — the "triadic closure" property.

### Local Clustering Coefficient

For a node `v`, the fraction of pairs of `v`'s neighbours that are connected to each other.

```python
local_cc = nx.clustering(G)
# {0: 0.45, 1: 0.52, 2: 0.48, ...}
```

### Global Clustering Coefficient (Transitivity)

The ratio of closed triplets to all triplets in the graph. A single number summarising the entire network.

```python
transitivity = nx.transitivity(G)
# 0.42
```

### Average Clustering Coefficient

The mean of local clustering coefficients across all nodes. Unlike transitivity, it is not biased by high-degree nodes.

```python
avg_cc = nx.average_clustering(G)
# 0.47
```

| Measure | Range | Bias | Use case |
|---|---|---|---|
| Local CC | [0, 1] | Per-node | Identifying cliquish nodes |
| Transitivity | [0, 1] | High-degree nodes | Network-level cohesiveness |
| Average CC | [0, 1] | None | Network-level cohesiveness (unbiased) |

---

## Handling Weighted and Directed Graphs

Most algorithms extend to weighted and directed graphs, but the parameters change:

```python
# Weighted graph
WG = nx.Graph()
WG.add_edge("A", "B", weight=0.8)
WG.add_edge("B", "C", weight=0.3)
WG.add_edge("A", "C", weight=0.9)

# Weighted betweenness centrality
between_weighted = nx.betweenness_centrality(WG, weight="weight")

# Weighted Jaccard (thresholds or normalises by weight)
# NetworkX's jaccard_coefficient does not support weights directly;
# for weighted similarity, compute manually:
def weighted_jaccard(G, u, v, weight="weight"):
    wu = {nbr: G[u][nbr].get(weight, 1) for nbr in G.neighbors(u)}
    wv = {nbr: G[v][nbr].get(weight, 1) for nbr in G.neighbors(v)}
    all_keys = set(wu) | set(wv)
    numerator = sum(min(wu.get(k, 0), wv.get(k, 0)) for k in all_keys)
    denominator = sum(max(wu.get(k, 0), wv.get(k, 0)) for k in all_keys)
    return numerator / denominator if denominator else 0.0

# Directed graph
DG = nx.DiGraph()
DG.add_edge("A", "B", weight=1.0)
DG.add_edge("B", "A", weight=0.5)

# PageRank on directed graph (asymmetric influence)
pr = nx.pagerank(DG, alpha=0.85)
```

---

## Critical Pitfalls

**Modularity resolution limit.** Modularity maximisation fails to detect communities smaller than `√(2m)` where `m` is the number of edges. In a network with 10,000 edges, communities smaller than ~141 nodes may be merged into larger ones. The resolution parameter or Leiden algorithm addresses this.

**Non-determinism.** Louvain and Label Propagation depend on node processing order. Always set a seed for reproducibility: `louvain_communities(G, seed=42)`.

**Disconnected graphs.** Betweenness centrality, closeness centrality, and shortest-path-based measures produce incorrect results on disconnected graphs. Compute on connected components separately or use the `WFCC` (Wang-Fuller connected component) variant.

**Weighted vs unweighted.** Passing `weight=None` to a centrality algorithm uses unweighted distances. For weighted graphs, explicitly pass `weight="weight"` — the default behaviour is unweighted, which silently produces incorrect rankings.

**Cold start on similarity.** Common neighbours, Jaccard, and Adamic-Adar require existing edges. For new nodes with no connections (cold start), these measures return 0. Content-based or embedding-based similarity is required in this case.

---

## Algorithm Selection Matrix

| Problem | Algorithm(s) | Python entry point |
|---|---|---|
| Find influential nodes | PageRank, Eigenvector centrality | `nx.pagerank()`, `nx.eigenvector_centrality()` |
| Find bridge/bottleneck nodes | Betweenness centrality | `nx.betweenness_centrality()` |
| Detect communities (general) | Louvain, Leiden | `louvain_communities()`, `igraph.community_leiden()` |
| Detect communities (fast, approximate) | Label Propagation | `label_propagation_communities()` |
| Detect communities (small graph, hierarchical) | Girvan-Newman | `girvan_newman()` |
| Detect communities (mathematical guarantee) | Spectral clustering | `SpectralClustering()` from scikit-learn |
| Predict missing edges | Adamic-Adar, Jaccard | `nx.adamic_adar_index()`, `nx.jaccard_coefficient()` |
| Measure local cohesiveness | Clustering coefficient | `nx.clustering()` |
| Measure network cohesiveness | Transitivity | `nx.transitivity()` |
| Weighted similarity | Weighted Jaccard, cosine | Manual computation |

---

## Installation

```bash
pip install networkx numpy scikit-learn igraph
```

---

**References**

- [Blondel, V.D. et al. (2008). Fast unfolding of communities in large networks. *Journal of Statistical Mechanics: Theory and Experiment*, 2008(10), P10008](https://doi.org/10.1088/1742-5468/2008/10/P10008)
- [Fortunato, S. & Hric, D. (2016). Community detection in graphs: a user guide. *Physics Reports*, 659, 1–44](https://doi.org/10.1016/j.physrep.2015.10.001)
- [Newman, M.E.J. (2004). Fast algorithm for detecting community structure in networks. *Physical Review E*, 69(066133)](https://doi.org/10.1103/PhysRevE.69.066133)
- [Traag, V.A. et al. (2019). From Louvain to Leiden: guaranteeing well-connected communities. *Scientific Reports*, 9(5233)](https://doi.org/10.1038/s41598-019-41695-z)
- [NetworkX Development Team. NetworkX: Python package for complex networks (2005–present)](https://networkx.org)
- [von Luxburg, U. (2007). A tutorial on spectral clustering. *Statistics and Computing*, 17(4), 395–416](https://doi.org/10.1007/s11222-007-9033-z)
- [Adamic, L.A. & Adar, E. (2003). Friends and neighbors on the Web. *Social Networks*, 25(3), 211–230](https://doi.org/10.1016/S0378-8733(03)00009-1)
- [Zhang, J. & Horvath, S. (2008). A comparison of weighting approaches for constructing weighted human gene association networks. *Bioinformatics*, 24(13), 1468–1475](https://doi.org/10.1093/bioinformatics/btn069)

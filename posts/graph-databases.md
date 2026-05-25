---
title: "Graph Databases: When Relationships Are First-Class Citizens"
date: 2026-03-15
tags: graph-databases, neo4j, rdf, sparql, gql, nosql, architecture
---

# Graph Databases: When Relationships Are First-Class Citizens

Most data stores treat relationships as a secondary concern — a foreign key constraint, a JOIN operation, an index lookup. Graph databases invert this assumption: relationships are stored, indexed, and traversed as first-class entities. For domains where the connections between data are as important as the data itself, this architectural difference produces queries that are both simpler to express and orders of magnitude faster to execute.

This post covers the two dominant graph data models, the emerging ISO standard for graph queries, performance characteristics, and the categories of problems where graph databases decisively outperform relational and document stores.

---

## Two Graph Data Models

### Property Graph Model

The Property Graph (PG) model, used by Neo4j, Amazon Neptune, and TigerGraph, represents data as:

- **Nodes** — entities with a label (type) and a set of key-value properties
- **Edges** (relationships) — directed, typed connections between two nodes, each with its own set of key-value properties

```
(Alice:Person {age: 32})-[:FOLLOWS {since: "2024-01"}]->(Bob:Person {age: 28})
    |
    [:POSTED {timestamp: "2026-01-10"}]
    |
    v
(p1:Post {content: "Hello world", likes: 142})
    ^
    |
    [:LIKED {at: "2026-01-10T09:12:00Z"}]
    |
(Bob:Person {age: 28})
```

The critical point: the `[:FOLLOWS]` relationship is a stored record with its own identity, not a derived value from a join table. Traversing it is an O(1) pointer dereference, not a B-tree scan.

### RDF and the W3C Standards Stack

The Resource Description Framework (RDF) represents data as a set of triples: `(subject, predicate, object)`. Every resource is identified by a URI. RDF is a W3C recommendation and forms the backbone of the Semantic Web and Linked Data initiatives.

**RDF 1.1** (W3C Recommendation, 2014):
```
<http://example.org/Alice> <http://schema.org/knows> <http://example.org/Bob> .
<http://example.org/Alice> <http://schema.org/age>   "32"^^xsd:integer .
```

The W3C standards stack for RDF:

| Standard | Role |
|---|---|
| RDF 1.1 | Data model (triples) |
| RDFS (RDF Schema) | Vocabulary / schema layer |
| OWL 2 | Web Ontology Language — reasoning and inference |
| SPARQL 1.1 | Query language (W3C Recommendation, 2013) |
| JSON-LD 1.1 | JSON serialisation of RDF (W3C Recommendation, 2020) |

**SPARQL 1.1** (W3C Recommendation, 2013) is the standard query language for RDF graphs. It uses graph pattern matching — specifying the shape of a subgraph to find:

```sparql
PREFIX schema: <http://schema.org/>

SELECT ?person ?age
WHERE {
    ?person schema:knows <http://example.org/Alice> .
    ?person schema:age   ?age .
    FILTER(?age > 25)
}
```

---

## ISO GQL: The Emerging Standard

For Property Graphs, no universal query standard existed until **ISO/IEC 39075:2024 — GQL (Graph Query Language)**, published in April 2024. GQL standardises the patterns established by Cypher (Neo4j), PGQL (Oracle), and G-CORE into a single ISO standard. GQL is to graph databases what SQL is to relational databases.

A GQL match query:

```gql
MATCH (p:Person)-[:FOLLOWS]->(q:Person)
WHERE p.name = 'Alice'
RETURN q.name, q.age
ORDER BY q.age DESC
```

Neo4j's **Cypher** language (which heavily influenced GQL) uses the same syntax. The patterns are expressed as ASCII art — `(node)-[edge]->(node)` — which mirrors how developers naturally draw graph diagrams.

---

## The Join Problem in Relational Databases

To illustrate where graph databases excel, consider a social network stored relationally:

```sql
CREATE TABLE users      (id INT PRIMARY KEY, name VARCHAR);
CREATE TABLE follows    (follower_id INT, followee_id INT);  -- adjacency list
CREATE TABLE posts      (id INT, user_id INT, content TEXT);
CREATE TABLE likes      (user_id INT, post_id INT);
```

**Query: Find all posts liked by someone who follows Alice.**

```sql
SELECT DISTINCT p.content
FROM   users u1
JOIN   follows f  ON u1.id = f.followee_id
JOIN   likes   l  ON f.follower_id = l.user_id
JOIN   posts   p  ON l.post_id = p.id
WHERE  u1.name = 'Alice';
```

**Same query in Cypher:**

```cypher
MATCH (alice:Person {name: 'Alice'})<-[:FOLLOWS]-(follower)-[:LIKED]->(post:Post)
RETURN DISTINCT post.content
```

The relational query requires three JOINs. Each JOIN is a B-tree scan against the index on the foreign key column — O(log n) per row. For a six-hop query (common in recommendation engines), the relational query compounds six logarithmic lookups per row, while the graph traversal takes six O(1) pointer dereferences.

---

## Visualising the Difference

**Relational model — three separate tables:**

```
users              follows              posts
+----+-------+    +------+----------+  +----+------+---------+
| id | name  |    | foll | followee |  | id | user | content |
+----+-------+    +------+----------+  +----+------+---------+
|  1 | Alice |    |  2   |    1     |  | 10 |  2   | "Hi"    |
|  2 | Bob   |    |  3   |    1     |  | 11 |  3   | "Hey"   |
|  3 | Carol |    +------+----------+  +----+------+---------+
+----+-------+
                  likes
                  +------+---------+
                  | user | post_id |
                  +------+---------+
                  |  2   |   11    |
                  +------+---------+
```

**Property Graph — same data:**

```
(Alice:Person)
       ^
       |[:FOLLOWS]
       |
(Bob:Person)--[:POSTED]-->(Post{content:"Hi"})
       
(Carol:Person)--[:FOLLOWS]-->(Alice:Person)
(Carol:Person)--[:POSTED]-->(Post{content:"Hey"})
(Bob:Person)--[:LIKED]-->(Post{content:"Hey"})
```

The graph makes the pattern "Alice's followers' liked posts" visually and structurally obvious. The traversal matches the shape of the query, not a decomposed join plan.

---

## Performance: Index-Free Adjacency

The defining performance characteristic of native graph databases is **index-free adjacency**: each node directly stores physical pointers to its adjacent edges. Traversing one hop is a memory dereference — O(1) — regardless of the total graph size.

| Operation | Relational DB | Native Graph DB |
|---|---|---|
| Lookup by ID | O(log n) — B-tree | O(1) — direct pointer |
| 1-hop traversal | O(log n) — FK index scan | O(1) — pointer dereference |
| k-hop traversal | O(k × log n) — k joins | O(k) — k pointer dereferences |
| Shortest path | Expensive, manual BFS via joins | Native APOC / GDS algorithms |

For a graph with 1 billion nodes, a 6-hop traversal in a native graph database accesses roughly 6 memory locations. The equivalent query in a relational database compounds 6 B-tree scans, each touching log₂(1,000,000,000) ≈ 30 index levels.

---

## Comparison with Other Database Types

| Database type | Strength | Weakness | Best for |
|---|---|---|---|
| Relational (PostgreSQL, MySQL) | ACID, mature tooling, complex aggregations | JOIN overhead for connected data, schema rigidity | Transactions, reporting, structured tabular data |
| Document (MongoDB, Firestore) | Flexible schema, nested documents | Weak cross-document relationships | Content management, catalogues, user profiles |
| Key-value (Redis, DynamoDB) | O(1) point lookups, extreme throughput | No query language, no relationship traversal | Caching, sessions, leaderboards |
| Column-family (Cassandra, HBase) | Write throughput, time-series | No joins, denormalised data model | IoT telemetry, append-heavy workloads |
| Graph (Neo4j, Neptune) | Relationship traversal, pattern matching | Aggregations over all nodes, global analytics | Social networks, fraud detection, recommendations |

Graph databases are not universally superior. They perform poorly on global aggregations ("count all posts") because there is no columnar index to scan. The correct pattern is to use a graph database for relationship-heavy queries and a separate analytical store (a data warehouse or column-family DB) for aggregations.

---

## Use Cases

### Fraud Detection

A transaction graph connects accounts, devices, IP addresses, and merchants. A fraudulent ring often shares device fingerprints or IP addresses across seemingly unrelated accounts — a pattern invisible in per-row relational queries but immediately apparent as a connected subgraph.

```cypher
MATCH (a:Account)-[:TRANSACTED_FROM]->(d:Device)<-[:TRANSACTED_FROM]-(b:Account)
WHERE a <> b
  AND a.risk_score < 0.3  -- low-risk by individual metrics
  AND b.risk_score < 0.3
RETURN a.id, b.id, d.fingerprint
```

This "guilt by association" pattern — finding accounts that share devices with high-risk accounts — requires no suspicious individual transaction and cannot be expressed in a single SQL query without recursive CTEs.

### Knowledge Graphs

Google's Knowledge Graph, Wikidata, and enterprise knowledge bases are RDF graphs that power entity disambiguation, question answering, and search enrichment. SPARQL enables federated queries across distributed RDF stores.

### Recommendation Engines

Collaborative filtering — "users who liked X also liked Y" — is a natural graph traversal:

```cypher
MATCH (u:User {id: $userId})-[:LIKED]->(item:Item)<-[:LIKED]-(similar:User)
                             -[:LIKED]->(rec:Item)
WHERE NOT (u)-[:LIKED]->(rec)
RETURN rec.title, COUNT(similar) AS score
ORDER BY score DESC
LIMIT 10
```

---

## Choosing a Graph Database

| Product | Model | Strengths |
|---|---|---|
| Neo4j | Property Graph | Mature, Cypher, rich GDS library (algorithms) |
| Amazon Neptune | PG + RDF | Fully managed, supports both Cypher and SPARQL |
| ArangoDB | PG + document + key-value | Multi-model; one engine for multiple access patterns |
| TigerGraph | Property Graph | Distributed, high-throughput, pattern-based analytics |
| Apache Jena | RDF | Full W3C stack; embedded or server mode |
| Weaviate | Vector + graph | AI-native; combines graph traversal with vector search |

---

**References**

- [W3C RDF 1.1 Concepts and Abstract Syntax (W3C Recommendation, 2014)](https://www.w3.org/TR/rdf11-concepts/)
- [W3C SPARQL 1.1 Query Language (W3C Recommendation, 2013)](https://www.w3.org/TR/sparql11-query/)
- [W3C JSON-LD 1.1 (W3C Recommendation, 2020)](https://www.w3.org/TR/json-ld11/)
- [ISO/IEC 39075:2024 — Information technology — Database languages — GQL](https://www.iso.org/standard/76120.html)
- [Angles, R. et al. (2017). Foundations of Modern Query Languages for Graph Databases. ACM Computing Surveys, 50(5)](https://dl.acm.org/doi/10.1145/3104031)
- [Robinson, I., Webber, J., & Eifrem, E. (2015). Graph Databases, 2nd Edition. O'Reilly Media](https://graphdatabases.com/)
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Amazon Neptune Documentation](https://docs.aws.amazon.com/neptune/latest/userguide/intro.html)

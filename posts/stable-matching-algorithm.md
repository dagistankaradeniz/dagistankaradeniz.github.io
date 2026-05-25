---
title: "The Stable Matching Algorithm: From Theory to the NRMP"
date: 2026-02-21
tags: algorithms, game-theory, matching, combinatorics, java, python
---

# The Stable Matching Algorithm: From Theory to the NRMP

Every year, roughly 40,000 medical students and residency programmes in the United States are matched by an algorithm that was first described in a mathematics journal in 1962. The same algorithm underpins university admissions systems, public school assignment, kidney exchange networks, and job recruiting platforms. Understanding it reveals a beautiful intersection of combinatorics, game theory, and mechanism design.

---

## The Stable Matching Problem

**Definition (Gale & Shapley, 1962).** Given two disjoint sets `M` (men) and `W` (women), each of size `n`, where every element of `M` has a strict total preference ordering over `W` and every element of `W` has a strict total preference ordering over `M`, a **matching** is a bijection `μ: M → W`. A matching `μ` is **unstable** if there exist `m ∈ M` and `w ∈ W` such that:

1. `m` and `w` are not matched to each other: `μ(m) ≠ w`
2. `m` prefers `w` over `μ(m)`
3. `w` prefers `m` over `μ⁻¹(w)`

Such a pair `(m, w)` is called a **blocking pair**. A matching is **stable** if it has no blocking pairs.

The terms "men" and "women" are historical artifacts from the original paper; the algorithm applies to any two-sided matching market with a proposing side and a receiving side.

---

## Gale-Shapley Algorithm (Deferred Acceptance)

The algorithm is sometimes called **Deferred Acceptance (DA)** because receiving-side participants tentatively accept proposals rather than committing immediately. Gale and Shapley proved that a stable matching always exists and their algorithm always finds one.

### Algorithm

```
Initialise all participants as free.

While any man m is free and has not proposed to every woman:
    w = m's most preferred woman he has not yet proposed to
    If w is free:
        Tentatively engage (m, w)
    Else if w prefers m over her current partner m':
        Tentatively engage (m, w)
        Free m'  (m' becomes free again)
    Else:
        w rejects m  (m remains free)

Return the engagement pairs as the stable matching.
```

### Worked Example

Men's preferences (most preferred first):

| Man | Preference list |
|---|---|
| Adam | Beth, Carol, Dana |
| Ben | Carol, Beth, Dana |
| Carl | Beth, Dana, Carol |

Women's preferences:

| Woman | Preference list |
|---|---|
| Beth | Ben, Adam, Carl |
| Carol | Adam, Ben, Carl |
| Dana | Adam, Ben, Carl |

Round 1 — all men propose to first choice:
- Adam → Beth (Beth: free → tentatively accepts)
- Ben → Carol (Carol: free → tentatively accepts)
- Carl → Beth (Beth: has Adam. Beth prefers Adam over Carl → rejects Carl)

Round 2 — Carl is free, proposes to next choice (Dana):
- Carl → Dana (Dana: free → tentatively accepts)

All men are engaged. Final matching: Adam–Beth, Ben–Carol, Carl–Dana.

Verify stability: is there any blocking pair? Adam prefers Beth (matched); Ben prefers Carol over Beth (matched); Carl prefers Beth over Dana, and Beth prefers Adam over Carl — no blocking pair from Carl. Stable.

---

## Complexity

| Operation | Complexity |
|---|---|
| Time | O(n²) — each man proposes at most n times |
| Space | O(n²) — to store all preference lists |
| Proposals | At most n² total |

The O(1) rank lookup per woman-preference comparison requires pre-processing preferences into rank arrays, bringing total time to O(n²) with O(n²) space.

---

## Java Implementation

```java
import java.util.*;

public final class GaleShapley {

    public static Map<String, String> match(
            Map<String, List<String>> manPrefs,
            Map<String, List<String>> womanPrefs) {

        // Pre-build rank lookup: womanRank[w][m] = rank of m in w's list
        Map<String, Map<String, Integer>> womanRank = new HashMap<>();
        for (Map.Entry<String, List<String>> e : womanPrefs.entrySet()) {
            Map<String, Integer> ranks = new HashMap<>();
            List<String> prefs = e.getValue();
            for (int i = 0; i < prefs.size(); i++) ranks.put(prefs.get(i), i);
            womanRank.put(e.getKey(), ranks);
        }

        Queue<String> freeMen = new LinkedList<>(manPrefs.keySet());
        Map<String, Integer> nextProposal = new HashMap<>();
        for (String m : manPrefs.keySet()) nextProposal.put(m, 0);

        Map<String, String> womanPartner = new HashMap<>(); // w -> current partner

        while (!freeMen.isEmpty()) {
            String m = freeMen.poll();
            int idx = nextProposal.get(m);
            String w = manPrefs.get(m).get(idx);
            nextProposal.put(m, idx + 1);

            if (!womanPartner.containsKey(w)) {
                womanPartner.put(w, m);
            } else {
                String current = womanPartner.get(w);
                if (womanRank.get(w).get(m) < womanRank.get(w).get(current)) {
                    womanPartner.put(w, m);
                    freeMen.add(current); // current partner is displaced
                } else {
                    freeMen.add(m);       // w prefers current partner; m remains free
                }
            }
        }

        // Invert: man -> woman
        Map<String, String> result = new HashMap<>();
        for (Map.Entry<String, String> e : womanPartner.entrySet()) {
            result.put(e.getValue(), e.getKey());
        }
        return result;
    }
}
```

### Usage

```java
Map<String, List<String>> manPrefs = new LinkedHashMap<>();
manPrefs.put("Adam", Arrays.asList("Beth", "Carol", "Dana"));
manPrefs.put("Ben",  Arrays.asList("Carol", "Beth", "Dana"));
manPrefs.put("Carl", Arrays.asList("Beth", "Dana", "Carol"));

Map<String, List<String>> womanPrefs = new LinkedHashMap<>();
womanPrefs.put("Beth",  Arrays.asList("Ben", "Adam", "Carl"));
womanPrefs.put("Carol", Arrays.asList("Adam", "Ben", "Carl"));
womanPrefs.put("Dana",  Arrays.asList("Adam", "Ben", "Carl"));

Map<String, String> matching = GaleShapley.match(manPrefs, womanPrefs);
// {Adam=Beth, Ben=Carol, Carl=Dana}
```

---

## Python Implementation

```python
def gale_shapley(man_prefs: dict, woman_prefs: dict) -> dict:
    """
    Returns a stable matching as {man: woman}.
    man_prefs:   {man: [woman, ...]}  — most preferred first
    woman_prefs: {woman: [man, ...]}  — most preferred first
    """
    # Pre-build rank lookup for O(1) comparisons
    woman_rank = {
        w: {m: rank for rank, m in enumerate(prefs)}
        for w, prefs in woman_prefs.items()
    }

    free_men = list(man_prefs.keys())
    next_proposal = {m: 0 for m in man_prefs}
    woman_partner: dict = {}  # w -> current partner

    while free_men:
        m = free_men.pop(0)
        w = man_prefs[m][next_proposal[m]]
        next_proposal[m] += 1

        if w not in woman_partner:
            woman_partner[w] = m
        elif woman_rank[w][m] < woman_rank[w][woman_partner[w]]:
            free_men.append(woman_partner[w])
            woman_partner[w] = m
        else:
            free_men.append(m)

    return {m: w for w, m in woman_partner.items()}
```

---

## Optimality: Proposer-Optimal, Receiver-Pessimal

A critical theoretical result (Gale & Shapley, 1962): when men propose, the algorithm produces the **man-optimal stable matching** — every man receives the best partner he can receive in any stable matching. The flip side: every woman receives the worst partner she can receive in any stable matching. This asymmetry has significant implications for real-world deployment.

**Theorem (Gale-Shapley optimality).** Let `μ` be the matching produced by the DA algorithm with men as proposers. For any stable matching `μ'`, every man weakly prefers `μ` to `μ'`:
`μ(m) ≥_{m} μ'(m)` for all `m ∈ M`.

This means which side proposes is not a neutral design decision — it transfers welfare between the two sides of the market.

---

## Strategyproofness

The Gale-Shapley algorithm is **strategyproof for proposers**: no man can improve his outcome by misreporting preferences. However, it is **not strategyproof for receivers**: a woman can sometimes improve her outcome by strategically misrepresenting her preferences (Roth, 1982). This is a design consideration when deploying DA in systems where participants can manipulate their reported preferences.

---

## Real-World Use Cases

### NRMP — Medical Residency Matching

The National Resident Matching Program has run a variant of DA since 1952, predating Gale-Shapley by a decade. The original algorithm was hospital-optimal; Roth (1984) demonstrated that the NRMP was equivalent to the DA algorithm and argued that switching to the resident-optimal variant would benefit residents. The NRMP adopted the change in 1998.

The NRMP processes approximately 40,000 applicants and 30,000 positions annually. The matching runs in seconds — the computational cost of O(n²) is trivial at this scale; the design and policy questions dominate.

### College Admissions (Many-to-One)

The classic formulation is one-to-one, but real markets are often many-to-one: each hospital has a **quota** of residents it can accept. Gale and Shapley's original 1962 paper defined the **College Admissions Problem** and proved that the same deferred acceptance algorithm applies, treating each college as `q` copies of the same agent.

```python
def college_admissions_gale_shapley(
        student_prefs: dict,
        college_prefs: dict,
        quotas: dict) -> dict:
    """
    student_prefs: {student: [college, ...]}
    college_prefs: {college: [student, ...]}
    quotas:        {college: capacity}
    Returns {student: college}.
    """
    college_rank = {
        c: {s: rank for rank, s in enumerate(prefs)}
        for c, prefs in college_prefs.items()
    }

    free_students = list(student_prefs.keys())
    next_proposal = {s: 0 for s in student_prefs}
    # Each college maintains a sorted list of its current admits
    college_admits: dict = {c: [] for c in college_prefs}

    while free_students:
        s = free_students.pop(0)
        if next_proposal[s] >= len(student_prefs[s]):
            continue  # student exhausted all choices; remains unmatched
        c = student_prefs[s][next_proposal[s]]
        next_proposal[s] += 1
        admits = college_admits[c]

        admits.append(s)
        # Sort by college preference (lower rank = more preferred)
        admits.sort(key=lambda x: college_rank[c][x])

        if len(admits) > quotas[c]:
            rejected = admits.pop()  # worst student is displaced
            free_students.append(rejected)

    return {s: c for c, students in college_admits.items() for s in students}
```

### Kidney Exchange

Kidney exchange networks extend the matching framework beyond two-sided markets. A patient with an incompatible donor can be matched with another incompatible pair in a chain or cycle. The US National Kidney Registry uses optimisation over these chains; the core stability and incentive-compatibility arguments derive from the same theoretical foundations.

---

## The Stable Roommate Problem

The Stable Roommate Problem (Irving, 1985) drops the two-sided structure: `2n` agents must be paired, each with preferences over all others. Unlike the marriage problem, a stable matching is not guaranteed to exist. Irving's algorithm determines in O(n²) whether a stable matching exists and, if so, finds one.

---

## Summary

| Property | Value |
|---|---|
| Algorithm | Gale-Shapley Deferred Acceptance |
| Time complexity | O(n²) |
| Stability | Always produces a stable matching |
| Optimality | Proposer-optimal, receiver-pessimal |
| Strategyproofness | Strategyproof for proposers only |
| Published | 1962, American Mathematical Monthly |
| Nobel Prize in Economics | Roth & Shapley, 2012 |

---

**References**

- [Gale, D. & Shapley, L.S. (1962). College Admissions and the Stability of Marriage. The American Mathematical Monthly, 69(1), 9–15](https://www.jstor.org/stable/2312726)
- [Roth, A.E. (1982). The Economics of Matching: Stability and Incentives. Mathematics of Operations Research, 7(4), 617–628](https://www.jstor.org/stable/3689483)
- [Roth, A.E. (1984). The Evolution of the Labor Market for Medical Interns and Residents: A Case Study in Game Theory. Journal of Political Economy, 92(6), 991–1016](https://www.jstor.org/stable/1837189)
- [Irving, R.W. (1985). An Efficient Algorithm for the "Stable Roommates" Problem. Journal of Algorithms, 6(4), 577–595](https://www.sciencedirect.com/science/article/pii/0196677485900331)
- [National Resident Matching Program — Algorithm and History](https://www.nrmp.org/intro-to-the-match/how-matching-algorithm-works/)
- [Roth, A.E. & Sotomayor, M. (1990). Two-Sided Matching: A Study in Game-Theoretic Modeling and Analysis. Cambridge University Press](https://www.cambridge.org/core/books/twosided-matching/1B8BECFAEE7E8AEE5805C8E7BE5D3B62)

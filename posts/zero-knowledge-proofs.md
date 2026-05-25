---
title: "Zero-Knowledge Proofs: Proving You Know Without Revealing What You Know"
date: 2026-02-03
tags: cryptography, security, zero-knowledge, zkp, privacy, blockchain
---

# Zero-Knowledge Proofs: Proving You Know Without Revealing What You Know

A zero-knowledge proof (ZKP) is a cryptographic protocol in which one party — the **prover** — convinces another party — the **verifier** — that a statement is true, without revealing any information beyond the truth of that statement itself. The concept sounds paradoxical: how can you prove knowledge of a secret without disclosing the secret? This post unpacks the formal model, the concrete protocols built on it, and the engineering contexts where ZKPs are deployed today.

---

## The Intuition: The Ali Baba Cave

The canonical thought experiment (introduced by Quisquater et al., 1989) involves a circular cave with a magic door in the middle that only opens with a secret word. The prover (Peggy) wants to convince the verifier (Victor) that she knows the secret word, without Victor learning the word.

The protocol:
1. Victor waits outside. Peggy enters the cave and takes either the left or right path at random.
2. Victor enters to the junction and shouts which path he wants Peggy to emerge from.
3. Peggy emerges from the correct path — using the secret word if she went the wrong way, or simply walking back if she went the right way.

After `n` rounds, if Peggy consistently emerges from the correct path, Victor's confidence that she knows the secret word grows as `1 - (1/2)^n`. With 30 rounds, the probability of a cheating Peggy succeeding by luck is less than one in a billion. Crucially, a transcript of the interaction gives Victor no information about the word itself.

---

## Formal Definition (Goldwasser, Micali, Rackoff 1989)

The three mandatory properties of a zero-knowledge proof system for a language `L`:

**Completeness**
If the statement is true and both parties are honest, the verifier accepts. An honest prover with a valid witness always convinces an honest verifier.

**Soundness**
If the statement is false, no cheating prover can convince the verifier, except with negligible probability `ε(k)` where `k` is the security parameter.

**Zero-knowledge**
The verifier learns nothing beyond the truth of the statement. Formally, for every probabilistic polynomial-time verifier `V*`, there exists a polynomial-time simulator `S` that can produce a transcript indistinguishable from a real interaction — without interacting with the prover and without any witness.

The simulator condition is the precise technical definition of "no information leakage." If a simulator can reproduce the conversation without talking to the prover, then the conversation itself carries no useful information about the witness.

---

## Sigma Protocols: The Building Block

A **Sigma protocol** (Σ-protocol) is a three-move interactive ZKP structure:

```
Prover                          Verifier
  |                                |
  |--- commitment (R) ----------->|
  |                                |
  |<-- challenge (c) -------------|
  |                                |
  |--- response (s) ------------->|
  |                                |
                          verify(R, c, s, public_input)
```

The name comes from the shape of the flow: send, receive, send — resembling the Greek letter Σ. The canonical example is the **Schnorr Identification Protocol** for proving knowledge of a discrete logarithm.

---

## Schnorr Protocol — RFC 8235

The Schnorr Non-Interactive Zero-Knowledge Proof is standardized in [RFC 8235](https://datatracker.ietf.org/doc/html/rfc8235) (IETF, 2017). It proves knowledge of a discrete logarithm in a prime-order group.

### Setup

Let `G` be a cyclic group of prime order `q` with generator `g`. The prover knows secret `x` such that the public value is `Y = g^x mod p`.

**Goal:** Prove knowledge of `x` without revealing `x`.

### Interactive Protocol

```
Prover (knows x)                        Verifier (knows Y, g, p, q)

r ← random in [1, q-1]
R = g^r mod p
          --- R (commitment) -------->
                                        c ← random in [1, q-1]
          <--- c (challenge) ----------
s = (r + c*x) mod q
          --- s (response) ---------->
                                        check: g^s ≡ R * Y^c (mod p)
```

**Correctness:** `g^s = g^(r + cx) = g^r * (g^x)^c = R * Y^c`. The equation holds for any honest prover.

**Soundness:** If a prover can answer two different challenges `c1 ≠ c2` for the same commitment `R`, then `s1 - s2 = (c1 - c2) * x mod q`, which reveals `x`. Therefore, a cheating prover who does not know `x` can only succeed with probability `1/q`, which is negligible.

**Zero-knowledge:** A simulator can generate valid-looking transcripts `(R, c, s)` by picking `c` and `s` at random, then computing `R = g^s * Y^(-c) mod p`. This is indistinguishable from a real transcript.

### Python Implementation

```python
import secrets
import hashlib

# Group parameters (illustrative small values; use RFC 3526 / NIST groups in production)
p = 0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74  # 256-bit prime
q = (p - 1) // 2    # assuming safe prime; use a proper prime-order subgroup in production
g = 2               # generator

def keygen():
    x = secrets.randbelow(q - 1) + 1
    Y = pow(g, x, p)
    return x, Y

def prove(x: int, Y: int):
    r = secrets.randbelow(q - 1) + 1
    R = pow(g, r, p)
    return R, r

def respond(r: int, x: int, c: int) -> int:
    return (r + c * x) % q

def verify(Y: int, R: int, c: int, s: int) -> bool:
    lhs = pow(g, s, p)
    rhs = (R * pow(Y, c, p)) % p
    return lhs == rhs

# Demonstration
x, Y = keygen()
R, r = prove(x, Y)
c = secrets.randbelow(q - 1) + 1   # verifier's random challenge
s = respond(r, x, c)
assert verify(Y, R, c, s), "Verification failed"
```

---

## Fiat-Shamir Transform: Making It Non-Interactive

Interactive proofs require a live back-and-forth between prover and verifier, which is impractical for most applications. The **Fiat-Shamir heuristic** (Fiat & Shamir, 1986) converts a Sigma protocol into a **Non-Interactive Zero-Knowledge (NIZK)** proof by replacing the verifier's random challenge with a hash of the commitment and public parameters:

```
c = H(g || Y || R || message)
```

The prover computes `c` themselves and publishes `(R, s)` as the proof. Any verifier can recompute `c` from public values and check the equation. The security argument relies on modelling `H` as a **random oracle** — a standard assumption in the random oracle model (ROM), formalized in the provable security literature.

The Fiat-Shamir transform is the foundation of signature schemes: Schnorr signatures (ISO/IEC 14888-3:2018, EdDSA per RFC 8032) are exactly Schnorr Σ-protocol made non-interactive via Fiat-Shamir.

---

## zk-SNARKs: Succinct Non-Interactive Arguments of Knowledge

For general computation (not just discrete log), **zk-SNARKs** encode arbitrary computations as polynomial constraints. The acronym expands:

| Letter | Meaning |
|---|---|
| **zk** | Zero-Knowledge — the proof reveals nothing beyond validity |
| **S** | Succinct — the proof is short (typically 128–288 bytes) regardless of computation size |
| **N** | Non-Interactive — no back-and-forth required |
| **AR** | Argument of Knowledge — prover must "know" a witness, not just that one exists |
| **K** | (of) Knowledge |

A zk-SNARK for a statement `C(x, w) = 1` (where `x` is public input, `w` is private witness, and `C` is a circuit) can be verified in constant time — milliseconds — regardless of how long the computation `C` takes to run. Groth16 (Groth, 2016) produces proofs of ~128 bytes with a verification time of ~1 ms.

The cost of succinctness: zk-SNARKs require a **trusted setup** — a multi-party computation ceremony that generates public parameters (the Common Reference String, or CRS). If the setup is compromised, the soundness of all proofs breaks. Zcash's "Sapling" ceremony involved ~90 independent participants to mitigate this risk.

---

## zk-STARKs: Transparent and Post-Quantum

**zk-STARKs** (Ben-Sasson et al., 2018) eliminate the trusted setup requirement:

| Property | zk-SNARK (Groth16) | zk-STARK |
|---|---|---|
| Trusted setup | Required (CRS ceremony) | None (transparent) |
| Proof size | ~128 bytes | ~100 KB (growing logarithmically) |
| Verification time | ~1 ms | ~10 ms |
| Post-quantum secure | No (relies on elliptic curves) | Yes (relies on hash functions) |
| Best fit | On-chain verification (Ethereum) | Off-chain proving, long-term security |

STARKs replace the algebraic structure of pairings with hash functions (specifically FRI — Fast Reed-Solomon Interactive Oracle Proofs), which are believed to be quantum-resistant.

---

## Applications

### Blockchain: Private Transactions

Zcash uses Groth16 zk-SNARKs to prove that a shielded transaction is valid (inputs equal outputs, sender has sufficient funds) without revealing sender, recipient, or amount. The proof is verified on-chain in roughly 10 ms.

### zkRollups: Ethereum Layer 2 Scaling

zkSync Era and StarkNet batch thousands of Ethereum transactions off-chain and post a single ZKP on-chain proving the entire batch is valid. The on-chain verifier checks one proof instead of thousands of transactions, reducing gas costs by 10–100×.

### Anonymous Credentials

A user proves they satisfy a predicate (e.g., "age ≥ 18", "is a citizen of country X") without revealing the underlying credential data. The W3C Verifiable Credentials specification provides a data model that can be combined with ZKPs (BBS+ signatures) for selective disclosure.

### Password Authentication Without Transmission

A client proves knowledge of a password to a server without the password being transmitted or stored in plaintext. The OPAQUE protocol (draft-irtf-cfrg-opaque) uses ZKP-based techniques as part of an augmented PAKE (Password-Authenticated Key Exchange).

---

## Summary

| Protocol | Interactivity | Trusted Setup | Proof Size | Standard |
|---|---|---|---|---|
| Schnorr Σ-protocol | Interactive | None | ~64 bytes | RFC 8235 |
| Schnorr NIZK (Fiat-Shamir) | Non-interactive | None | ~64 bytes | RFC 8235, ISO/IEC 14888-3 |
| Groth16 zk-SNARK | Non-interactive | Required | ~128 bytes | Groth (2016) |
| zk-STARK | Non-interactive | None | ~100 KB | Ben-Sasson et al. (2018) |

---

**References**

- [Goldwasser, S., Micali, S., & Rackoff, C. (1989). The knowledge complexity of interactive proof systems. SIAM Journal on Computing, 18(1), 186–208](https://dl.acm.org/doi/10.1145/3335741.3335750)
- [Quisquater, J.J. et al. (1989). How to Explain Zero-Knowledge Protocols to Your Children. CRYPTO 1989](https://link.springer.com/chapter/10.1007/0-387-34805-0_60)
- [RFC 8235 — Schnorr Non-interactive Zero-Knowledge Proof (IETF, 2017)](https://datatracker.ietf.org/doc/html/rfc8235)
- [Fiat, A. & Shamir, A. (1986). How to Prove Yourself: Practical Solutions to Identification and Signature Problems. CRYPTO 1986](https://link.springer.com/chapter/10.1007/3-540-47721-7_12)
- [Groth, J. (2016). On the Size of Pairing-Based Non-Interactive Arguments. EUROCRYPT 2016](https://eprint.iacr.org/2016/260)
- [Ben-Sasson, E. et al. (2018). Scalable, transparent, and post-quantum secure computational integrity. IACR ePrint 2018/046](https://eprint.iacr.org/2018/046)
- [ISO/IEC 14888-3:2018 — IT Security Techniques: Digital signatures with appendix — Part 3: Discrete logarithm based mechanisms](https://www.iso.org/standard/76382.html)
- [IRTF CFRG Draft — The OPAQUE Asymmetric PAKE Protocol](https://datatracker.ietf.org/doc/draft-irtf-cfrg-opaque/)

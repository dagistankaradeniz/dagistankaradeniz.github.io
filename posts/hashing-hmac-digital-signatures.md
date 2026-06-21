---
title: "Hashing, HMAC & Digital Signatures"
date: 2026-05-04
tags: security, cryptography, hashing, hmac, digital-signatures, rsa, ecdsa, eddsa, java, python
---

# Hashing, HMAC & Digital Signatures

These three primitives appear throughout every security-sensitive system, yet they are frequently misused or conflated. A developer who stores a password with HMAC instead of a password-hashing function, or authenticates an API request with a bare hash instead of HMAC, has introduced a silent vulnerability that passes every functional test. Understanding exactly what each primitive guarantees — and what it does not — eliminates an entire class of design errors.

This post covers cryptographic hash functions, HMAC, and digital signatures at the algorithm level, with concrete implementations, standards references, and a side-by-side comparison of their security properties.

---

## Cryptographic Hash Functions

A cryptographic hash function is a deterministic, one-way function `H: {0,1}* → {0,1}^n` that maps an arbitrary-length input to a fixed-length digest. It must satisfy three security properties (in increasing strength):

| Property | Definition |
|---|---|
| **Preimage resistance** | Given a digest `d`, it is computationally infeasible to find any `m` such that `H(m) = d` |
| **Second preimage resistance** | Given an input `m1`, it is computationally infeasible to find `m2 ≠ m1` such that `H(m1) = H(m2)` |
| **Collision resistance** | It is computationally infeasible to find any pair `(m1, m2)` with `m1 ≠ m2` such that `H(m1) = H(m2)` |

Collision resistance implies second preimage resistance, but not preimage resistance. All three are required for a hash function to be considered cryptographically secure.

### Standards

- **FIPS 180-4** — *Secure Hash Standard* (NIST, 2015): defines SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA-512/224, and SHA-512/256.
- **FIPS 202** — *SHA-3 Standard* (NIST, 2015): defines SHA3-224, SHA3-256, SHA3-384, SHA3-512, and the extendable-output functions (XOFs) SHAKE128 and SHAKE256. SHA-3 is based on the Keccak sponge construction, which is architecturally independent from SHA-2, providing algorithmic diversity.
- **NIST SP 800-131A Rev. 2** — *Transitioning the Use of Cryptographic Algorithms and Key Lengths* (NIST, 2019): officially disallows SHA-1 for digital signatures and most new applications; SHA-256 or stronger is required.

### What a Hash Guarantees (and Does Not)

A bare hash `H(m)` proves **integrity** — that `m` has not changed since the digest was computed — but only if the recipient already knows the expected digest through a trusted channel. It provides **no authentication**: anyone who can modify `m` can also recompute `H(m)`. Publishing `SHA-256(file)` next to the file on the same server offers no protection against an attacker who controls the server.

There is also no secret involved, which means a hash gives no protection against forgery by any party who can observe or compute it.

### The Length Extension Attack

Merkle-Damgård hash functions (MD5, SHA-1, SHA-2) are vulnerable to **length extension attacks**. If an attacker knows `H(m)` and the length of `m`, they can compute `H(m || padding || m')` for any chosen `m'` — without knowing `m`. This makes the naive construction `H(secret || message)` completely broken as a MAC.

SHA-3 (sponge construction) and BLAKE3 are not vulnerable to length extension. However, the standard solution for keyed authentication is HMAC, not a bare hash.

### Java

```java
import java.security.MessageDigest;
import java.util.HexFormat;

public final class Hashing {

    public static String sha256Hex(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(data));
    }

    public static String sha3_256Hex(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA3-256");
        return HexFormat.of().formatHex(digest.digest(data));
    }
}
```

### Python

```python
import hashlib

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha3_256_hex(data: bytes) -> str:
    return hashlib.sha3_256(data).hexdigest()
```

### Pros and Cons

| | |
|---|---|
| **Pros** | Extremely fast; no key material required; universally implemented; content-addressable storage, deduplication, checksum verification |
| **Cons** | No authentication; no secrecy; vulnerable to length extension (SHA-2); unsuitable as a standalone MAC; SHA-1 and MD5 are broken for collision resistance |

---

## HMAC

HMAC (Hash-based Message Authentication Code) is defined in [RFC 2104](https://datatracker.ietf.org/doc/html/rfc2104) (IETF, 1997) and standardized in **FIPS 198-1** (NIST, 2008). It provides **message authentication**: a keyed digest that proves both integrity and origin to any party that holds the shared secret.

### The Construction (RFC 2104 Section 2)

```text
ipad = 0x36 repeated B times
opad = 0x5C repeated B times

HMAC(K, m) = H((K' ⊕ opad) || H((K' ⊕ ipad) || m))
```

Where:
- `B` is the block size of the underlying hash function (64 bytes for SHA-256; 128 bytes for SHA-512)
- `K'` is the key padded or hashed to exactly `B` bytes: if `|K| > B`, then `K' = H(K)`; if `|K| < B`, then `K'` is zero-padded to `B` bytes
- `⊕` denotes XOR
- `||` denotes concatenation

The two-pass structure (inner hash under `ipad`, outer hash under `opad`) is specifically designed to defeat the length extension attack that breaks `H(K || m)`. An attacker who sees `HMAC(K, m)` cannot extend `m` because the outer key is never exposed.

RFC 2104 Section 3 provides the formal security proof: HMAC's security reduces to the pseudorandomness of the underlying compression function, not merely its collision resistance. This means HMAC-SHA-1 remains secure for authentication even though SHA-1 is broken for collision resistance.

### Key Requirements

RFC 2104 Section 3:
> "The key should be chosen randomly (or using a pseudorandom generator) and should be at least as long as the hash output."

FIPS 198-1 Section 6 further states that keys shorter than the hash output length reduce the security margin proportionally. For HMAC-SHA-256, a 256-bit key is recommended.

### Truncation

RFC 2104 Section 5 permits truncating the HMAC output to at least half the hash length:
> "We recommend that applications do not truncate the output of HMAC to less than 80 bits."

FIPS 198-1 Section 6 formalizes this as: the truncated output must be at least `min(L/2, 112)` bits, where `L` is the hash output length in bits.

### Java

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.HexFormat;

public final class HMAC {

    public static String hmacSha256Hex(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data));
    }

    public static boolean verify(byte[] key, byte[] data, byte[] expectedMac) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        byte[] computed = mac.doFinal(data);
        // Constant-time comparison to prevent timing attacks
        return MessageDigest.isEqual(computed, expectedMac);
    }
}
```

The `MessageDigest.isEqual` call is critical. A naive `Arrays.equals` short-circuits on the first mismatch, leaking the number of matching bytes through timing. `MessageDigest.isEqual` runs in constant time regardless of how many bytes match, preventing timing-based forgery attacks.

### Python

```python
import hmac
import hashlib

def hmac_sha256_hex(key: bytes, data: bytes) -> str:
    return hmac.new(key, data, hashlib.sha256).hexdigest()

def verify_hmac(key: bytes, data: bytes, expected_mac: bytes) -> bool:
    computed = hmac.new(key, data, hashlib.sha256).digest()
    # hmac.compare_digest is constant-time — required to prevent timing attacks
    return hmac.compare_digest(computed, expected_mac)
```

Python's `hmac.compare_digest` is the equivalent of Java's `MessageDigest.isEqual`. Both are mandated by their respective standard libraries specifically to prevent timing side-channels.

### Pros and Cons

| | |
|---|---|
| **Pros** | Authenticates both integrity and origin; fast (two hash passes); provably secure under standard assumptions; immune to length extension; symmetric key (easy to provision) |
| **Cons** | Shared secret — both parties must know the key; does not provide non-repudiation; key distribution is a coordination problem at scale; if the key leaks, all past and future MACs are forgeable |

---

## Digital Signatures

A digital signature scheme uses **asymmetric key pairs**: a private key to sign, and a public key to verify. It provides:

1. **Integrity** — the message has not been altered since signing
2. **Authentication** — the signature was produced by the holder of the private key
3. **Non-repudiation** — the signer cannot plausibly deny having signed, because only they hold the private key

This is the fundamental distinction from HMAC: HMAC requires the verifier to share a secret with the signer, which means both parties can produce a valid MAC. A digital signature can only be produced by the private key holder, so the verifier (holding only the public key) can prove origin to a third party.

### RSA-PSS — RFC 8017 / FIPS 186-5

RSA-PKCS#1 v2.2 is defined in [RFC 8017](https://datatracker.ietf.org/doc/html/rfc8017). The PSS (Probabilistic Signature Scheme) padding mode is required for security; the older PKCS#1 v1.5 mode has known weaknesses (Bleichenbacher-style attacks in various contexts) and is deprecated for new designs in FIPS 186-5.

Signing with RSA-PSS:
```text
signature = RSA_decrypt(private_key, PSS_encode(H(message), salt))
```

Verification:
```text
RSA_encrypt(public_key, signature) → PSS_decode(result) → verify H(message) matches
```

Key length: NIST SP 800-131A Rev. 2 requires RSA keys of at least 2048 bits through 2030, and recommends 3072 bits for longer-term security.

### ECDSA — FIPS 186-5 / SEC 1

Elliptic Curve Digital Signature Algorithm is defined in [FIPS 186-5](https://csrc.nist.gov/publications/detail/fips/186/5/final) (NIST, 2023) and [SEC 1](https://www.secg.org/sec1-v2.pdf) (SECG, 2009). ECDSA achieves equivalent security to RSA with much smaller keys: a 256-bit ECDSA key (e.g., P-256) provides approximately 128-bit security, comparable to a 3072-bit RSA key.

The most common curves are:
- **P-256 (secp256r1/prime256v1)** — NIST recommended; widely supported
- **P-384 (secp384r1)** — 192-bit security; used in Suite B
- **secp256k1** — used in Bitcoin; not a NIST curve

ECDSA signing requires a high-quality random nonce `k` per signature. Reusing or leaking `k` allows full private key recovery — this is the attack that compromised Sony's PlayStation 3 ECDSA key in 2010.

### EdDSA / Ed25519 — RFC 8032

EdDSA is defined in [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) (IETF, 2017) and standardized in FIPS 186-5. The Ed25519 variant (over Curve25519) is the recommended choice for new systems.

Key advantages over ECDSA:
- The nonce is deterministically derived from the private key and message (`k = H(b || m)`), eliminating the catastrophic risk of nonce reuse
- Constant-time implementations are significantly easier to write correctly
- Fast in software (~100k signatures/second on modern hardware)
- 64-byte compact signatures; 32-byte keys

Ed25519 is now supported in TLS 1.3 (RFC 8446), SSH (RFC 8709), and JWT (RFC 8037).

### Java

```java
import java.security.*;
import java.util.HexFormat;

public final class DigitalSignatures {

    // ECDSA with P-256 — FIPS 186-5
    public static KeyPair generateEcKeyPair() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new java.security.spec.ECGenParameterSpec("secp256r1"));
        return gen.generateKeyPair();
    }

    public static byte[] signEcdsa(PrivateKey privateKey, byte[] data) throws Exception {
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(privateKey);
        signer.update(data);
        return signer.sign();
    }

    public static boolean verifyEcdsa(PublicKey publicKey, byte[] data, byte[] signature) throws Exception {
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(publicKey);
        verifier.update(data);
        return verifier.verify(signature);
    }

    // Ed25519 — RFC 8032 / FIPS 186-5 (requires Java 15+)
    public static KeyPair generateEd25519KeyPair() throws Exception {
        return KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    }

    public static byte[] signEd25519(PrivateKey privateKey, byte[] data) throws Exception {
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(privateKey);
        signer.update(data);
        return signer.sign();
    }

    public static boolean verifyEd25519(PublicKey publicKey, byte[] data, byte[] signature) throws Exception {
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update(data);
        return verifier.verify(signature);
    }
}
```

### Python

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.ec import (
    ECDSA, EllipticCurvePrivateKey, generate_private_key, SECP256R1
)
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

# Ed25519 — RFC 8032
def generate_ed25519_keypair():
    private_key = Ed25519PrivateKey.generate()
    return private_key, private_key.public_key()

def sign_ed25519(private_key: Ed25519PrivateKey, data: bytes) -> bytes:
    return private_key.sign(data)

def verify_ed25519(public_key, data: bytes, signature: bytes) -> bool:
    try:
        public_key.verify(signature, data)
        return True
    except InvalidSignature:
        return False

# ECDSA with P-256 — FIPS 186-5
def generate_ec_keypair():
    private_key = generate_private_key(SECP256R1())
    return private_key, private_key.public_key()

def sign_ecdsa(private_key: EllipticCurvePrivateKey, data: bytes) -> bytes:
    return private_key.sign(data, ECDSA(hashes.SHA256()))

def verify_ecdsa(public_key, data: bytes, signature: bytes) -> bool:
    try:
        public_key.verify(signature, data, ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False
```

### Pros and Cons

| | |
|---|---|
| **Pros** | Non-repudiation; public key can be widely distributed without compromising signing ability; enables trust hierarchies (PKI, certificate chains); verifiable by any party without sharing a secret |
| **Cons** | Significantly slower than HMAC (10x–1000x depending on algorithm and key size); requires key management infrastructure (PKI or key distribution); private key compromise invalidates all past and future signatures; RSA key sizes are large (2048–4096 bits) |

---

## Side-by-Side Comparison

| Property | Hash (`SHA-256`) | HMAC (`HMAC-SHA-256`) | Digital Signature (`Ed25519`) |
|---|---|---|---|
| **Key type** | None | Symmetric (shared secret) | Asymmetric (private/public pair) |
| **Integrity** | Yes | Yes | Yes |
| **Authentication** | No | Yes (to key holder) | Yes (to anyone with public key) |
| **Non-repudiation** | No | No | Yes |
| **Key distribution** | None required | Shared secret must be provisioned out-of-band | Public key freely distributable; private key kept secret |
| **Speed** | ~2 GB/s (SHA-256, software) | ~1.9 GB/s (HMAC-SHA-256, software) | ~100k signatures/s (Ed25519) |
| **Output size** | 32 bytes (SHA-256) | 32 bytes (HMAC-SHA-256) | 64 bytes (Ed25519) |
| **Forgeable by verifier?** | N/A | Yes (verifier holds the same key) | No (verifier only holds public key) |
| **Relevant standard** | FIPS 180-4, FIPS 202 | RFC 2104, FIPS 198-1 | RFC 8032, FIPS 186-5 |
| **Length extension safe** | No (SHA-2), Yes (SHA-3) | Yes (by construction) | Yes |

---

## Choosing the Right Primitive

**Use a bare hash when:**
- You need a content fingerprint with no authentication requirement (deduplication, caching, content-addressable storage)
- The expected digest is delivered through a separately authenticated channel (e.g., a pinned hash in a binary, or a digest published in a signed release manifest)

**Use HMAC when:**
- Both parties share a secret and you need to authenticate messages between them (API authentication, webhook signatures, session tokens, JWTs with `HS256`)
- Performance is critical and non-repudiation is not required
- You are implementing a KDF or PRF (HMAC is the basis for HKDF per RFC 5869)

**Use digital signatures when:**
- The verifier should not be able to forge a signature (non-repudiation)
- Authentication must be verifiable by parties who were not involved in the original exchange (code signing, document signing, certificate authorities)
- You are building a trust hierarchy (PKI, certificate chains, TLS)
- You are signing JWTs with `ES256` or `EdDSA` for third-party consumption

**Common mistakes:**
- Using `HMAC(secret, password)` to store passwords — HMAC is not a password-hashing function. Use Argon2id (RFC 9106), bcrypt, or scrypt instead.
- Using a bare hash to "sign" a webhook payload — trivially forgeable by any recipient.
- Using ECDSA without verifying that the RNG is cryptographically secure — nonce reuse recovers the private key.
- Comparing MAC or signature values with `==` instead of a constant-time comparison function.

---

## Algorithm Selection by Standard

| Use case | NIST recommendation (SP 800-131A Rev. 2, FIPS 186-5) |
|---|---|
| Hashing (general) | SHA-256, SHA-384, SHA-512, SHA3-256 |
| Hashing (legacy migration) | SHA-1 disallowed for signatures; allowed only for HMAC and key derivation in legacy contexts |
| MAC | HMAC-SHA-256 or stronger; CMAC (NIST SP 800-38B) for block cipher contexts |
| Digital signatures — RSA | RSA-PSS with SHA-256+, 2048-bit minimum key (3072 recommended past 2030) |
| Digital signatures — elliptic curve | ECDSA P-256/P-384/P-521 (FIPS 186-5); EdDSA Ed25519/Ed448 (FIPS 186-5) |
| Key agreement | ECDH with P-256 or higher; X25519 (RFC 7748) |

---

**References**

- [RFC 2104 — HMAC: Keyed-Hashing for Message Authentication (IETF, 1997)](https://datatracker.ietf.org/doc/html/rfc2104)
- [RFC 8017 — PKCS #1: RSA Cryptography Specifications Version 2.2 (IETF, 2016)](https://datatracker.ietf.org/doc/html/rfc8017)
- [RFC 8032 — Edwards-Curve Digital Signature Algorithm (EdDSA) (IETF, 2017)](https://datatracker.ietf.org/doc/html/rfc8032)
- [RFC 5869 — HMAC-based Extract-and-Expand Key Derivation Function (HKDF) (IETF, 2010)](https://datatracker.ietf.org/doc/html/rfc5869)
- [RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3 (IETF, 2018)](https://datatracker.ietf.org/doc/html/rfc8446)
- [FIPS 180-4 — Secure Hash Standard (NIST, 2015)](https://csrc.nist.gov/publications/detail/fips/180/4/final)
- [FIPS 198-1 — The Keyed-Hash Message Authentication Code (HMAC) (NIST, 2008)](https://csrc.nist.gov/publications/detail/fips/198/1/final)
- [FIPS 202 — SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions (NIST, 2015)](https://csrc.nist.gov/publications/detail/fips/202/final)
- [FIPS 186-5 — Digital Signature Standard (DSS) (NIST, 2023)](https://csrc.nist.gov/publications/detail/fips/186/5/final)
- [NIST SP 800-131A Rev. 2 — Transitioning the Use of Cryptographic Algorithms and Key Lengths (NIST, 2019)](https://csrc.nist.gov/publications/detail/sp/800-131a/rev-2/final)
- [SEC 1: Elliptic Curve Cryptography, Version 2.0 (SECG, 2009)](https://www.secg.org/sec1-v2.pdf)

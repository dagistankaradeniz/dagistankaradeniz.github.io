---
title: HOTP & TOTP: The Algorithms Behind Authenticator Apps
date: 2026-05-25
tags: security, authentication, otp, mfa, hotp, totp, java, python
---

# HOTP & TOTP: The Algorithms Behind Authenticator Apps

Most engineers have integrated two-factor authentication into a product, but far fewer have read the two RFCs that underpin every authenticator app. Understanding the algorithms — not just the libraries — reveals subtle security properties and failure modes that affect system design decisions.

This post dissects **HOTP** (RFC 4226) and **TOTP** (RFC 6238) at the algorithm level, shows working implementations, and maps them to the threat landscape they address.

---

## Why Not SMS?

Before looking at the algorithms, it is worth understanding what they replace.

NIST SP 800-63B Section 5.1.3.3 states:

> "Due to the risk that SMS messages may be intercepted or redirected, implementers of new systems SHOULD carefully consider alternative authenticators."

The two dominant attack vectors are **SS7 exploitation** (protocol-level interception of the public telephone network) and **SIM swapping** (social engineering a carrier into porting a number). Both render SMS OTP ineffective against a motivated attacker. Authenticator apps sidestep the telephone network entirely: the shared secret is established once at enrollment, and subsequent codes are generated fully offline.

---

## HOTP — RFC 4226

HMAC-Based One-Time Password (HOTP) is defined in [RFC 4226](https://datatracker.ietf.org/doc/html/rfc4226) (IETF, December 2005). The algorithm is built on three components:

- **K** — shared secret key (≥128 bits; 160 bits recommended per RFC 4226 Section 4)
- **C** — 8-byte (64-bit) big-endian counter, synchronized between client and server
- **Digit** — OTP length; RFC 4226 Section 4 recommends a minimum of 6 digits

### The Algorithm (RFC 4226 Section 5.3)

**Step 1 — HMAC-SHA-1**

```
HS = HMAC-SHA-1(K, C)
```

The counter `C` is serialized as an 8-byte big-endian unsigned integer before being passed to HMAC.
`HS` is 20 bytes (160 bits).

**Step 2 — Dynamic Truncation**

Rather than truncating a fixed window of the HMAC output, RFC 4226 uses the low-order 4 bits of the last byte as a dynamic offset:

```
offset  = HS[19] & 0x0F          // 0 ≤ offset ≤ 15
P       = HS[offset..offset+3]   // 4 bytes
Sbits   = P & 0x7FFFFFFF         // mask the MSB to avoid sign issues
```

Masking the most significant bit of `P` ensures the result is always treated as a positive 31-bit integer regardless of language or platform.

**Step 3 — OTP**

```
HOTP(K, C) = Sbits mod 10^Digit
```

### Java Implementation

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;

public final class HOTP {

    public static String generate(byte[] key, long counter, int digits) throws Exception {
        // Step 1: HMAC-SHA-1 over the 8-byte big-endian counter (RFC 4226 §5.3)
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(key, "HmacSHA1"));
        byte[] hmac = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());

        // Step 2: Dynamic Truncation
        int offset    = hmac[hmac.length - 1] & 0x0F;
        int truncated = ((hmac[offset]     & 0x7F) << 24)
                      | ((hmac[offset + 1] & 0xFF) << 16)
                      | ((hmac[offset + 2] & 0xFF) <<  8)
                      |  (hmac[offset + 3] & 0xFF);

        // Step 3: OTP
        int otp = truncated % (int) Math.pow(10, digits);
        return String.format("%0" + digits + "d", otp);
    }
}
```

### Python Implementation

```python
import hmac
import hashlib
import struct

def generate_hotp(key: bytes, counter: int, digits: int = 6) -> str:
    # Step 1: HMAC-SHA-1 over the 8-byte big-endian counter (RFC 4226 §5.3)
    counter_bytes = struct.pack(">Q", counter)
    mac = hmac.new(key, counter_bytes, hashlib.sha1).digest()

    # Step 2: Dynamic Truncation
    offset    = mac[-1] & 0x0F
    truncated = struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF

    # Step 3: OTP
    otp = truncated % (10 ** digits)
    return str(otp).zfill(digits)
```

### Counter Drift and Resynchronization

Because the counter only advances when a code is consumed, a client that generates but discards codes falls out of sync. RFC 4226 Section 7.4 addresses this:

> "We RECOMMEND that the server attempts to verify the OTP using a look-ahead window of size s, where s ≥ 4."

This means a server should accept `HOTP(K, C)`, `HOTP(K, C+1)`, ..., `HOTP(K, C+s)`. Once a match is found, the server updates its stored counter to `matched_index + 1`.

The tradeoff is accuracy versus security: a larger look-ahead window tolerates more drift but increases the bruteforce surface.

---

## TOTP — RFC 6238

Time-Based One-Time Password (TOTP) is defined in [RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238) (IETF, May 2011). It is a direct extension of HOTP that replaces the counter with a time-derived value, making codes self-expiring.

### Time Counter (RFC 6238 Section 4)

```
T = floor((Unix time − T0) / X)
TOTP(K) = HOTP(K, T)
```

Where:

| Parameter | Default | Description |
|---|---|---|
| T0 | 0 | Unix epoch (January 1, 1970 00:00:00 UTC) |
| X | 30 | Time step in seconds |

A 30-second step means each code is valid within a specific 30-second window. This is the root cause of the "expiring code" UX.

### Hash Algorithm Flexibility

Unlike HOTP (SHA-1 only), TOTP supports stronger hash functions per RFC 6238 Section 1:

> "TOTP implementations MAY use HMAC-SHA-256 or HMAC-SHA-512 functions, based on SHA-256 or SHA-512 hash functions."

In practice, the most deployed authenticator apps still default to HMAC-SHA-1, but the RFC explicitly defines SHA-256 and SHA-512 variants.

### Java Implementation

```java
public final class TOTP {

    private static final long T0 = 0L;   // Unix epoch (RFC 6238 §4)
    private static final long X  = 30L;  // Time step in seconds (RFC 6238 §4)

    public static String generate(byte[] key, int digits) throws Exception {
        long t = (System.currentTimeMillis() / 1000L - T0) / X;
        return HOTP.generate(key, t, digits);
    }

    // To use SHA-256 or SHA-512 per RFC 6238, replace "HmacSHA1" in HOTP.generate
    // with "HmacSHA256" or "HmacSHA512" and pass the corresponding algorithm parameter.
}
```

### Python Implementation

```python
import time

T0 = 0   # Unix epoch (RFC 6238 §4)
X  = 30  # Time step in seconds (RFC 6238 §4)

def generate_totp(key: bytes, digits: int = 6) -> str:
    t = int((time.time() - T0) / X)
    return generate_hotp(key, t, digits)
```

### Clock Drift and Validation Window

RFC 6238 Section 5.2 describes the validation strategy for servers:

> "We RECOMMEND that at most one time step is allowed as the network delay."

This means a server should accept the code for `T-1`, `T`, and `T+1`. Accepting `T-1` accounts for a user who generated a code just before a window boundary; accepting `T+1` tolerates minor clock skew on the server.

Accepting more than one step on either side increases the replay window without proportional benefit. RFC 6238 Section 5.2 further recommends that servers record the last successful `T` to prevent replay within the same time step.

---

## Security Properties

### Replay Protection

An HOTP code is only valid once: the server increments its counter after each successful verification. A TOTP code is bound to a 30-second window; replaying the same code within that window must be blocked by the server recording the last verified `T`. RFC 6238 Section 5.2:

> "Note that a prover may send the same OTP inside a given time-step multiple times to a verifier. The verifier MUST NOT accept the second attempt of the OTP after the successful validation has been issued for the first OTP."

### Brute Force Resistance

With 6-digit OTPs there are 10^6 = 1,000,000 possible values. RFC 4226 Section 7.3 notes that the per-attempt probability of a correct guess is 1 in 10^6. Servers MUST implement throttling and lockout to prevent exhaustive search.

RFC 4226 also defines an attack resistance metric S based on throttling parameters, but the practical takeaway is: **rate limiting is mandatory**, not optional.

### Key Length Requirements

RFC 4226 Section 4:

> "The length of the shared secret MUST be at least 128 bits. This document RECOMMENDs a shared secret length of 160 bits."

A 160-bit key aligns with HMAC-SHA-1's internal state size, avoiding any key-length-related weakening.

---

## NIST Classification

NIST SP 800-63B (Digital Identity Guidelines) classifies HOTP and TOTP authenticators under **Single-Factor OTP Devices** (Section 5.1.4). Key requirements from NIST SP 800-63B:

- The authenticator output SHALL have at least 6 decimal digits of entropy.
- Time-based OTP nonces SHALL be accepted for no more than 2 minutes after generation by the authenticator to limit the vulnerability window.
- Verifiers SHALL implement rate limiting to prevent brute-force attacks.

When combined with a memorized secret (password), TOTP satisfies **Authenticator Assurance Level 2 (AAL2)**, which NIST SP 800-63B requires for accessing high-risk systems.

---

## Modern Authenticator Apps

Popular apps implement the RFC 6238 stack with varying enhancements:

| App | Offline | Cloud Backup | Multi-Device | Notes |
|---|---|---|---|---|
| Google Authenticator | Yes | Optional (Google Account) | Yes (since 2023) | TOTP/HOTP per RFC |
| Microsoft Authenticator | Yes | Yes (Azure AD) | Yes | Adds push approval on top |
| Authy | Yes | Yes (Authy cloud) | Yes | Proprietary encrypted backup |
| Apple Passwords | Yes | Yes (iCloud Keychain) | Yes (Apple ecosystem) | Built into iOS 17+ / macOS Sonoma+ |

All of these apps generate codes using the same RFC 4226 / RFC 6238 algorithms. The differences are in key backup, multi-device sync, and UX layers built on top of the standard.

---

## What TOTP Does Not Solve

TOTP significantly raises the bar over static passwords and SMS, but it does not fully prevent all attack classes:

**Real-time phishing (Adversary-in-the-Middle):** A phishing site can proxy credentials and TOTP codes in real time, relaying them to the legitimate service before the 30-second window expires. TOTP codes are not bound to the origin (domain) of the relying party.

**Malware on the authenticating device:** If the device running the authenticator is compromised, codes can be extracted before use.

**FIDO2 / WebAuthn** addresses the origin-binding problem through public-key cryptography, where the credential is domain-scoped and a phishing site can never obtain a valid assertion. TOTP is a strong improvement over SMS and passwords, but engineers designing new high-risk authentication flows should evaluate FIDO2 as the next step.

---

## Summary

| Property | HOTP (RFC 4226) | TOTP (RFC 6238) |
|---|---|---|
| Counter source | Explicit counter C | `floor((Unix time − T0) / X)` |
| Code lifetime | Until used | ~30 seconds (configurable) |
| Hash function | HMAC-SHA-1 | HMAC-SHA-1 / SHA-256 / SHA-512 |
| Drift handling | Look-ahead window (s ≥ 4) | ±1 time step |
| Replay protection | Counter increment | Record last verified T |
| Key requirement | ≥128 bits (160 recommended) | ≥128 bits (160 recommended) |

HOTP trades simplicity for the operational burden of counter management; TOTP solves that by anchoring to clock time at the cost of requiring roughly synchronized clocks. For the vast majority of deployments, TOTP with a 30-second step is the correct choice.

The implementations above are pedagogical. For production use, prefer a well-audited library (`com.eatthepath:java-otp` on the JVM, `pyotp` in Python) and give careful thought to key storage, rate limiting, and backup codes for account recovery.

---

**References**

- [RFC 4226 — HOTP: An HMAC-Based One-Time Password Algorithm (IETF, 2005)](https://datatracker.ietf.org/doc/html/rfc4226)
- [RFC 6238 — TOTP: Time-Based One-Time Password Algorithm (IETF, 2011)](https://datatracker.ietf.org/doc/html/rfc6238)
- [NIST SP 800-63B — Digital Identity Guidelines: Authentication and Lifecycle Management (NIST, 2017, updated 2024)](https://pages.nist.gov/800-63-3/sp800-63b.html)

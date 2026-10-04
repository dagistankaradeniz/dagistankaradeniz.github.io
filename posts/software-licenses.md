---
title: "Software Licenses: What They Allow and Don't Allow"
date: 2026-10-16
tags: software-licenses, open-source, mit, apache-2.0, gpl, lgpl, bsd, cc0, unlicense, isc, mpl, agpl, proprietary, copyleft, permissive, polyform, polyform-noncommercial, polyform-small-business, polyform-free-trial, ethical-source
---

# Software Licenses: What They Allow and Don't Allow

This is a minimal, expert-level reference covering the most common licenses, along with special/lesser-known PolyForm licenses, with official references and plain-language notes on permissions/limitations.

---

## Permissive Licenses (minimal restrictions)

| License | Official Source | Allows | Doesn't Allow | Notes/Reputation |
|---|---|---|---|---|
| **MIT** | [OSI/ SPDX MIT](https://opensource.org/license/mit) | Use, copy, modify, merge, publish, distribute, sublicense, sell copies; includes commercial use. | No warranty; liability limitation only as stated. No explicit patent grant in some older texts, but widely treated as permissive. | Extremely common, simple, business-friendly. |
| **Apache-2.0** | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) | Use, modify, distribute, sublicense, commercial use; explicit patent grant; contributions under same terms. | No warranty/liability; trademarks not granted; you must preserve NOTICE/license. | Highly reputable; explicit patent protection reduces risk. |
| **BSD 2-Clause (Simplified)** | [BSD-2-Clause](https://opensource.org/license/bsd-2-clause) | Permissive use with minimal attribution requirement (retain copyright notice + license text). | No warranty/liability. | Very business-friendly, minimal. |
| **BSD 3-Clause (Modified)** | [BSD-3-Clause](https://opensource.org/license/bsd-3-clause) | Same as 2-clause. | Also prohibits use of project/author names to endorse without permission. | Common; avoids implied endorsement. |
| **ISC** | [ISC License](https://opensource.org/license/isc) | Functionally equivalent to MIT/BSD; concise wording. | No warranty/liability. | Clean, minimal, reputable. |

---

## Copyleft Licenses (share-alike obligations)

| License | Official Source | Allows | Doesn't Allow | Notes/Reputation |
|---|---|---|---|---|
| **GPL-3.0** | [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) | Use, modify, distribute; commercial use allowed. | If you distribute derivative works, you must license under GPL-3.0 and provide source (copyleft). Stronger terms around patents/tivoization. | Strong copyleft; widely used (FSF). Impacts proprietary redistribution. |
| **GPL-2.0** | [GPL-2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html) | Similar to GPL-3.0. | Copyleft; lacks some GPL-3.0 patent/tivoization protections. | Legacy; still common. |
| **AGPL-3.0** | [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html) | Same as GPL-3.0. | Triggers copyleft even for remote network interaction (SaaS/web services) — "network copyleft". | Controversial for cloud/SaaS; use carefully (FSF). |
| **LGPL-3.0** | [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.en.html) | Use as library in proprietary apps without relicensing the app. | If you modify the LGPL library itself and distribute, you must share LGPL source modifications. | "Weak" copyleft; pragmatic for libraries. |
| **MPL-2.0** | [MPL-2.0](https://www.mozilla.org/MPL/2.0/) | Permissive-like for larger works: you can combine MPL code with proprietary code in same file? MPL is file-level copyleft — changes to MPL files must be shared; other files remain proprietary. | Must disclose source of modified MPL files; no warranty/liability. | Balanced; Mozilla-backed, reputable. |

---

## Public Domain / Ultra-Permissive (no attribution/waivers)

| License | Official Source | Allows | Doesn't Allow | Notes/Reputation |
|---|---|---|---|---|
| **CC0 1.0 Universal** | [CC0](https://creativecommons.org/public-domain/cc0/) | Dedicate to public domain; use, modify, distribute, commercial, no attribution required. | No warranty; liability limitations vary by jurisdiction; doesn't grant patent rights explicitly (though intent is waiver). | Legally strong public-domain dedication. |
| **The Unlicense** | [Unlicense](https://unlicense.org/) | Public-domain style; very short. | No warranty; may be less certain in some jurisdictions vs CC0. | Simple, but CC0 is often preferred legally. |

---

## Proprietary / Source-Available (non-OSS)

| License | Official Source | Allows | Doesn't Allow | Notes/Reputation |
|---|---|---|---|---|
| **Proprietary (all rights reserved)** | N/A (custom EULA) | Only as granted by EULA (often view/use under terms; source not provided). | Copy, modify, distribute, reverse-engineer unless permitted. Commercial terms vary. | Standard for commercial software; not OSI open-source. |

---

## PolyForm Licenses (modern source-available, with clear use limits)

PolyForm Project ([polyformproject.org](https://polyformproject.org/)) publishes standardized, plain-language source-available licenses with explicit permissions/limitations. They are **not OSI-approved open-source** (they impose usage restrictions) but are clearer than ad-hoc "non-commercial" terms.

| License | Official Source | Allows | Doesn't Allow | Notes/Reputation |
|---|---|---|---|---|
| **PolyForm Noncommercial** | [PolyForm Noncommercial](https://polyformproject.org/licenses/noncommercial/1.0.0/) | Personal use, non-commercial evaluation, modification, distribution of modified versions (non-commercial). | Commercial use (any revenue-generating/for-profit use without separate license). | Clear "non-commercial" boundary; popular for indie projects; source-available. |
| **PolyForm Small Business** | [PolyForm Small Business](https://polyformproject.org/licenses/small-business/1.0.0/) | Commercial use if your company/organization makes < USD $1M in gross annual revenue (and complies with terms). | Commercial use if revenue >= USD $1M without separate license; sublicensing beyond allowed scope. | Bridges free non-commercial vs enterprise; sets explicit revenue threshold. |
| **PolyForm Free Trial** | [PolyForm Free Trial](https://polyformproject.org/licenses/free-trial/1.0.0/) | Temporary trial/evaluation use only. | Production/commercial use after trial period; copying for non-trial use. | Useful for time-limited evaluation; not meant for perpetual free use. |
| **PolyForm Strict** | [PolyForm Strict](https://polyformproject.org/licenses/strict/1.0.0/) | Very limited: personal modification/evaluation as specified; share changes under same terms. | Broad commercial/distribution; cannot relicense/sell; many uses require separate license. | Highly restrictive; narrow use cases. |
| **PolyForm Perimeter** | [PolyForm Perimeter](https://polyformproject.org/licenses/perimeter/1.0.0/) | Internal use within a defined organization/perimeter; modification/distribution within allowed perimeter. | Use outside defined perimeter; sublicensing beyond perimeter without license. | Good for internal tooling shared within org; source-available with boundary control. |

**Reputation note:** PolyForm licenses are well-structured, lawyer-readable, and increasingly adopted. However, they are **not "open source"** under OSI/FSF definitions due to usage restrictions (commercial/non-commercial/perimeter). Treat as source-available with explicit commercial terms.

---

## Quick Rule of Thumb

- **Need maximum adoption/commercial freedom:** MIT or Apache-2.0.
- **Need to ensure derivatives stay open:** GPL-3.0 (strong). AGPL-3.0 if SaaS/network exposure.
- **Need weak copyleft for libraries:** LGPL-3.0/MPL-2.0.
- **Need to waive rights entirely:** CC0 (preferred) or Unlicense.
- **Need to monetize but keep source visible:** PolyForm (Noncommercial/Small Business) — clear, explicit terms.
- **Default for proprietary code:** All rights reserved / custom EULA.

**Key references:** [OSI Licenses](https://opensource.org/licenses/), [SPDX License List](https://spdx.org/licenses/), [FSF License List](https://www.gnu.org/licenses/license-list.en.html), [PolyForm Project](https://polyformproject.org/licenses/).

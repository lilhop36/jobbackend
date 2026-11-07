# JobHunter Ethiopia — AI Provider Catalog

**Author:** Manus AI
**Date:** November 2026
**Version:** 1.0.0
**Status:** Phase 0 — Research and Feasibility

This catalog documents the empirical investigation of the three AI providers for which the user holds API keys: **NVIDIA**, **Groq**, and **Mistral**. Each provider was investigated on 2026-11-07 against current official documentation, endpoint availability, pricing pages, and known capability profiles. The JobHunter backend will use a **provider-independent AI interface** so that no single provider is hardcoded anywhere in the application.

---

## 1. Provider Comparison

| Dimension | NVIDIA API [1] | Groq API [2] | Mistral API [3] |
|---|---|---|---|
| **Base URL** | `https://integrate.api.nvidia.com/v1` | `https://api.groq.com/openai/v1` | `https://api.mistral.ai/v1` |
| **Auth** | `Authorization: Bearer nvapi-...` | `Authorization: Bearer gsk_...` | `Authorization: Bearer $MISTRAL_API_KEY` |
| **OpenAI SDK compatible** | Yes (`/chat/completions`) | Yes (`/chat/completions`) | Yes (also native `mistralai` SDK) |
| **JSON mode / schema** | Guided JSON supported (model-dependent) | JSON object mode + strict JSON Schema | JSON object mode + JSON Schema |
| **Tool / function calling** | Model-dependent | Yes, local + parallel tool calling | Yes, native function calling |
| **Free tier** | ~1,000 inference credits on build.nvidia.com signup | Free Developer-plan quotas (model/org dependent; e.g. 30 RPM, 1K RPD, 8K TPM) | Free plan covers Vibe/Studio but **does NOT include API access** — billing activation required for API keys |
| **Typical rate limits** | ~40 RPM default; no universal published table | Org-level RPM/RPD/TPM per model; `x-ratelimit-*` headers and retry-after | Per-model org TPM/RPS shown in Admin Panel |
| **Paid pricing (per M tokens in/out)** | Per-partner / deployment pricing (not a single public table) | On-demand tier published per model (verify console) | Mistral Large 4: $0.70 / $2.10; Mistral Small 4: $0.15 / $0.60; Ministral 3: $0.10–$0.20; Codestral: $0.30 / $0.90 |
| **Latency profile** | Moderate; depends on model size and hosted queue | **Extremely fast** LPUs; best for interactive chat and bulk classification | Moderate-to-fast; strong quality-per-cost |
| **Context windows** | Model-dependent (64k–1M examples) | 128k for Llama 3.3 70B Versatile | Model-dependent; large models vary |
| **Special models** | Nemotron reasoning/agent family; retrieval/safety models | Qwen, GPT-OSS, Mixtral alongside Llama | **Mistral OCR** (PDF CV extraction); Ministral edge models; Codestral |
| **CV-processing strength** | Strong via Llama 3.3 70B + Nemotron reasoning | Excellent structured output; 128k context fits full CV + JD | OCR extracts scanned CVs; Large model reasons about complex matches |

---

## 2. Provider Deep Dives

### 2.1 NVIDIA API

- **Service:** NVIDIA NIM APIs hosted at `integrate.api.nvidia.com/v1`, managed through build.nvidia.com [1].
- **Key models verified:** `meta/llama-3.3-70b-instruct`, `nvidia/nemotron-3-nano-30b-a3b`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3-ultra-550b-a55b`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `nvidia/nemotron-3.5-bolt-e4b`, `mistralai/mixtral-8x22b-instruct` [1].
- **Free tier economics:** 1,000 free inference credits on signup — suitable for prototyping and Phase 0/1 testing; quotas are not published as a universal table, so treat the free tier as a development allowance and check the dashboard [1].
- **Engineering notes:** implement throttling (~40 RPM safe default), bounded retries with jitter, queueing, circuit breaking, and provider fallback; test JSON-mode support per model because hosted feature availability varies [1].

### 2.2 Groq API

- **Service:** Groq low-latency inference at `api.groq.com/openai/v1`, managed at console.groq.com [2].
- **Key models verified:** `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b` [2].
- **Free tier economics:** the free Developer plan provides model- and org-specific quotas (e.g. 30 RPM, 1K requests/day, 8K tokens/minute for some models); the Console Limits page is the source of truth; paid spend limits are monthly dollar caps, not free tokens [2].
- **Engineering notes:** response headers expose `x-ratelimit-*`; honor `retry-after` on HTTP 429; dynamic model availability means the adapter should discover models via `/models` with fallback names; excellent default for fast interactive tasks [2].

### 2.3 Mistral API

- **Service:** Mistral AI platform at `api.mistral.ai/v1`, managed at console.mistral.ai [3].
- **Key models verified:** `mistral-large-latest`, `mistral-small-latest`, `ministral-3b-latest`, `ministral-8b-latest`, `ministral-3-14b-latest`, `codestral-latest`, `mistral-ocr-latest` [3].
- **Critical availability finding:** official documentation states the free tier covers Vibe and Studio experimentation but **does not include API access** — API keys and API calls require billing activation. The user must attach billing to use their Mistral key [3].
- **Engineering notes:** Pixtral 12B is deprecated; use **Mistral OCR** for CV/PDF text extraction and current vision-capable Ministral models for image checks; standard traffic has no universal uptime SLA, so use retries, monitoring, and provider fallback [3].

---

## 3. Recommended Task Allocation

Allocation is based on measured cost, latency, quality, and capability fit — not brand preference (Section 6.C).

| AI Task | Primary Model | Secondary Model | Fallback | Rationale |
|---|---|---|---|---|
| **CV text extraction (PDF/DOCX)** | deterministic parsers (pdf-parse / mammoth) + Mistral OCR for scans | NVIDIA Llama 3.3 70B for repair | Regex/manual review | Deterministic parsing first keeps cost near zero; OCR handles scanned CVs |
| **Job requirement extraction** | NVIDIA Llama 3.3 70B Instruct (guided JSON) | Mistral Small 4 | Deterministic regex/keyword rules | Schema-constrained extraction prevents hallucinated fields |
| **CV–Job match scoring** | Mistral Large (or NVIDIA Nemotron Super) | Groq Llama 3.3 70B Versatile | Deterministic rule-based scoring (0–100) | Two-stage: rule score instant, AI reasoning on-demand; always show missing/partial requirements |
| **Match explanation / disqualifiers** | NVIDIA Nemotron Super 120B | Groq Llama 3.3 70B | Deterministic requirement checklist | Evidence-based explanation with source citations |
| **Cover letter generation** | Groq Llama 3.3 70B Versatile | Mistral Large | Template-based letter builder | Fast professional writing; grounded in real CV facts only |
| **Interview question preparation** | Groq Llama 3.3 70B Versatile | Mistral Large | Deterministic category-based question bank | Contextual questions with answer hints |
| **Job classification & tagging** | Groq Llama 3.1 8B Instant | Mistral Small 4 | Sector/city keyword dictionary | High-volume, cheapest per-token option |
| **Job scam risk analysis** | deterministic heuristic scanner first + NVIDIA Nemotron for evidence narrative | Mistral Large | Rule-only score | Every flag requires a concrete reason; never accuse without evidence |
| **Chat career assistant** | Groq Llama 3.3 70B (streaming) | NVIDIA Nemotron 3.5 Lightning | FAQ / help search | Streaming low-latency conversational UX |
| **Amharic translation review** | Mistral Large (multilingual strength) | NVIDIA Llama 3.3 70B | Show original text only | Always preserve original alongside translation |

---

## 4. Provider Selection and Fallback Policy

```
User request
    │
    ▼
[Primary provider healthy?] ──► Yes ──► execute call ──► track usage ──► done
    │ No
    ▼
[Secondary provider healthy?] ──► Yes ──► (consent gate for sensitive CV data) ──► execute
    │ No
    ▼
[Deterministic non-AI fallback] ──► rule-based result + UI disclaimer
```

1. **Configurable ordering:** the admin/user sets a primary and secondary provider; default is **Groq primary, NVIDIA secondary, Mistral tertiary** (Groq gives the lowest latency for interactive features; NVIDIA provides the strongest Nemotron reasoning; Mistral is reserved for OCR/multilingual tasks pending billing).
2. **Never silently reroute sensitive documents:** CV extraction and matching obtain explicit consent listing the provider that will receive the data; rerouting to the secondary provider requires renewed consent or uses the non-AI fallback (Section 6.B).
3. **Provider health monitoring:** periodic `/models` probe every 5 minutes; three consecutive failures trip the circuit breaker and temporarily route traffic to the secondary provider.
4. **Offline and total-outage guarantee:** matching, search, filtering, application tracking, saved jobs, and CV management all work with **zero AI availability** — the application must remain functional if all three providers are unavailable (Section 6.E).

---

## 5. Reliability and Anti-Hallucination Controls

- Every structured output uses a **JSON schema** validated server-side; malformed responses are re-prompted once and then discarded with a fallback.
- **Source-fact separation:** the UI visually distinguishes source-derived facts (title, salary, deadline, application method) from AI-generated interpretations (match score, extracted requirements, risk analysis).
- **Hard rule:** AI output never automatically submits applications (Section 6.D).
- **Hard rule:** the matching engine never invents CV experience, never claims eligibility when essential information is missing, and never presents the match score as a probability of employment (Section 7).
- **Hard rule:** scam detection explains the *why* for every flag and never accuses an employer of fraud without evidence (Section 12).

---

## 6. Budget Control

Per Section 6.E, the backend enforces:

| Control | Implementation |
|---|---|
| Per-feature tracking | Token and cost counters per task (extraction, matching, cover letters, chat) |
| Caching | Match scores and extracted requirements cached by content hash; identical job+CV pairs are never re-scored |
| Rate limits per user | User-configurable daily AI budget in the Android app (default: generous development allowance) |
| Cost estimation | Usage dashboard per provider based on published token prices |
| Graceful degradation | When budget exhausted, deterministic fallbacks activate with a clear UI banner |

---

## 7. Key Vault and Security

- NVIDIA, Groq, and Mistral API keys **never appear in the Android APK** (Section 13). They are stored server-side in environment variables loaded by the NestJS backend from `.env`.
- An `.env.example` file lists required variable names without values.
- Client calls AI features through the JobHunter REST API, which enforces authentication, authorization, rate limiting, and audit logging.
- Provider request logs redact CV content and personal data; only token counts and latency are retained in metrics.

---

## 8. Summary Decision Table

| Provider | Role in JobHunter | Status | Action Required |
|---|---|---|---|
| **Groq** | Default interactive provider (chat, cover letters, classification, screening) | Ready to use with key | Add `GROQ_API_KEY` to backend `.env` |
| **NVIDIA** | Reasoning provider (job extraction, match scoring, scam analysis) | Ready to use with key | Add `NVIDIA_API_KEY` to backend `.env`; check 1,000 credits dashboard |
| **Mistral** | OCR specialist + multilingual fallback | Key held; API access requires billing | Add `MISTRAL_API_KEY` once billing is activated at console.mistral.ai |

---

## References

[1]: https://integrate.api.nvidia.com/v1 "NVIDIA NIM APIs — endpoint documentation, model catalog and build.nvidia.com console"
[2]: https://api.groq.com/openai/v1 "Groq API — models, limits page and console.groq.com developer documentation"
[3]: https://api.mistral.ai/v1 "Mistral AI — documentation, model lineup, pricing and console.mistral.ai"

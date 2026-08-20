# TutorFlow AI V1 Baseline Review

This document serves as the permanent baseline summary for TutorFlow V1 AI performance prior to the implementation of LLM-as-a-judge capabilities.

## 1. Generation Baseline

### Phase 11 (Pre-Retry) — Frozen Reference
| Metric | Value |
|---|---|
| Cases | 8 |
| Successful | 5 (62.5%) |
| Failed | 3 (37.5%) |
| Schema Validity | 100% (on successful) |
| Total Marks Correctness | 100% |
| Typed-Field Completion | 100% |
| Average Latency | 23.3s |
| Maximum Latency | 36.8s |

Failure cause: All 3 failures were `INVALID_RESPONSE` provider errors before domain repair could run.

### Phase 12.3 (With Provider Retry) — Current Baseline
| Metric | Value |
|---|---|
| Cases | 8 |
| Successful | **8 (100%)** |
| Failed | **0 (0%)** |
| Schema Validity | 100% |
| Total Marks Correctness | 100% |
| Typed-Field Completion | 100% |
| Average Latency | **91.2s** ⚠️ |
| Maximum Latency | **302.0s** ⚠️ |
| Cases requiring provider retry | 2 / 8 (gen-2, gen-7 each hit 3 attempts) |
| Total provider attempts | 12 (8 baseline + 4 retries) |
| Domain repairs needed | 0 |

**Regression policy:** All 4 hard gates `[PASS]`. Success rate gate also `[PASS]`.

**Issue Classification:**
- **Reliability (100% Success Rate):** **RESOLVED** by Phase 12.2 provider retry. Previously `MUST FIX`.
- **Latency increase:** **MONITOR**. Average latency tripled due to retried cases (2/8). The 6 non-retried cases remained in normal range. This is expected behavior from retry working correctly, not a regression in the happy path.
- **Deterministic Correctness (100% bounds/schema):** **ACCEPTABLE**.

## 2. Retrieval Baseline

**Current Metrics:**
- **Corpus:** 5 frozen questions (Eval-Owned deterministic dataset)
- **Recall@1:** 83%
- **Recall@3:** 100%
- **Recall@5:** 100%
- **Rejection Accuracy:** 100%
- **Average Latency:** ~673ms

**Issue Classification:**
- **Quality (Recall@1 = 83%):** **MONITOR**. The slight drop in R@1 is due to semantic distractors out-scoring the target. However, since R@3 is 100%, the LLM generation context will still reliably receive the correct context.
- **Deterministic Correctness (Rejection = 100%):** **ACCEPTABLE**. Hard SQL metadata boundaries and distance thresholds are successfully rejecting out-of-domain queries.
- **Latency (~673ms):** **MONITOR**. ~673ms is acceptable for asynchronous generation but should be watched as corpus size increases.

## 3. Grading Baseline

**Current Metrics:**
- **Cases:** 8
- **Successful:** 7 (88% success rate)
- **Dataset Range Accuracy:** 63%
- **Successful-only Range Accuracy:** 71%
- **Score Bounds Validity:** 100%

**Issue Classification:**
- **Quality (63% Range Accuracy):** **MUST FIX BEFORE V1**. 63% strict adherence to the human grading rubric is insufficient for a production grading pipeline.
- **Reliability (88% Success Rate):** **MONITOR**. One failed final evaluation indicates occasional fragility in structured output parsing for grading.
- **Deterministic Correctness (100% Score Bounds):** **ACCEPTABLE**.

---

## 4. Regression Policy (Phase 11.10)

To ensure the AI evaluation framework remains robust without causing flaky CI failures due to live provider nondeterminism, we have established explicit regression policies categorized into **HARD GATES** and **OBSERVATIONAL** thresholds.

### Hard Gates (Blocking)
These metrics represent absolute deterministic boundaries. A failure here is an objective regression and will cause the test runner to fail `[REGRESSION]` immediately.
1. **Generation:** Schema Validity `== 100%`
2. **Generation:** Total Marks Correctness `== 100%`
3. **Generation:** Typed Fields Completion `== 100%`
4. **Grading:** Score Bounds Validity `== 100%`

### Observational Thresholds (Non-Blocking)
Because our dataset is currently small and we are evaluating a live nondeterministic API, the following metrics will report a `[WARNING]` if they fall below the target, but will *not* fail the CI build by default. 
1. **Generation:** Success Rate `>= 80%`
2. **Retrieval:** Recall@3 `>= 90%`
3. **Retrieval:** Rejection Accuracy `>= 90%`
4. **Grading:** Final Success Rate `>= 85%`
5. **Grading:** Successful-Only Range Accuracy `>= 70%`

**Strict Mode (`EVAL_STRICT=true`)**
If an engineer is explicitly tuning a prompt or altering AI behavior locally, they should invoke the runners with `EVAL_STRICT=true`. In strict mode, failing an observational threshold escalates from a `[WARNING]` to a `[REGRESSION]`, forcing the script to exit with an error. 

**Criteria for promotion:** Once the datasets scale (e.g., >100 cases) or we implement robust local proxy caching, we will promote specific observational thresholds to hard gates.

---

## 5. How to Re-Run Evaluations

To execute these metrics locally against the frozen deterministic datasets without mutating production data:

```bash
# Run Generation Baseline
npm run eval:generation

# Run Retrieval Baseline (Automatically seeds deterministic corpus)
npm run eval:retrieval

# Run Grading Baseline
npm run eval:grading
```

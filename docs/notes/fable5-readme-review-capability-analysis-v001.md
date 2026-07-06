# Fable5 README Review Capability Analysis v001

**Project:** scenes-player-kit  
**Runtime branch:** `dev`  
**Analysis date:** 2026-07-07  
**Authoring mode:** YusukeJP x AI-Collaborator  
**Document role:** Review capability analysis / Ark Project AI collaboration note

---

## 1. Executive Verdict

Fable5 is a strong candidate for README Review / Guard Audit inside Ark Project.

The key result is that Fable5 did not merely judge whether the README prose was good. It inspected how a future AI could misread the document, self-authorize work, overstate evidence, or reopen already-parked runtime mysteries.

The two reviewed README files had different document roles, and Fable5 detected different failure modes in each.

```yaml
core_result:
  root_README:
    fable5_detected:
      - "the guard document did not guard itself"
      - "no default-deny rule for unnamed branches / PRs / issues"
      - "Next Gates could be misread as standing authorization"
      - "PASS wording was stronger than the human-seal-pending evidence"

  js_README:
    fable5_detected:
      - "silent fallback loophole"
      - "deterministic claim stronger than Page003 evidence"
      - "Issue #13 close decision had no explicit human subject"
      - "audio-log.js is a runtime-affecting frozen debt, not pure debug only"
```

Conclusion:

> Fable5 can read different README types as different guard documents and detect different classes of future-AI failure.

---

## 2. Experiment Design

Two README documents were reviewed in sequence.

```yaml
experiment:
  target_A:
    file: "README.md"
    role: "Project-level root guard"
    review_mode: "Adversarial Living Review / Root README Guard Audit"

  target_B:
    file: "js/README.md"
    role: "Technical runtime map / JS guard"
    review_mode: "Adversarial Living Review / JS Runtime Guard Audit"
```

### Target A: Root README

The root README is the project entry gate.

Primary roles:

```yaml
root_README_role:
  - "Future AI entry gate"
  - "branch / PR guard"
  - "Human Seal boundary"
  - "Audio Policy"
  - "Link Policy"
  - "Do Not Touch Guard"
```

### Target B: `js/README.md`

The JS README is the runtime internals map.

Primary roles:

```yaml
js_README_role:
  - "JS runtime internals map"
  - "player-core.js boundary guard"
  - "Final MP3 / Live TTS boundary"
  - "audio-log.js boundary"
  - "future issue boundary"
```

The experiment measured whether Fable5 could change its critique according to the document type.

---

## 3. Target A: Root README Review

Fable5 correctly treated the root README as a constitution / guard document, not merely as a project introduction.

```yaml
root_review_strength:
  role_detected: "project constitution / Future AI guard"
  failure_mode_focus:
    - "self-protection"
    - "default-deny"
    - "branch / PR safety"
    - "standing authorization risk"
```

### 3.1 Self-guard gap

Fable5's strongest root README finding was:

> The guard document does not guard itself.

This was important because a future AI could treat a README cleanup task as permission to delete or weaken the root guardrails.

Resulting patch:

```markdown
- this README / root guard document
```

### 3.2 Default-deny gap

Fable5 detected that named objects were guarded, but unnamed branches, PRs, and issues inherited no rule.

This created a dangerous implicit default-allow pattern.

Resulting patch:

```markdown
Any branch, PR, or issue not named in this README is read-only by default unless the current task explicitly names it.
```

### 3.3 Standing authorization risk

Fable5 identified that a Next Gates list can be misread as permission to execute the listed work without a current task or Human Seal.

Resulting patch:

```markdown
These are queued gates, not standing authorization. Each gate still requires the current task or explicit Human Seal.
```

### 3.4 Evidence calibration

Fable5 also detected that Page003 PASS wording was too strong if Issue #13 still required human runtime seal.

Resulting patch:

```markdown
PASS — AI-led iPhone runtime observation; human seal pending via Issue #13.
```

---

## 4. Target B: `js/README.md` Review

Fable5 correctly treated `js/README.md` as a runtime boundary document, not merely a technical file map.

```yaml
js_review_strength:
  role_detected: "runtime map / implementation boundary guard"
  failure_mode_focus:
    - "silent fallback"
    - "runtime ownership model"
    - "Issue self-close risk"
    - "debug helper becoming runtime engine"
```

### 4.1 Silent fallback loophole

The strongest JS README finding concerned this type of wording:

```markdown
If Final MP3 fails before playback starts, fallback may still be allowed.
```

Fable5 flagged this as a silent fallback loophole. A future AI could read the line as permission to switch from Final MP3 to Live TTS without surfacing that substitution.

That would break the project doctrine:

> Final MP3 is harvest. Live TTS is preview.

Resulting patch:

```markdown
If Final MP3 fails before playback starts, fallback to Live TTS is permitted only if the substitution is logged and visible. Silent fallback is forbidden.
```

This was the highest-value JS README patch.

### 4.2 Deterministic claim scope

Fable5 detected that an unqualified deterministic claim exceeded the current evidence base.

The stronger form:

```markdown
Final MP3 is the deterministic harvest path.
```

was scoped to:

```markdown
Final MP3 is the deterministic harvest path on the Page003 tested path; human seal remains pending via Issue #13.
```

This aligns with Evidence or Demote.

### 4.3 Issue #13 close subject

Fable5 detected that wording like:

```markdown
Decide whether Issue #13 can close after human runtime seal.
```

left the deciding subject ambiguous. A future AI could self-assign that decision.

Resulting patch:

```markdown
YusukeJP decides whether Issue #13 can close after human runtime seal.
```

### 4.4 `audio-log.js` as frozen debt

Fable5 detected a tension in `audio-log.js` wording.

The file was described as a debug/evidence helper, but it also gates late `speechSynthesis.speak()` calls and issues delayed cancel retries. This means it is not purely passive debug documentation; it is runtime-affecting debt.

Resulting patch:

```markdown
The stop-gate and cancel-retry behavior is tolerated frozen debt: do not extend it and do not remove it without a dedicated issue and Human Seal.
```

This is more honest than pretending the boundary is pure.

---

## 5. Detection Comparison

| Evaluation axis | Root README Review | `js/README.md` Review | Judgment |
|---|---|---|---|
| Document role detection | Read as project constitution | Read as runtime boundary map | Strong |
| Future-AI misread detection | default allow / standing authorization | silent fallback / self-close | Strong |
| Evidence calibration | PASS vs human seal pending | deterministic vs Page003-only | Strong |
| Guard gap detection | self-guard missing | self-edit / root default-deny inheritance missing | Strong |
| Implementation drift prediction | branch / PR / issue operations | player-core / audio-log / TTS drift | Strong |
| Patch discipline | small guard patch | small runtime guard patch | Practical |

The important observation is that Fable5 did not repeat the same critique twice. It changed its failure-mode model according to document type.

---

## 6. Capability Scorecard

These scores are an initial Ark Project evaluation, not an objective benchmark.

```yaml
Fable5_REVIEW_SCORECARD:
  role_detection:
    score: 5
    reason: "Root document and JS subordinate document were read as different document types"

  guard_gap_detection:
    score: 5
    reason: "Detected self-guard, default-deny, silent fallback, and self-close risks"

  evidence_calibration:
    score: 5
    reason: "Scoped PASS and deterministic claims to evidence and human seal status"

  minimal_patch_discipline:
    score: 4
    reason: "Proposed minimal patches rather than broad rewrites; slightly guard-heavy tendency remains"

  overreach_control:
    score: 4
    reason: "Did not drift into code changes, but still requires ChatGPT/Human Living Review"

  ark_compatibility:
    score: 5
    reason: "Aligned with Evidence or Demote, Human Seal, and Guard First"
```

Overall provisional score:

```yaml
overall:
  score: "28 / 30"
  verdict: "S-class reviewer candidate"
```

---

## 7. What Fable5 Did Well

### 7.1 Future AI misread modeling

Fable5 reviewed the documents from the standpoint of how another AI might misread them later.

Examples:

```yaml
future_ai_misread_patterns:
  - "cleanup could delete guardrails"
  - "queued gates could become authorization"
  - "fallback may be allowed could become silent fallback"
  - "decide could make the AI the closer of Issue #13"
```

### 7.2 Evidence calibration

Fable5 consistently checked whether the prose exceeded the evidence.

Examples:

```yaml
evidence_calibration_examples:
  root:
    issue: "PASS stronger than human-seal-pending evidence"
    result: "AI-led observation / human seal pending"

  js:
    issue: "deterministic claim stronger than Page003 evidence"
    result: "Page003 tested path scope"
```

### 7.3 Hidden loophole detection

The silent fallback detection was especially valuable.

A line can be convenient and still dangerous. Fable5 is useful for finding those convenience-loophole phrases.

---

## 8. What Fable5 Might Overdo

Fable5 is a strong reviewer, but it should not be treated as the final committer.

```yaml
fable5_cautions:
  - "may prefer stronger guardrails over faster iteration"
  - "may make documents heavier if all suggestions are accepted"
  - "may require ChatGPT/Human filtering before commit"
  - "should be used for one review round, not endless deep dive"
```

Operating principle:

> Fable5 is a reviewer, not the committer.

---

## 9. Ark Project Review Gate Protocol

This experiment suggests a reusable review pattern.

### 9.1 When to use Fable5

```yaml
when_to_use_fable5:
  - "after creating a root guard document"
  - "after creating a runtime boundary document"
  - "before Human Seal on a critical README / CONTRACT / Issue template"
  - "when future-AI misreading could cause repository damage"
  - "when branch / PR / workflow / schema / runtime boundaries are involved"
```

### 9.2 When not needed

```yaml
when_not_needed:
  - "minor typo fixes"
  - "temporary notes"
  - "low-risk prose"
  - "ordinary documentation with no operational authority"
```

### 9.3 Recommended protocol

```yaml
Fable5_Review_Gate_Protocol:
  step_1:
    actor: "ChatGPT"
    action: "create the document"

  step_2:
    actor: "Fable5"
    action: "perform one Adversarial Living Review"

  step_3:
    actor: "ChatGPT"
    action: "Living Review the Fable5 output"

  step_4:
    actor: "ChatGPT + Human"
    action: "classify as no_patch / minimal_patch / reject_review"

  step_5:
    actor: "Human"
    action: "give Human Seal"

  step_6:
    actor: "ChatGPT"
    action: "commit only the minimal accepted patch"
```

Do not automatically commit Fable5's proposals.

---

## 10. Final Judgment

Fable5 is useful for Ark Project as an adversarial reviewer of critical documents.

Best uses:

```yaml
best_use:
  - "future-AI misread risk detection"
  - "default-deny gap detection"
  - "standing authorization risk detection"
  - "silent fallback / false evidence detection"
  - "claim scope calibration"
```

Final operating model:

```text
Fable5 detects risk.
ChatGPT performs Living Review.
Human gives Seal.
GitHub receives only accepted minimal patches or analysis notes.
```

Final sentence:

> Fable5 found project-guard failure modes in the root README and runtime-boundary failure modes in `js/README.md`; this makes it valuable as a one-round Adversarial Review Gate for critical Ark Project documents.

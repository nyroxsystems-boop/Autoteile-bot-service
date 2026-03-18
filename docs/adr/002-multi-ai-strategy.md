
# ADR 002: APEX Pipeline - Multi-AI Strategy (Gemini + Claude)

## Status
Accepted

## Context
Relying solely on one LLM provider for B2B OEM part resolution introduces systemic risks: single points of failure, uncompetitive pricing curves, and localized hallucination blindspots. 

## Decision
We implemented the **APEX (Adversarial Parts EXtraction)** Pipeline leveraging multiple models dynamically:
- **Primary Search Agent (Google Gemini):** Excellent at traversing the web and internal embeddings to surface initial catalog candidates quickly safely and cheaply.
- **Adversary Validator (Anthropic Claude):** Used explicitly to "grade" and dispute Gemini's decisions. Claude's logical deduction prevents catastrophic aftermarket false-positives that Gemini occasionally hallucinates.

## Consequences
- **Positive:** Accuracies jump from ~78% (Single Model) to >93% (Consensus/Debate Model). Cloud provider lock-in is broken. 
- **Negative:** Increased prompt engineering complexity. Increased token costs, mitigated by configuring Claude as a conditional fallback only when Gemini confidence < 90%.


# Runbook: General Incident Response

## Severity Levels
- **SEV-1 (Critical):** Core flows broken (WhatsApp webhooks dropping, APEX pipeline failing 100%, Database down).
- **SEV-2 (High):** Significant degradation (Dashboard slow, invoices failing occasionally).
- **SEV-3 (Medium):** Non-blocking bugs, UI glitches.

## First Response
1. **Acknowledge:** Post in Slack `#incidents` channel: "@here Investigating alert [Alert_Name]".
2. **Triaging:** 
    - Check APM (Datadog/Sentry) for sudden spike in 5xx errors.
    - Check Kubernetes metrics (`kubectl top pods -n partsunion`) for CPU/OOM Kills.
    - Test system manually (send a WhatsApp message to the Sandbox bot).
3. **Mitigation:** Focus on restoring service, NOT finding the root cause.
    - Bad deployment? Rollback immediately: `helm rollback partsunion`
    - High CPU? Force scale: `kubectl scale deploy partsunion-api --replicas=10`
4. **Post-Mortem:** Within 24 hours of SEV-1, author a blameless post-mortem document.

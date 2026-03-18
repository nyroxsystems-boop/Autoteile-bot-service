
# Runbook: Deployment & Rollback

## CI/CD Pipeline
Deployments are handled fully automatically via GitHub Actions upon merging into `main`.
Images are pushed to GitHub Container Registry (GHCR) and applied to the K8s cluster via Helm.

## Manual Rollback (Emergency)
If the automated tests passed but production is failing:

1. Identify the last known good Helm revision:
   `helm history partsunion -n production`
2. Roll back specifically to that revision:
   `helm rollback partsunion <REVISION_ID> -n production`
3. Verify recovery via Logs & APM.
4. Revert the problematic PR in GitHub so `main` matches production again.

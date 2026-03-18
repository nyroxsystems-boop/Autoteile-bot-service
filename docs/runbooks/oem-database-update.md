
# Runbook: Updating the OEM SQLite Database

## Context
The massive `oem_cross_references.sqlite` is intentionally isolated. It needs to be updated weekly/monthly from the TecAlliance/OEM data providers.

## Procedure
1. Run the ETL pipeline (Airflow or Python Script) to produce the new `.sqlite` artifact.
2. Verify checksum and schema locally: `sqlite3 test.db "PRAGMA integrity_check;"`
3. Upload to the S3 catalog bucket: `aws s3 cp new_catalog.sqlite s3://partsunion-catalogs/v2_45_0.sqlite`
4. Update the Kubernetes ConfigMap or Helm `values.yaml` to point to the new S3 key, or use init-containers to pull the latest file on boot.
5. Trigger a rolling restart of the Worker pods: `kubectl rollout restart deploy/partsunion-worker`

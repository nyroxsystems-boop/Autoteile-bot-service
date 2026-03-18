const fs = require('fs');
const path = require('path');

const k8sDir = path.join(__dirname, 'k8s', 'partsunion');
const templatesDir = path.join(k8sDir, 'templates');

fs.mkdirSync(templatesDir, { recursive: true });

// Chart.yaml
fs.writeFileSync(path.join(k8sDir, 'Chart.yaml'), `
apiVersion: v2
name: partsunion
description: A Helm chart for Partsunion B2B Platform
type: application
version: 0.1.0
appVersion: "1.0.0"
`);

// values.yaml
fs.writeFileSync(path.join(k8sDir, 'values.yaml'), `
replicaCount: 2
workerReplicaCount: 2

image:
  repository: ghcr.io/partsunion/api
  pullPolicy: IfNotPresent
  tag: "latest"

workerImage:
  repository: ghcr.io/partsunion/bot-worker
  tag: "latest"

service:
  type: ClusterIP
  port: 3000

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

pgbouncer:
  enabled: true
  poolMode: transaction
  maxClientConn: 1000

backup:
  enabled: true
  schedule: "0 2 * * *" # Every day at 2am
`);

// templates/api-deployment.yaml
fs.writeFileSync(path.join(templatesDir, 'api-deployment.yaml'), `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "partsunion.fullname" . }}-api
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "partsunion.name" . }}-api
  template:
    metadata:
      labels:
        app: {{ include "partsunion.name" . }}-api
    spec:
      containers:
        - name: {{ .Chart.Name }}-api
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: {{ .Values.service.port }}
          env:
            - name: DATABASE_URL
              {{- if .Values.pgbouncer.enabled }}
              value: "postgres://user:pass@{{ include "partsunion.fullname" . }}-pgbouncer:5432/db"
              {{- else }}
              valueFrom:
                secretKeyRef:
                  name: partsunion-secrets
                  key: database-url
              {{- end }}
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
`);

// templates/worker-deployment.yaml
fs.writeFileSync(path.join(templatesDir, 'worker-deployment.yaml'), `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "partsunion.fullname" . }}-worker
spec:
  replicas: {{ .Values.workerReplicaCount }}
  selector:
    matchLabels:
      app: {{ include "partsunion.name" . }}-worker
  template:
    metadata:
      labels:
        app: {{ include "partsunion.name" . }}-worker
    spec:
      containers:
        - name: {{ .Chart.Name }}-worker
          image: "{{ .Values.workerImage.repository }}:{{ .Values.workerImage.tag }}"
          envFrom:
            - secretRef:
                name: partsunion-secrets
`);

// templates/pgbouncer-deployment.yaml
fs.writeFileSync(path.join(templatesDir, 'pgbouncer-deployment.yaml'), `
{{- if .Values.pgbouncer.enabled -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "partsunion.fullname" . }}-pgbouncer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {{ include "partsunion.name" . }}-pgbouncer
  template:
    metadata:
      labels:
        app: {{ include "partsunion.name" . }}-pgbouncer
    spec:
      containers:
        - name: pgbouncer
          image: edoburu/pgbouncer:latest
          env:
            - name: POOL_MODE
              value: {{ .Values.pgbouncer.poolMode }}
            - name: MAX_CLIENT_CONN
              value: "{{ .Values.pgbouncer.maxClientConn }}"
{{- end -}}
`);

// templates/hpa.yaml
fs.writeFileSync(path.join(templatesDir, 'hpa.yaml'), `
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "partsunion.fullname" . }}-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "partsunion.fullname" . }}-api
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
{{- end }}
`);

// templates/cronjob-backup.yaml
fs.writeFileSync(path.join(templatesDir, 'cronjob-backup.yaml'), `
{{- if .Values.backup.enabled }}
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "partsunion.fullname" . }}-db-backup
spec:
  schedule: {{ .Values.backup.schedule | quote }}
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: pg-backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - "pg_dump $DATABASE_URL -F c -f /tmp/backup.dump && aws s3 cp /tmp/backup.dump s3://partsunion-backups/db-$(date +%Y%m%d%H%M).dump"
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: partsunion-secrets
                  key: database-url
          restartPolicy: OnFailure
{{- end }}
`);

// templates/_helpers.tpl
fs.writeFileSync(path.join(templatesDir, '_helpers.tpl'), `
{{/*
Expand the name of the chart.
*/}}
{{- define "partsunion.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "partsunion.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
`);

console.log('Helm charts generated successfully in k8s/partsunion/');

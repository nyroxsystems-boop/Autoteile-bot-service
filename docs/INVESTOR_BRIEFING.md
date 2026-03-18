# Technical Due Diligence & Investor Briefing: Partsunion
**Datum:** März 2026  
**Zielgruppe:** VCs, Förderbanken (z.B. NRW.Bank), Technical Due Diligence Auditoren  
**Fokus:** Architektur, Innovation, Security & Enterprise-Readiness  

---

## 1. Executive Summary & Vision
Partsunion ist nicht nur ein weiterer Onlineshop für Autoteile, sondern ein hochmodernes, **KI-gestütztes B2B-Procurement-OS**. Über eine Conversational Interface (WhatsApp) können Werkstätten in natürlicher Sprache, über Fotos von Fahrzeugscheinen oder direkte Sprachnachrichten Ersatzteile anfragen. Das System löst diese unstrukturierten Daten vollautomatisch auf, matcht sie mit komplexen OEM-Katalogen, vergleicht Großhändler-Preise und wickelt die Bestellung inklusive GoBD-konformer Rechnungsstellung ab. 

**Der technische USP:** Eine eigens entwickelte AI-Resolution-Engine (APEX), die das massive Problem der "Teile-Identifikation & Retouren-Vermeidung" durch den Einsatz von Multi-LLM-Konsensverfahren löst.

---

## 2. Core Innovation: Die APEX Pipeline
*Das Herzstück der Plattform. "Adversarial Parts EXtraction"*

Normale LLMs (ChatGPT) halluzinieren bei abstrakten OEM-Nummern. Um eine B2B-taugliche Genauigkeit von >95% (und Rücksendequoten unter 2%) zu erreichen, haben wir eine revolutionäre 4-Phasen-Pipeline entwickelt:

1. **Instant DB Lookup (0ms):** Ultraschnelle lokale SQLite FTS5-Suche für exakte Katalogtreffer.
2. **Gemini Search Agent (<3s):** Ein Google Gemini Agent, der das Web und interne Embeddings nach unklaren Teilen (z.B. "Handbremsseil hinten links Golf 7") durchsucht.
3. **Claude Adversary Validator (<2s):** Ein zweites, logisch überlegenes KI-Modell (Anthropic Claude), welches gezielt eingesetzt wird, um die Antworten von Gemini zu "kritisieren" und zu verifizieren. Dieses **Multi-AI-Consensus-Verfahren** eliminiert Vendor-Lock-ins und verhindert drastisch teure Fehlbestellungen.
4. **Self-Learning Flywheel:** Das System speichert verifizierte Konsens-Ergebnisse sofort in der Datenbank, sodass die KI beim nächsten Mal nicht mehr rechnen muss (Phase 1 übernimmt).

---

## 3. Enterprise Security & Compliance
*Wir haben das MVP-Stadium verlassen. Die Plattform ist rechtssicher und auditiert.*

- **GoBD- & Finanzamts-Konformität:** Rechnungen werden über relationale PostgreSQL-Sequencen extrem sicher und **lückenlos** generiert (`RE-YYYY-XXXXX`). "Hard Deletes" (das Löschen von Rechnungen) sind auf API-Ebene hart blockiert (WORM-Prinzip: Write Once, Read Many). 
- **Immutable Audit-Trail:** Jede finanzielle Transaktion oder Statusänderung wird fest in einem Audit-Log geschrieben. Manipulationen sind durch Datenbank-Trigger ausgeschlossen. Datev-Exporte existieren Out-of-the-Box.
- **DSGVO / GDPR Compliance:** Ein dedizierter DSGVO-Endpunkt erlaubt das sofortige Anonymisieren oder Abfragen (`Art. 17 & 20 DSGVO`) aller Kunden- und Fahrzeugscheindaten per Knopfdruck ("Right to be forgotten").
- **Stateless Authentication & Tenant-Isolation:** Die gesamte B2B-Plattform basiert auf streng isolierten JWT-Tokens (JSON Web Tokens). Ein Händler A kann niemals die Daten von Händler B sehen, gesichert durch Middleware am Gate.

---

## 4. Skalierbarkeit & Infrastruktur (DevOps)
*Gebaut für Skalierung auf 1000+ Tenants.*

- **Dual-Database Strategy:** Wir trennen transaktionale Systemdaten (PostgreSQL für Nutzer, Bestellungen, Auditierung) radikal von statischen Suchkatalogen. Unsere Multi-Millionen-Zeilen starken TecAlliance/OEM-Daten liegen in hoch-optimierten, lokalen SQLite-Dateien, was die Cloud-Kosten senkt und Latenzen auf 0 drückt.
- **Microservice / Kubernetes Ready:** Das Backend (Express/Node.js), der AI-Worker und das Dashboard (React/Vite) sind in Docker containerisiert und als **Helm Charts** für Enterprise-Kubernetes-Cluster (K8s) konfiguriert. 
- **Auto-Scaling & Resilience:** Das System besitzt aktive Horizontal Pod Autoscaler (HPA), die bei Last-Spitzen (z.B. wenn hunderte Werkstätten morgens über WhatsApp aktiv werden) automatisch neue Server-Instanzen hinzuschalten. Ein `pgBouncer` als Data-Pooler schützt die Datenbank dabei vor Overloads.
- **APM Tracing:** Jeder KI-Aufruf ist mit Sub-Millisekunden-genauen Performance-Spans gekapselt. Wir tracken genau, wie lange API-Aufrufe dauern und was sie uns an Token-Budgets kosten (via Datadog/Sentry).

---

## 5. Zukunft & IP (Intellectual Property)
Die Code-Basis ist hochgradig strukturiert und dokumentiert (OpenAPI 3.1 Spezifikationen für Drittanbieter, Architecture Decision Records (ADRs) und Onboarding-Guidelines). 

**Wichtig für Förderungen (z.B. NRW Innovationsförderung):**
Partsunion löst ein handfestes Wirtschaftsproblem (Ineffiziente Teilesuche, Fachkräftemangel im Vertrieb, hohe Retourenquoten durch falsche Teile) durch den Einsatz von angewandter, mehrstufiger KI (Adversarial AI). Diese Technologie ist in diesem traditionellen Marktsegment hochgradig disruptiv und grenzt sich durch den technologischen "Burggraben" der APEX-Pipeline enorm von einfachen ChatGPT-Wrappern ab.

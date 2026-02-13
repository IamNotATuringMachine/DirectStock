# AGENTS.md

Version: 2026-02-13
Gilt fuer: gesamtes Repository `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock`

## 1. Mission
Dieses Repo wird von menschlichen Entwicklern und Coding-Agents gemeinsam gepflegt.
Ziel jedes Agentenbeitrags: **korrekte, sichere, testbare, reproduzierbare Aenderungen** mit minimalem Risiko fuer Regressionen.

## 2. Non-Negotiables (immer)
1. Keine destruktiven Aktionen ohne explizite Freigabe: kein `git reset --hard`, kein `git checkout --`, kein Loeschen produktiver Daten.
2. Bestehende APIs nur **additiv** erweitern, ausser eine Breaking-Change-Freigabe liegt explizit vor.
3. DB-Schema-Aenderungen nur ueber Alembic-Migrationen.
4. Security-Basics duerfen nicht abgeschwaecht werden (Auth, RBAC, Audit, Request-ID, Error-Format).
5. Vor Abschluss immer relevante Tests/Builds ausfuehren und Ergebnisse dokumentieren.
6. Keine Secrets in Code, Commits oder Logs. `.env` bleibt lokal.

## 3. Arbeitsmodus fuer Agents (2026 Standard)
1. Kontext laden: betroffene Dateien, bestehende Kontrakte, Testlage.
2. Plan in kleinen, verifizierbaren Schritten erstellen.
3. Implementieren mit kleinen Diffs und klaren Commit-faeigen Einheiten.
4. Lokal verifizieren (mindestens betroffene Test-Suites).
5. Doku/Status aktualisieren, wenn Verhalten, API oder Betriebsablauf geaendert wurde.
6. Ergebnis mit Risiken, offenen Punkten und naechsten sinnvollen Schritten berichten.

## 4. Repo-Topologie
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, Auth/RBAC, Audit
- `frontend/`: React 19 + Vite 6 + TypeScript + TanStack Query + Zustand + PWA
- `nginx/`: Entry-Routing fuer `/` und `/api/*`
- `scripts/`: Seed, Legacy-Import, Lighthouse/PWA-Checks
- `docs/`: Betriebs- und Verifikationsnachweise
- `directstock_phase1.md`: Abnahmestatus/Umsetzungsstatus

## 5. Source-of-Truth fuer Kontrakte
1. Backend-Schemas (`backend/app/schemas/*`) definieren API-Response/Request-Vertraege.
2. Frontend-Typen (`frontend/src/types.ts`) muessen dazu konsistent sein.
3. Tests sind verbindlicher Teil der Spezifikation, besonders fuer Auth, RBAC, Inventory, Operations.

## 6. Build-, Test- und Runtime-Kommandos

### Dev Runtime
- `docker compose up --build`
- Optional Hot Reload: `docker compose -f docker-compose.dev.yml up --build`

### Backend lokal
- `cd backend`
- `python3 -m venv .venv && source .venv/bin/activate`
- `pip install -e .[dev]`
- `python -m pytest -q`

### Frontend lokal
- `cd frontend`
- `npm install`
- `npm run test`
- `npm run build`
- `npm run test:e2e` (gegen laufenden Stack auf `http://localhost:8080`)

### Production-Verifikation
- `docker compose -f docker-compose.prod.yml up -d --build`
- Smoke: `/health`, `/api/health`, `/api/docs`, Login
- `./scripts/lighthouse_pwa.sh` (PWA Score >= 0.90)

## 7. Architektur-Guardrails

### Backend
1. Endpunkte unter `/api/*`, Health unter `/health` und `/api/health`.
2. Fehlerformat einheitlich halten (`ApiError`: `code`, `message`, `request_id`, `details`).
3. Mutierende Endpunkte (`POST/PUT/PATCH/DELETE`) muessen Audit-Eintraege erzeugen.
4. RBAC serverseitig pruefen, nie nur im Frontend.
5. Zeitbezug in UTC.

### Datenbank
1. Fachliche Unique-Constraints beibehalten (`product_number`, Bin/Zone/Warehouse-Codes, Username, optional Email).
2. Indexe fuer Bewegungs-/Bestandsabfragen erhalten (`product_id`, `bin_location_id`, `performed_at`).
3. Migrationen vorwaerts-sicher, idempotent und reviewbar halten.

### Frontend
1. App-Shell responsiv halten, Sidebar-Collapse darf Mobile nicht brechen.
2. Kritische Flows mit stabilen `data-testid`-Attributen absichern.
3. API-Zugriff nur ueber Service-Layer (`frontend/src/services/*`).
4. PWA-UX erhalten: Install-Hinweis, Offline-Indikator, Update-Banner.

## 8. Seed/Import-Regeln
1. Seed muss idempotent und deterministisch sein.
2. Legacy-Import bleibt **fail-fast**, wenn Pflichtspalten fehlen (Exit-Code `2`).
3. Positiver Referenzpfad fuer valides Fixture muss idempotenten Upsert nachweisen.

## 9. Definition of Done (DoD)
Eine Aufgabe gilt nur als fertig, wenn:
1. Implementierung abgeschlossen und lauffaehig ist.
2. Relevante Tests gruen sind.
3. Keine offensichtlichen Contract-Breaks bestehen.
4. Doku aktualisiert ist (`README.md`, ggf. `directstock_phase1.md`, `docs/*`).
5. Betriebsrelevante Schritte reproduzierbar beschrieben sind.

## 10. Minimaler Abschlussbericht je Agent-Task
Jeder Agent liefert am Ende:
1. Geaenderte Dateien.
2. Was funktional geaendert wurde.
3. Ausgefuehrte Verifikation inkl. Resultaten.
4. Bekannte Rest-Risiken/offene Punkte.
5. Optional: naechste 1-3 sinnvolle Schritte.

## 11. Git- und Review-Disziplin
1. Kleine, thematisch klare Diffs bevorzugen.
2. Keine "drive-by" Refactors ausser direkt erforderlich.
3. Keine toten TODOs ohne Ticket/Context.
4. Bei Unsicherheit ueber fachliche Regeln: Annahmen explizit machen statt stillschweigend raten.

## 12. Performance- und Zuverlaessigkeits-Baseline
1. N+1 Queries vermeiden (gezielte Joins/Prefetching).
2. Teure Listen-Endpunkte paginierbar halten.
3. Frontend-Ladezustaende und Fehlerpfade sichtbar machen.
4. Build-Warnungen nicht ignorieren, wenn sie Laufzeit- oder Bundle-Risiken anzeigen.

## 13. Security- und Compliance-Baseline
1. Passwort-Hashing via bcrypt/passlib unveraendert sicher halten.
2. JWT Claims/TTL nicht aufweichen ohne explizite Freigabe.
3. Input validieren (Pydantic/TypeScript), Output escapen wo noetig.
4. Abhaengigkeiten nur minimal und begruendet erweitern.

---
Bei Konflikten gilt: Sicherheit und Datenintegritaet vor Geschwindigkeit.

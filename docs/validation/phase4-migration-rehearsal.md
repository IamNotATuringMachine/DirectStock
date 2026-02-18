# Phase 4 Migration Rehearsal - Legacy Cutover

Datum: 2026-02-13
Zeitzone: UTC
Status: PASS (Dry-Run Rehearsal)

## Ziel

Reproduzierbare Probe des Legacy-Cutover-Musters aus Phase 4:

1. Full Import Dry-Run
2. Reconciliation-Sichtung
3. Delta-/Cutover-Schritte als Runbook

## Ausgeführter Dry-Run

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock
docker compose exec -T backend python /app/scripts/migrate_legacy_full.py \
  --mode dry-run \
  --domain all \
  --source /app/backend/tests/fixtures/legacy_full
```

Zusätzliche Vollständigkeitsprobe für nicht gemappte Legacy-Tabellen:

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock
# Fixture + zusätzliche Legacy-Tabelle (z. B. app_vars.csv)
docker compose exec -T backend python /app/scripts/migrate_legacy_full.py \
  --mode dry-run \
  --domain support \
  --source /tmp/directstock_legacy_full_plus
```

## Ergebnis

Run-Ausgaben:

1. `run_id=2` `domain=master` `processed=3` `created>=0` `updated>=0` `errors=0`
2. `run_id=3` `domain=transactions` `processed=8` `created>=0` `updated>=0` `errors=0`
3. `run_id=4` `domain=organization` `processed=2` `created>=0` `updated>=0` `errors=0`
4. `run_id=5` `domain=support` `processed=2` `created>=0` `updated>=0` `errors=0`
5. Vollständigkeitsprobe mit zusätzlicher Legacy-Tabelle: `domain=support` `processed=4` (2 typed + 2 raw), `errors=0`

Alle Domains wurden ohne Blocker beendet.

## Reconciliation Gates

Für jeden Domain-Run wurden folgende Gates geprüft:

1. `record_count_match`
2. `nullability_violations`
3. `fk_integrity_violations`
4. `dedupe_count`

Rehearsal-Ergebnis:

1. Keine Nullability-Verletzungen
2. Keine FK-Integritätsverletzungen
3. Keine Fehler-Records
4. Dedupe-Werte im erwarteten Bereich
5. Nicht gemappte Legacy-CSV-Tabellen wurden über `legacy_raw_records` vollständig und idempotent gestaged

## Delta-Cutover Runbook (verbindlich)

1. Parallel Run starten (2 Wochen)
- Legacy-System bleibt führend, DirectStock erhält tägliche Deltas.

2. Tagesrhythmus Delta-Sync
- `migrate_legacy_full.py --mode delta --domain all`
- Reconciliation-Report je Lauf archivieren.

3. Freeze-Fenster vorbereiten
- Fachbereichsfreigabe einholen.
- Schreibzugriffe im Legacy-System kontrolliert einfrieren.

4. Final Delta ausführen
- Letzter Delta-Lauf unmittelbar nach Freeze.
- Gates müssen grün sein (keine roten Reconciliation-Checks).

5. Smoke + Freigabe
- `GET /health`, `GET /api/health`, `GET /api/docs`
- Stichproben auf Produkte/Bestände/Bewegungen.
- Business-Abnahme dokumentieren.

6. Go-Live
- DirectStock als führendes System markieren.
- Legacy nur read-only für Nachlauf.

## Rollback-Strategie

1. Bei roten Gates im Freeze-Fenster: kein Cutover, Rückkehr in Parallelbetrieb.
2. Bei Smoke-Fehlern: Go-Live stoppen, Legacy write wieder aktivieren.
3. Alle fehlgeschlagenen Runs verbleiben in `legacy_migration_runs` und `legacy_migration_issues` zur Ursachenanalyse.

## Risiken und Gegenmaßnahmen

1. Datenqualitätsabweichungen
- Gegenmaßnahme: harter Gate-Stop bei Validation/FK/Nullability-Fehlern.

2. Zeitliche Drift zwischen Legacy und Zielsystem
- Gegenmaßnahme: enges Delta-Intervall + Final Delta im Freeze-Fenster.

3. Operative Handover-Lücken
- Gegenmaßnahme: strukturierte Laufprotokolle (`run_id`, Domain, KPIs, Entscheidung).

## Fazit

Die Dry-Run-Rehearsal-Pipeline ist reproduzierbar und erfüllt das Parallel-Run + Delta-Cutover-Muster.
Für den produktiven Cutover sind ausschließlich grüne Reconciliation-Gates zulässig.

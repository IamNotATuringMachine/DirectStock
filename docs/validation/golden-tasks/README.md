# Golden Tasks (LLM 9/10 Gate)

Diese Golden Tasks sind der reproduzierbare Referenzsatz für autonome Agentenarbeit.

## Regeln
1. Jede Aufgabe hat einen deterministischen Command.
2. "First-pass success" heißt: Command läuft ohne manuelle Nacharbeit grün.
3. Zielschwelle: `>= 90%` erfolgreiche Tasks pro Lauf.
4. Mode `smoke` ist PR-/Nightly-tauglich; `full` ist die verschärfte Variante.

## Ausführung
```bash
./scripts/run_golden_tasks.sh
GOLDEN_TASK_MODE=full ./scripts/run_golden_tasks.sh
```

## Artefakte
1. Report: `docs/validation/metrics/golden-tasks-latest.md`
2. Logs: `docs/validation/metrics/golden-task-logs/*.log`

# Security and Data-Integrity Gates (Wave 8A)

## Required checks
1. Dependency audit: `pip-audit`
2. Static security scan: `bandit -lll`
3. Secret scan: `gitleaks detect`
4. Mutation integrity guard: `./scripts/check_mutation_integrity.py`
5. Regression tests:
   - `backend/tests/test_idempotency_regressions_phase6.py`
   - `backend/tests/test_audit_mutations_phase6.py`

## Unified command
```bash
./scripts/check_security_gates.sh
```

## Local prerequisite (gitleaks)
Use the helper to install the pinned version:

```bash
./scripts/install_gitleaks.sh
```

Then run full parity with CI (no bypass):

```bash
RUN_GITLEAKS=1 ./scripts/check_security_gates.sh
```

## CI policy
- These checks run as mandatory gates in CI.
- High-severity findings block merge.
- Secret scanning uses working-tree mode (`gitleaks --no-git`) to keep local and CI results deterministic.
- Path exclusions for local dependency folders are maintained in `.gitleaks.toml`.

## Waiver process
A temporary waiver must include:
1. Finding ID and short rationale.
2. Risk owner.
3. Expiration date (mandatory).
4. Linked remediation task.

Waivers without expiry are invalid.

Template:
1. Finding ID: `<tool-id>`
2. Owner: `<name/team>`
3. Expiry: `YYYY-MM-DD`
4. Ticket: `<tracker-link>`
5. Rationale: `<short-risk-acceptance>`

## Current temporary waiver
- `CVE-2024-23342` (`ecdsa` transitive via `python-jose`), currently tracked via
  `PIP_AUDIT_IGNORE` default in `scripts/check_security_gates.sh` until an upstream fixed version is available.

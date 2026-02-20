# Standard Commands

## Dev
```bash
docker compose up --build
docker compose -f docker-compose.dev.yml up --build
```

## Backend Tests
```bash
cd backend && python -m pytest -q
```

## Frontend Tests
```bash
cd frontend && npm run test
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:raw
```

## Dead Code Detection
```bash
cd frontend && npm run knip
```

## Agent Governance
```bash
./scripts/agent_governance_check.sh
python3 scripts/agent_policy_lint.py --strict --provider all --format json
python3 scripts/check_provider_capabilities.py --provider all --format json
```

## Production
```bash
docker compose -f docker-compose.prod.yml up -d --build
./scripts/lighthouse_pwa.sh
```

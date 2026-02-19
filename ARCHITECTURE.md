# ARCHITECTURE.md

> Quick-reference architecture overview for LLM agents and developers.

## System Overview

```mermaid
graph TB
    subgraph Client
        Browser["Browser / PWA"]
    end

    subgraph Nginx["Nginx Reverse Proxy"]
        FrontRoute["/ → Frontend"]
        ApiRoute["/api/* → Backend"]
    end

    subgraph Frontend["Frontend (React 19 + Vite 7)"]
        App["App Shell"]
        Pages["Domain Pages"]
        Services["API Services"]
        Store["Zustand Store"]
        OfflineQ["Offline Queue"]
    end

    subgraph Backend["Backend (FastAPI + SQLAlchemy 2.x)"]
        Routers["Router Layer"]
        ServicesB["Service Layer"]
        Schemas["Pydantic Schemas"]
        Auth["Auth / RBAC / JWT"]
        Audit["Audit + Idempotency"]
    end

    subgraph Data["Data Layer"]
        Postgres["PostgreSQL"]
        Alembic["Alembic Migrations"]
    end

    Browser --> Nginx
    FrontRoute --> App
    ApiRoute --> Routers
    App --> Pages
    Pages --> Services
    Pages --> Store
    Services --> OfflineQ
    Services --> ApiRoute
    Routers --> ServicesB
    ServicesB --> Schemas
    Routers --> Auth
    ServicesB --> Audit
    ServicesB --> Postgres
    Alembic --> Postgres
```

## Key Boundaries

| Boundary | Rule |
|---|---|
| Frontend → Backend | All API calls go through `frontend/src/services/*` |
| Router → Service | Routers are orchestration only; business logic lives in services |
| Schema ↔ Types | `backend/app/schemas/*` must stay in sync with `frontend/src/types.ts` |
| Mutations | Must have RBAC check + audit log + idempotency (`X-Client-Operation-Id`) |
| Offline | All mutations queue through `offlineQueue.ts` when offline |

## Module Map

### Backend (`backend/app/`)

| Layer | Path | Purpose |
|---|---|---|
| Entrypoint | `main.py` | FastAPI app setup, middleware, startup |
| Routers | `routers/*.py` | HTTP endpoints, request validation |
| Services | `services/*.py` | Business logic, DB queries |
| Schemas | `schemas/*.py` | Pydantic models (API contract) |
| Models | `models/*.py` | SQLAlchemy ORM models |
| Auth | `dependencies.py` | JWT decode, RBAC guards |
| Migrations | `alembic/versions/*.py` | DB schema changes |

### Frontend (`frontend/src/`)

| Layer | Path | Purpose |
|---|---|---|
| Shell | `App.tsx`, `AppLayout.tsx` | Routing, layout, auth gate |
| Pages | `pages/*.tsx` | Domain UI containers (<350 LOC) |
| Services | `services/*.ts` | Axios-based API clients |
| Types | `types.ts`, `types/*.ts` | TypeScript interfaces |
| Routing | `routing/*.ts` | Route definitions, access control |
| Store | `stores/*.ts` | Zustand state management |
| Offline | `offlineQueue.ts` | Mutation queue for PWA |

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS | 4 |
| State | Zustand | 5 |
| Data fetching | TanStack Query | 5 |
| Backend framework | FastAPI | latest |
| ORM | SQLAlchemy | 2.x |
| Database | PostgreSQL | latest |
| Migrations | Alembic | latest |
| Reverse proxy | Nginx | latest |
| Testing (FE) | Vitest + Playwright | latest |
| Testing (BE) | pytest | latest |
| Container | Docker Compose | latest |

## Data Flow

```mermaid
sequenceDiagram
    participant U as User / PWA
    participant FE as Frontend
    participant OQ as Offline Queue
    participant NG as Nginx
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: User action
    FE->>FE: Zustand state update
    alt Online
        FE->>NG: API request (/api/*)
        NG->>BE: Proxy to FastAPI
        BE->>BE: RBAC + Auth check
        BE->>DB: Query / Mutate
        DB-->>BE: Result
        BE->>BE: Audit log (mutations)
        BE-->>NG: JSON response
        NG-->>FE: Forward response
    else Offline
        FE->>OQ: Queue mutation
        OQ-->>FE: Queued confirmation
        Note over OQ: Replays when online
    end
    FE-->>U: UI update
```

## Agent Navigation

For quick navigation, use these resources:
- **Entrypoints**: `docs/agents/entrypoints/*.md` — per-module navigation
- **Repo index**: `docs/agents/repo-index.json` — machine-readable file map
- **Context packs**: `docs/agents/context-packs/*.md` — domain context bundles
- **Repo map**: `docs/agents/repo-map.md` — structural overview
- **Workflows**: `.agents/workflows/*.md` — step-by-step recipes

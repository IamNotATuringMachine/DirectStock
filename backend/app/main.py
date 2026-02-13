from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.middleware.audit import AuditMiddleware
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_id import RequestIDMiddleware
from app.routers.alerts import router as alerts_router
from app.routers.auth import router as auth_router
from app.routers.customers import router as customers_router
from app.routers.dashboard import router as dashboard_router
from app.routers.inventory import router as inventory_router
from app.routers.inventory_counts import router as inventory_counts_router
from app.routers.operations import router as operations_router
from app.routers.product_settings import router as product_settings_router
from app.routers.products import router as products_router
from app.routers.purchasing import router as purchasing_router
from app.routers.reports import router as reports_router
from app.routers.suppliers import router as suppliers_router
from app.routers.users import router as users_router
from app.routers.warehouses import router as warehouses_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(products_router)
app.include_router(product_settings_router)
app.include_router(suppliers_router)
app.include_router(customers_router)
app.include_router(purchasing_router)
app.include_router(reports_router)
app.include_router(alerts_router)
app.include_router(warehouses_router)
app.include_router(inventory_router)
app.include_router(inventory_counts_router)
app.include_router(operations_router)
app.include_router(dashboard_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
async def api_health() -> dict[str, str]:
    return {"status": "ok"}

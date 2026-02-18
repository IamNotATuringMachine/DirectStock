from app.services.carriers.base import CarrierAdapter
from app.services.carriers.dhl import DhlCarrierAdapter
from app.services.carriers.dhl_express import DhlExpressCarrierAdapter
from app.services.carriers.dpd import DpdCarrierAdapter
from app.services.carriers.ups import UpsCarrierAdapter


def get_carrier_adapter(carrier: str) -> CarrierAdapter:
    normalized = carrier.strip().lower()
    if normalized == "dhl":
        return DhlCarrierAdapter()
    if normalized == "dhl_express":
        return DhlExpressCarrierAdapter()
    if normalized == "dpd":
        return DpdCarrierAdapter()
    if normalized == "ups":
        return UpsCarrierAdapter()
    raise ValueError(f"Unsupported carrier: {carrier}")

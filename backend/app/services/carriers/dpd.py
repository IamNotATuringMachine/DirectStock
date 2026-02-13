from app.services.carriers.sandbox_stub import SandboxCarrierAdapter


class DpdCarrierAdapter(SandboxCarrierAdapter):
    def __init__(self):
        super().__init__("dpd")

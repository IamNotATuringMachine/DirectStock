from app.services.carriers.sandbox_stub import SandboxCarrierAdapter


class DhlCarrierAdapter(SandboxCarrierAdapter):
    def __init__(self):
        super().__init__("dhl")

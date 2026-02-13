from app.services.carriers.sandbox_stub import SandboxCarrierAdapter


class UpsCarrierAdapter(SandboxCarrierAdapter):
    def __init__(self):
        super().__init__("ups")

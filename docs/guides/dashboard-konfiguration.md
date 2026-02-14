# Guide: Dashboard Konfiguration

## Ziel
Dashboard-Cards sind pro Benutzer konfigurierbar und pro Rolle serverseitig eingeschraenkt.

## Endpunkte
1. `GET /api/dashboard/cards/catalog`
2. `GET /api/dashboard/config/me`
3. `PUT /api/dashboard/config/me`
4. `GET /api/dashboard/config/roles/{role_id}`
5. `PUT /api/dashboard/config/roles/{role_id}`

## Regeln
1. Unbekannte Cards liefern `422 validation_error`.
2. Nicht erlaubte Cards duerfen nicht gesetzt werden (`422`).
3. Locked-Cards duerfen nicht ausgeblendet werden (`422`).

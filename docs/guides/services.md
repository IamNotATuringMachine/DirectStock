# Guide: Services

## Ziel
Dienstleistungen werden als eigener Katalog verwaltet und koennen in Sales/Invoice verwendet werden.

## Endpunkte
1. `GET /api/services`
2. `POST /api/services`
3. `PUT /api/services/{service_id}`
4. `DELETE /api/services/{service_id}`

## Regeln
1. Nettofuehrung, Bruttoberechnung im Backend.
2. USt nur `0`, `7`, `19`.
3. Servicepositionen erzeugen keine Lagerbewegung.

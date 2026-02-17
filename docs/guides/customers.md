# Kundenhierarchie Guide

## Zielbild
DirectStock verwaltet Kunden hierarchisch:
1. Kunde
2. Kundenstandorte
3. Ansprechpartner (optional je Standort oder zentral auf Kundenebene)

## API-Endpunkte
1. Kunden:
   - `GET /api/customers`
   - `POST /api/customers`
   - `GET /api/customers/{customer_id}`
   - `PUT /api/customers/{customer_id}`
   - `DELETE /api/customers/{customer_id}`
2. Standorte:
   - `GET /api/customers/{customer_id}/locations`
   - `POST /api/customers/{customer_id}/locations`
   - `GET /api/customers/{customer_id}/locations/{location_id}`
   - `PUT /api/customers/{customer_id}/locations/{location_id}`
   - `DELETE /api/customers/{customer_id}/locations/{location_id}`
3. Ansprechpartner:
   - `GET /api/customers/{customer_id}/contacts`
   - `POST /api/customers/{customer_id}/contacts`
   - `PUT /api/customers/{customer_id}/contacts/{contact_id}`
   - `DELETE /api/customers/{customer_id}/contacts/{contact_id}`

## Standortverknuepfung in Prozessen
Folgende Prozesse akzeptieren additiv `customer_location_id`:
1. Warenausgang (`/api/goods-issues`)
2. Verkaufsauftraege (`/api/sales-orders`)
3. Versand (`/api/shipments`)
4. Externe WA-Commands (`/api/external/v1/commands/goods-issues`)

Regel:
1. Wird nur `customer_location_id` uebergeben, setzt das Backend den passenden `customer_id` automatisch.
2. Werden beide Felder uebergeben und passen nicht zusammen, antwortet das Backend mit `409`.

## Frontend
1. Neue Stammdatenseite: `/customers`
2. Operative Seiten mit optionaler Standortauswahl:
   - `/goods-issue`
   - `/sales-orders`
   - `/shipping`

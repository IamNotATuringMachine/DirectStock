# Guide: Wareneingang + Retouren (WE/RMA erweitert)

## Ziel
Dieser Guide beschreibt den kombinierten Ablauf fuer:
- Wareneingang mit Bestellbezug, Serienpflicht je Produkt und Ad-hoc-Artikelanlage.
- Retouren-Triage mit internem/externem Reparaturpfad inklusive virtuellem Spanien-Lager.

## 1. Wareneingang (Neuware)

### 1.1 WE-Header
- Optional Bestellung verknuepfen (`purchase_order_id`).
- Wenn Bestellung gesetzt ist, muessen WE-Positionen passende `purchase_order_item_id` referenzieren.
- Nur Bestellungen mit Status `ordered` oder `partially_received` sind zulaessig.

### 1.2 Produkt-Tracking-Flag
- Produktfeld `requires_item_tracking` steuert den Prozess:
  - `false`: Kleinteil-Flow (Mengenbuchung in Ziel-Bin, keine Serienpflicht).
  - `true`: Einzelteil-Flow (Seriennummern Pflicht, Menge ganzzahlig).

### 1.3 Seriennummern + Labels
- Bei `requires_item_tracking=true`:
  - Seriennummernanzahl == Menge.
  - WE-Complete ohne Seriennummern wird mit `422` abgelehnt.
- Label-PDF je WE-Position:
  - Endpoint: `GET /api/goods-receipts/{receipt_id}/items/{item_id}/serial-labels/pdf`
  - QR-Inhalt: `DS:SN:<serial_number>`

### 1.4 Ad-hoc-Artikelanlage
- Endpoint: `POST /api/goods-receipts/{receipt_id}/ad-hoc-product`
- RBAC-Pflicht: `module.products.quick_create`.
- UI-Button ist nur sichtbar, wenn die Permission vorhanden ist.

## 2. Retouren / RMA

### 2.1 Auftrag
- Quelle erfassen:
  - `source_type`: `customer` oder `technician`
  - `source_reference`: freie Referenz (optional)

### 2.2 Triage
- `decision="repair"` erfordert `repair_mode`:
  - `internal`
  - `external`
- Bei `repair_mode="external"` wird initial `external_status="waiting_external_provider"` gesetzt.

### 2.3 Externer Reparaturpfad (Spanien)
- Dispatch:
  - Endpoint: `POST /api/return-orders/{order_id}/items/{item_id}/dispatch-external`
  - Preconditions: `decision=repair`, `repair_mode=external`, `external_status=waiting_external_provider`
  - Ergebnis:
    - Status -> `at_external_provider`
    - Dokument `external_repair_form` wird erzeugt
    - Bestand in virtuelles Spanien-Bin gebucht
- Receive:
  - Endpoint: `POST /api/return-orders/{order_id}/items/{item_id}/receive-external`
  - Payload: `target_bin_id`
  - Ergebnis:
    - Umbuchung Spanien-Bin -> Ziel-Bin
    - Status -> `ready_for_use`

## 3. Berechtigungen
- Neue Permission: `module.products.quick_create`
- Sichtbar im Rollen-Editor ueber Bootstrap-Seed.
- Admin kann die Permission dynamisch Rollen zuweisen.

## 4. Reporting
- Returns-Report erweitert um:
  - `internal_repair_items`
  - `external_repair_items`

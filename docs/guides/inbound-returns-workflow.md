# Guide: Wareneingang + Retouren (WE/RMA erweitert)

## Ziel
Dieser Guide beschreibt den kombinierten Ablauf fuer:
- Wareneingang mit Modus-Weiche (Bestellbezug vs. freier Eingang), Serienpflicht je Produkt und Ad-hoc-Artikelanlage.
- Retouren-Triage mit internem/externem Reparaturpfad inklusive virtuellem Spanien-Lager.

## 1. Wareneingang

### 1.1 Modus-Weiche
- WE-Header hat `mode` und `source_type`:
  - `mode="po"`: bestellbezogener Wareneingang.
  - `mode="free"`: freier Wareneingang.
- PO-Modus verlangt `purchase_order_id`.
- Freier Modus verbietet `purchase_order_id`.

### 1.2 Modus A: Bestellbezogener WE
- PO-Aufloesung per Nummer:
  - `GET /api/purchase-orders/resolve?order_number=...`
  - liefert PO + offene Positionen (`open_quantity`).
- Vorerfassung aus PO:
  - `POST /api/goods-receipts/from-po/{po_id}`
  - Positionen werden strikt Soll/Ist erzeugt:
    - `expected_quantity = offene Menge`
    - `received_quantity = 0`
- Wenn Bestellung gesetzt ist, muessen WE-Positionen passende `purchase_order_item_id` referenzieren.
- Nur Bestellungen mit Status `ordered` oder `partially_received` sind zulaessig.

### 1.3 Modus B: Freier WE
- `source_type` steuert die Prozesshaerte:
  - `supplier`: Neuware-Flow.
  - `technician` / `other`: Condition ist pro Position verpflichtend.
- Bei `condition != new` erfolgt beim Complete eine Quarantaene-Buchung direkt in eine Returns-/RepairCenter-Bin.
- Falls keine aktive Returns-Bin konfiguriert ist, wird der Complete mit `422` abgelehnt.

### 1.4 Produkt-Tracking-Flag
- Produktfeld `requires_item_tracking` steuert den Prozess:
  - `false`: Kleinteil-Flow (Mengenbuchung in Ziel-Bin, keine Serienpflicht).
  - `true`: Einzelteil-Flow (Seriennummern Pflicht, Menge ganzzahlig).

### 1.5 Seriennummern + Labels
- Bei `requires_item_tracking=true`:
  - Seriennummernanzahl == Menge.
  - WE-Complete ohne Seriennummern wird mit `422` abgelehnt.
- Label-PDF je WE-Position:
  - Endpoint: `GET /api/goods-receipts/{receipt_id}/items/{item_id}/serial-labels/pdf`
  - QR-Inhalt: `DS:SN:<serial_number>`
- Mengen-/Artikel-Label fuer nicht-serielle Position:
  - Endpoint: `GET /api/goods-receipts/{receipt_id}/items/{item_id}/item-labels/pdf?copies=n`
  - QR-Inhalt basiert auf `DS:ART:<product_number>`.

### 1.6 Put-away / Lagerplaetze
- Bin-Suggestions:
  - Prioritaet 1: Artikel-Standardplatz (`products.default_bin_id`).
  - Prioritaet 2: vorhandene Belegungen aus Bestand.
- Override/Neuanlage:
  - Frontend erlaubt direkte Bin-Anlage im WE-Flow (rollenbasiert).
  - API: `POST /api/zones/{zone_id}/bins`.

### 1.7 Ad-hoc-Artikelanlage
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
- Wareneingang-Endpunkte:
  - `module.goods_receipts.read` (WE lesen, Positionen lesen, Serienlabel-PDF)
  - `module.goods_receipts.write` (WE anlegen/aendern/stornieren/abschliessen, Positionen schreiben, Mengenlabel-PDF)
- Page-Zugriff Frontend:
  - `page.goods-receipt.view`
- Neue Permission: `module.products.quick_create`
- Sichtbar im Rollen-Editor ueber Bootstrap-Seed.
- Admin kann alle Permissions dynamisch Rollen oder direkt Benutzern (allow/deny) zuweisen.

## 4. API-Contract-Hinweise
- `GoodsReceiptItemResponse` enthaelt fachliche Felder fuer UI:
  - `product_number`, `product_name`, `target_bin_code`
  - `expected_open_quantity`, `variance_quantity`
- Produktvertrag liefert `default_bin_id` jetzt korrekt im `ProductResponse`.

## 5. Reporting
- Returns-Report erweitert um:
  - `internal_repair_items`
  - `external_repair_items`

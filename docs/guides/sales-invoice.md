# Guide: Sales + Invoice

## Ziel
Verkaufsauftraege mit Produkt- und Servicepositionen, Rechnungen inklusive Ueberfakturierungs-Schutz.

## Endpunkte
1. `GET/POST /api/sales-orders`
2. `POST /api/sales-orders/{order_id}/items`
3. `POST /api/sales-orders/{order_id}/delivery-note`
4. `GET/POST /api/invoices`
5. `POST /api/invoices/{invoice_id}/partial`

## Regeln
1. Lagerbewegung nur fuer Produktpositionen.
2. Teilrechnung prueft `invoiced_quantity`; Ueberfakturierung fuehrt zu `409`.
3. Lieferschein nutzt die bestehende GoodsIssue-Domaene (`document_type=delivery_note`).

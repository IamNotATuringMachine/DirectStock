# Guide: Pricing

## Ziel
Preisfuehrung ist netto, brutto wird zentral im Backend berechnet.

## Endpunkte
1. `GET /api/pricing/products/{product_id}/base-prices`
2. `POST /api/pricing/products/{product_id}/base-prices`
3. `GET /api/pricing/customers/{customer_id}/product-prices`
4. `PUT /api/pricing/customers/{customer_id}/product-prices/{product_id}`
5. `GET /api/pricing/resolve`

## Fachregeln
1. USt nur `0`, `7`, `19`.
2. Kundenpreise pro `(customer, product, currency)` ohne zeitliche Ueberlappung.
3. Konflikt bei Ueberlappung: `409`.

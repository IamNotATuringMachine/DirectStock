# Guide: Pricing

## Ziel
Preisfuehrung ist netto, brutto wird zentral im Backend berechnet.

## Frontend (Stand Produkt-Flow)
1. Artikel anlegen unter `Artikelstamm -> Neuer Artikel`.
2. Nach erfolgreicher Anlage erfolgt Redirect auf `.../products/{id}/edit?tab=pricing`.
3. Im Tab `Preise` kann ein Basispreis (Netto + USt, EUR) erfasst werden.
4. In `Produktdetails -> Stammdaten` wird der aktuell gueltige Preis (Netto/USt/Brutto) angezeigt.

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

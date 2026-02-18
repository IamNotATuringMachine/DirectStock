# Guide: Dienstleistungen im Artikelstamm

## Ziel
Dienstleistungen werden nicht mehr als eigener Katalog verwaltet.
Sie werden organisatorisch im Artikelstamm ueber Produktgruppen gepflegt.

## Vorgehen
1. Artikelstamm unter `/products` oeffnen.
2. Produktgruppe `Dienstleistungen` bei Bedarf manuell anlegen.
3. Leistungspositionen als normale Produkte in dieser Gruppe pflegen.

## Regeln
1. Es gibt keine eigene API `/api/services` mehr.
2. Verkaufsauftraege verwenden ausschliesslich Produktpositionen.
3. Preis-/USt-Logik bleibt ueber die bestehende Pricing-Domaene (`/api/pricing/*`) erhalten.

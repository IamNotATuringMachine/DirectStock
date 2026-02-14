# Guide: E-Invoice Export

## Ziel
Rechnungsexporte fuer XRechnung und ZUGFeRD inkl. Validierungsstatus.

## Endpunkte
1. `POST /api/invoices/{invoice_id}/exports/xrechnung`
2. `POST /api/invoices/{invoice_id}/exports/zugferd`

## Verhalten
1. Validierungsfehler erzeugen `422` und Exportstatus `validation_error`.
2. Erfolgreiche Exporte speichern Dokumente in der Dokumentdomaene (`document_type=xrechnung|zugferd`) und setzen Exportstatus `generated`.
3. Standardmodus ist `strict` (`EINVOICE_EN16931_VALIDATION_MODE=strict`): ohne gueltige KoSIT-Runtime (`EINVOICE_KOSIT_VALIDATOR_JAR` + `EINVOICE_KOSIT_SCENARIO`) liefern Exporte reproduzierbar `422`.
4. Optionaler Fallback ist nur explizit per `EINVOICE_EN16931_VALIDATION_MODE=builtin_fallback` aktivierbar.

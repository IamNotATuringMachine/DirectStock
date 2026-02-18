# DirectStock – Masterplan Lagerverwaltung (PWA)

> **Status:** High-Level Masterplan – keine Techstack-Entscheidungen
> **Erstellt:** 2026-02-13
> **Basis:** Simplimus-Datenbank (auftragsbearbeitung, 146 Legacy-Tabellen, SQL Server 2000)

## Umsetzungsstand Phase 5 (2026-02-14)

1. Phase-5-Module (RBAC Permissions, UI Preferences, Dashboard Config, Pricing, Sales Orders, Invoices, E-Invoice Export) sind additiv umgesetzt.
2. API-Verträge wurden additiv erweitert, inklusive `permissions` in `GET /api/auth/me` und Idempotency für `/api/sales-orders` sowie `/api/invoices`.
3. Vollvalidierung wurde durchgeführt:
   Backend `95 passed`, Frontend Unit `30 passed`, Frontend E2E `74 passed` (`4 skipped`), Lighthouse PWA `1.00`, Prod-Smoke auf `/health`, `/api/health`, `/api/docs` und Login erfolgreich.
4. Abnahme-/Nachweisdokument:
   `docs/validation/phase5-acceptance.md`

---

## 1. Stammdaten (Master Data Management)

### 1.1 Artikelstamm
- Artikelnummer, Bezeichnung, Beschreibung (Kurz-/Langtext)
- EAN / GTIN / Hersteller-Artikelnummer
- Artikelbilder (mehrere pro Artikel)
- Maßeinheiten (Stück, Karton, Palette, kg, Liter etc.) mit Umrechnungsfaktoren
- Gewicht (Brutto/Netto) und Abmessungen (L×B×H)
- Artikelkategorien und -gruppen (hierarchisch, mehrfach zuordenbar)
- Artikelattribute / Custom Fields (frei definierbar)
- Mindestbestand, Meldebestand, Maximalbestand je Lagerort
- Sicherheitsbestand (Safety Stock)
- Wiederbeschaffungszeit (Lead Time)
- Status (aktiv, gesperrt, auslaufend, archiviert)
- Zolltarifnummer / Gefahrgutklasse (falls relevant)
- Verknüpfung zu Lieferanten (1:N – Artikel kann von mehreren Lieferanten bezogen werden)
- Verknüpfung zu Stücklisten / Bausteinen (aus Legacy: `baustein`, `vkn_artikel_baustein`)

### 1.2 Lieferantenstamm
- Lieferantennummer, Firma, Ansprechpartner
- Adressen (Haupt-/Lieferadresse, Rechnungsadresse)
- Kontaktdaten (Telefon, E-Mail, Web)
- Zahlungsbedingungen, Lieferbedingungen
- Bewertung / Rating
- Lieferantenspezifische Artikelzuordnung (Preis, Lieferzeit, Mindestbestellmenge)
- Dokumente & Zertifikate

### 1.3 Kundenstamm
- Kundennummer, Firma, Ansprechpartner
- Adressen (Liefer-/Rechnungsadresse, abweichende Lieferadressen)
- Kontaktdaten
- Kundengruppen / Preisgruppen
- Zahlungs- und Lieferbedingungen
- Kreditlimit

### 1.4 Lagerstruktur (Warehouse Topology)
- **Multi-Warehouse:** Mehrere Lager / Standorte
- **Zonen:** Logische Bereiche innerhalb eines Lagers (z.B. Hochregal, Bodenlager, Kühlzone, Sperrlager, Gefahrgut)
- **Gänge / Regale / Ebenen / Fächer:** Hierarchische Lagerplatz-Struktur
- **Bin-Locations:** Eindeutige Lagerplatz-ID pro Fach (scanbar via QR-Code)
- **Bin-Typen:** Wareneingangszone, Kommissionierzone, Lagerzone, Warenausgangszone, Retourenzone, Sperrzone
- **Kapazitäten:** Max. Gewicht, Volumen, Artikelanzahl pro Lagerplatz
- **Lagerplatz-Eigenschaften:** Temperaturzone, Gefahrgut-Eignung, ABC-Zonung

---

## 2. Wareneingang (Goods Receipt / Inbound)

### 2.1 Bestellwesen / Einkauf
- Bestellvorschläge basierend auf Meldebestand und Wiederbeschaffungszeit
- Bestellanforderungen (BANF) erstellen und genehmigen
- Bestellungen an Lieferanten generieren
- Bestellstatus-Tracking (bestellt, teilgeliefert, vollständig geliefert, storniert)
- Avisierung / ASN (Advanced Shipping Notice) – erwartete Lieferungen

### 2.2 Warenannahme
- **QR-/Barcode-Scan** bei Warenannahme (Tablet-Kamera oder externer Scanner)
- Abgleich Lieferschein ↔ Bestellung (Soll/Ist-Vergleich)
- Verknüpfung WE-Beleg zu Bestellung (`purchase_order_id`) inkl. Positionsprüfung je WE-Position
- Erfassung von Über-/Unterlieferungen und Abweichungen
- Foto-Dokumentation bei Beschädigungen
- Chargen-/Seriennummern-Erfassung bei Wareneingang
- Ad-hoc-Artikelanlage direkt im WE-Dialog (RBAC-geschützt über `module.products.quick_create`)
- MHD-Erfassung (Mindesthaltbarkeitsdatum) für verderbliche Waren
- Lieferschein-Erfassung (manuell oder via Dokumenten-Upload)
- Qualitätsprüfung auslösen (bei definierten Artikeln oder Lieferanten)

### 2.2.1 Kleinteil- vs. Einzelteilverfolgung
- Produktstamm enthält Flag `requires_item_tracking` (Einzelteilverfolgung / Seriennummernpflicht)
- `requires_item_tracking = true`:
  - Menge muss ganzzahlig sein
  - Seriennummern sind beim WE Pflicht
  - Anzahl Seriennummern muss zur Menge passen
  - Serienlabel-PDF kann pro WE-Position erzeugt werden (QR-Payload `DS:SN:<serial_number>`)
- `requires_item_tracking = false`:
  - Mengenbuchung auf Ziel-Lagerplatz (Kleinteil-Flow) ohne Serienlabelpflicht

### 2.3 Einlagerung (Putaway)
- Automatische Lagerplatz-Vorschläge basierend auf:
  - Artikelgruppe / Zone
  - Verfügbare Kapazität
  - ABC-Klassifizierung (A-Artikel = schnell erreichbar)
  - Gleiche Artikel bündeln
  - FIFO/FEFO-Logik
- Manuelle Lagerplatz-Zuweisung (Override)
- **QR-Scan des Lagerplatzes** zur Bestätigung der Einlagerung
- Umbuchung auf Sperrlager bei Qualitätsproblemen
- Einlagerungsprotokoll mit Zeitstempel und Mitarbeiter

---

## 3. Bestandsführung (Inventory Management)

### 3.1 Bestandsübersicht
- Echtzeit-Bestandsanzeige pro Artikel, Lagerplatz, Zone, Lager
- Verfügbarer Bestand vs. Physischer Bestand vs. Reservierter Bestand
- Bestand in Qualitätsprüfung / Sperrbestand
- Bestand im Transit (zwischen Lagern)
- Historischer Bestandsverlauf (Zeitreihe)

### 3.2 Bestandsbewegungen
- Jede Bewegung wird protokolliert (Audit Trail)
- Bewegungsarten:
  - Wareneingang (Zugang)
  - Warenausgang (Abgang)
  - Umlagerung (innerhalb Lager / zwischen Lagern)
  - Inventurdifferenz (Korrektur)
  - Verschrottung / Entsorgung
  - Retoure (Rücknahme)
  - Umbuchung (z.B. Sperrlager ↔ Freigegebener Bestand)
- Buchungsbelege mit Referenz (Bestellung, Auftrag, Inventur etc.)

### 3.3 Chargen- & Seriennummernverwaltung
- Chargen-Tracking (Batch/Lot): Produktionsdatum, MHD, Herkunft
- Seriennummern-Tracking: Eindeutige Zuordnung pro Einzelstück
- Rückverfolgbarkeit über die gesamte Lieferkette (vom Lieferanten bis zum Kunden)
- FIFO (First In, First Out) / FEFO (First Expired, First Out) Steuerung
- Chargenrückruf-Funktionalität

### 3.4 Inventur
- **Stichtagsinventur:** Komplette Zählung zu einem Stichtag
- **Permanente Inventur:** Laufende, rollierende Zählung
- **Zyklische Inventur:** ABC-basiert (A-Artikel häufiger zählen)
- **Inventur per Scan:** QR-Code am Lagerplatz scannen → Bestand eingeben
- Zähllisten generieren und zuweisen
- Differenzprotokoll mit Soll/Ist-Vergleich
- Nachzählung bei Abweichungen über Toleranz
- Inventurbuchung und Wertanpassung
- Inventurhistorie

---

## 4. Warenausgang (Goods Issue / Outbound)

### 4.1 Auftragsmanagement
- Kundenaufträge erfassen (manuell oder via Import/Schnittstelle)
- Auftragsbestätigung mit Liefertermin-Prüfung (ATP – Available to Promise)
- Teillieferungen und Rückstände verwalten
- Auftragspriorisierung
- Auftragsstatus-Tracking (neu, in Bearbeitung, kommissioniert, versendet, abgeschlossen)

### 4.2 Kommissionierung (Picking)
- **Picklisten-Generierung** basierend auf offenen Aufträgen
- Optimierte Pickrouten (Wegoptimierung durch das Lager)
- Picking-Strategien:
  - Einzelauftrag-Picking
  - Multi-Order-Picking (Batch Picking)
  - Zonen-Picking
  - Wave Picking
- **QR-/Barcode-Scan** zur Verifizierung des gepickten Artikels
- **QR-Scan des Lagerplatzes** zur Bestätigung
- Mengeneingabe und Bestätigung am Tablet
- Fehlmengen-Handling (Teilpick, Nachlieferung)
- Pick-Bestätigung mit Zeitstempel und Mitarbeiter

### 4.3 Verpackung (Packing)
- Packstation-Workflow
- Verpackungsvorschläge (passende Kartonage)
- Gewichtskontrolle
- Packstück-Etiketten / Versandetiketten drucken
- Packliste / Lieferschein generieren

### 4.4 Versand (Shipping)
- Versandvorbereitung und Tourenplanung
- Frachtführer-Zuordnung
- Versanddokumente (Lieferschein, Rechnung, Zollpapiere)
- Sendungsverfolgung (Tracking-Nummer)
- Versandbestätigung mit Scan

---

## 5. Retouren & Reklamationen (Returns Management)

### 5.1 Retoureneingang
- Retourenanmeldung (RMA – Return Merchandise Authorization)
- **QR-Scan** bei Retoureneingang zur Identifikation
- Abgleich mit Originalauftrag / Lieferschein
- Foto-Dokumentation des Zustands
- Chargen-/Seriennummern-Prüfung
- Herkunftserfassung der Retoure: `source_type` (`customer` / `technician`) + `source_reference`

### 5.2 Retourenbearbeitung
- Qualitätsprüfung / Zustandsbewertung
- Entscheidungsworkflow:
  - Wiedereinlagerung (wenn einwandfrei)
  - Nacharbeit / Reparatur
  - Verschrottung / Entsorgung
  - Rücksendung an Lieferant
- Reparatur-Triage erweitert um `repair_mode` (`internal` / `external`)
- Externer Reparaturpfad:
  - Statusfolge `waiting_external_provider` -> `at_external_provider` -> `ready_for_use`
  - Dispatch erzeugt Reparaturformular (Dokumenttyp `external_repair_form`)
  - Bestand wird in virtuelles Lager "Lager Spanien / Reparatur extern" umgebucht
  - Rücklauf bucht aus virtuellem Spanien-Bin in Ziel-Bin zurück
- Gutschrift / Ersatzlieferung auslösen
- Retourenquote-Tracking

---

## 6. QR-Code & Scanning-System

### 6.1 QR-Code-Konzept
- **Artikeletiketten:** QR-Code enthält Artikelnummer (+ optional Charge/Seriennummer)
- **Lagerplatzetiketten:** QR-Code enthält eindeutige Lagerplatz-ID
- **Behälter-/Palettenetiketten:** QR-Code für Transporteinheiten
- **Dokumenten-QR:** Lieferschein-Nr., Auftrags-Nr. etc.
- QR-Code-Generierung direkt im System (Druck auf Etikettendrucker)
- QR-Code-Format: Standardisiert, maschinenlesbar, mit Fallback auf Klartext

### 6.2 Scan-Funktionen (PWA)
- **Tablet-Kamera-Scan:** Integrierter QR-/Barcode-Scanner in der PWA
- **Externer Scanner-Support:** Bluetooth-Scanner, USB-Scanner (Tastatur-Emulation)
- Kontinuierlicher Scan-Modus (Batch-Erfassung ohne Unterbrechung)
- Scan-Feedback: Visuell (grün/rot), akustisch (Beep/Fehler-Ton), haptisch (Vibration)
- Offline-Scan-Fähigkeit mit Synchronisation bei Verbindung

### 6.3 Scan-gestützte Prozesse
- Wareneingang: Artikel scannen → Menge eingeben → Lagerplatz scannen
- Kommissionierung: Lagerplatz scannen → Artikel scannen → Menge bestätigen
- Umlagerung: Quell-Lagerplatz scannen → Artikel scannen → Ziel-Lagerplatz scannen
- Inventur: Lagerplatz scannen → Artikel scannen → Bestand eingeben
- Warenausgang: Auftrag scannen → Artikel scannen → Versandbestätigung
- Retoure: RMA scannen → Artikel scannen → Zustandserfassung

---

## 7. Alerts, Benachrichtigungen & Automatisierung

### 7.1 Bestandswarnungen
- **Meldebestand unterschritten** → Benachrichtigung + optionaler Bestellvorschlag
- **Mindestbestand unterschritten** → Kritische Warnung
- **Maximalbestand überschritten** → Hinweis auf Überbestand
- **Nullbestand** → Sofort-Alert
- MHD-Warnung (Ablaufdatum in X Tagen)
- Langsamdreher-Warnung (kein Abgang seit X Tagen)

### 7.2 Prozesswarnungen
- Offene Wareneingänge ohne Einlagerung
- Überfällige Kommissionierungen
- Lieferverzug bei Bestellungen
- Inventurdifferenzen über Toleranz
- Offene Retouren ohne Bearbeitung

### 7.3 Benachrichtigungskanäle
- In-App Notifications (Push-Benachrichtigungen via PWA)
- E-Mail-Benachrichtigungen
- Dashboard-Widgets mit Live-Alerts
- Konfigurierbare Eskalationsstufen

### 7.4 Automatisierung
- Automatische Bestellvorschläge bei Meldebestand-Unterschreitung
- Automatische ABC-Klassifizierung (periodisch neu berechnet)
- Automatische FIFO/FEFO-Steuerung bei Kommissionierung
- Automatische Lagerplatz-Vorschläge bei Einlagerung
- Regelbasierte Workflows (z.B. bei Wareneingang → automatisch Qualitätsprüfung für bestimmte Lieferanten)

---

## 8. Reporting, Analyse & Dashboard

### 8.1 Dashboard (Startseite)
- Bestandsübersicht (Gesamtwert, Artikelanzahl, Auslastung)
- Offene Wareneingänge / Warenausgänge
- Kritische Bestände (unter Meldebestand)
- Heutige Aktivitäten (Eingänge, Ausgänge, Umlagerungen)
- Top-Artikel nach Bewegung
- Lagerplatz-Auslastung (visuell)

### 8.2 Standard-Reports
- **Bestandsreport:** Aktueller Bestand pro Artikel/Lager/Zone
- **Bewegungsjournal:** Alle Buchungen in Zeitraum
- **Wareneingangsstatistik:** Eingänge nach Lieferant, Artikel, Zeitraum
- **Warenausgangsstatistik:** Ausgänge nach Kunde, Artikel, Zeitraum
- **Inventurbericht:** Differenzen, Korrekturen
- **Retourenreport:** Retourenquote, Gründe, Trends
- **Lieferanten-Performance:** Liefertreue, Qualität, Durchlaufzeit
- **Lagerplatz-Nutzung:** Belegung, Leerplätze, Hotspots
- **Verfallsreport:** Artikel mit ablaufendem MHD
- **ABC-Analyse:** Klassifizierung nach Umsatz/Bewegung

### 8.3 KPIs (Key Performance Indicators)
- Lagerumschlagshäufigkeit (Inventory Turnover)
- Durchschnittlicher Lagerbestand
- Bestandsreichweite (Days of Supply)
- Lieferbereitschaft / Servicelevel
- Dock-to-Stock-Time (Zeit vom Wareneingang bis Einlagerung)
- Order Cycle Time (Zeit von Auftrag bis Versand)
- Pick-Genauigkeit (Pick Accuracy Rate)
- Kommissionierleistung (Picks pro Stunde)
- Lagerplatz-Auslastung (%)
- Retourenquote
- Bestandsgenauigkeit (nach Inventur)
- Schwund / Verlustquote

### 8.4 Analyse-Funktionen
- Zeitraumvergleiche (Monat/Quartal/Jahr)
- Trend-Analysen
- Filterfunktionen (nach Artikel, Artikelgruppe, Lager, Lieferant, Kunde)
- Export (CSV, PDF, Excel)
- Drill-Down von Dashboard in Detail-Reports

---

## 9. Benutzerverwaltung & Rollen (RBAC)

### 9.1 Benutzerverwaltung
- Benutzerregistrierung und -verwaltung
- Profil mit Name, E-Mail, Abteilung, Standort
- Login / Logout mit Session-Management
- Passwort-Policy und Passwort-Reset
- Optionale Zwei-Faktor-Authentifizierung (2FA)
- Benutzer sperren / aktivieren

### 9.2 Rollen & Berechtigungen
- **Vordefinierte Rollen:**
  - Administrator (Vollzugriff)
  - Lagerleiter (alle operativen Funktionen + Reports)
  - Lagermitarbeiter (Wareneingang, Kommissionierung, Umlagerung, Inventur)
  - Einkauf (Bestellwesen, Lieferanten, Wareneingang)
  - Versand (Warenausgang, Versand, Retouren)
  - Controller (Reports, Dashboards, nur-lesend)
  - Auditor (Nur-Lesen auf alles + Audit-Log)
- **Custom Roles:** Frei definierbare Rollen mit granularen Berechtigungen
- Berechtigungen auf Modul-Ebene (Lesen, Erstellen, Bearbeiten, Löschen)
- Berechtigungen auf Lager-/Standort-Ebene (User sieht nur sein Lager)

### 9.3 Audit Trail
- Lückenlose Protokollierung aller Aktionen (Wer, Was, Wann, Wo)
- Änderungshistorie auf Feldebene (alter Wert → neuer Wert)
- Unveränderliches Log (kein Löschen möglich)
- Filterbarer Audit-Log (nach Benutzer, Zeitraum, Modul, Aktion)
- Compliance-relevant: GoBD-Konformität (Grundsätze ordnungsmäßiger Buchführung)

---

## 10. PWA & Mobile-spezifische Features

### 10.1 Progressive Web App
- Installierbar auf Tablet und Smartphone (Add to Homescreen)
- Responsive Design optimiert für Tablet (10-12 Zoll Hauptzielgerät)
- Offline-Fähigkeit (kritische Funktionen ohne Netzwerk nutzbar)
- Background-Sync bei Wiederherstellung der Verbindung
- Push-Notifications (auch bei geschlossener App)

### 10.2 Tablet-optimierte Bedienung
- Große Touch-Targets (Buttons, Eingabefelder)
- Wisch-Gesten für häufige Aktionen
- Schnellzugriff-Leiste für Scan-Funktionen
- Split-Screen-Support (z.B. Pickliste links, Scanner rechts)
- Landscape- und Portrait-Modus
- Dark Mode / High-Contrast für Lagerumgebung

### 10.3 Offline-Funktionalität
- Artikelstamm lokal gecached
- Scan-Erfassungen offline puffern
- Inventurzählungen offline durchführen
- Konfliktlösung bei Sync (optimistic locking)
- Offline-Indikator in der UI

---

## 11. Schnittstellen & Integration

### 11.1 Legacy-Datenübernahme
- Migration der Simplimus/auftragsbearbeitung-Datenbank (146 Tabellen)
- Datenbereinigung und -mapping auf neue Strukturen
- Übernahme relevanter Stammdaten:
  - `kunde` → Kundenstamm
  - `produkte` / `artikel` → Artikelstamm
  - `lieferanten` → Lieferantenstamm
  - `produktgruppen` → Artikelkategorien
  - `vorgang` / `vorgang_details` → Historische Aufträge
  - `adminuser` / `admin_gruppen` / `admin_permissions` → Benutzerverwaltung
  - `preise` → Preisstrukturen
- Validierung und Datenqualitätsprüfung nach Migration

### 11.2 Import / Export
- CSV/Excel-Import für Massenaktualisierungen (Artikelstamm, Bestände, Preise)
- CSV/Excel-Export für alle Listen und Reports
- PDF-Export für Dokumente (Lieferschein, Bestellungen, Inventurlisten)
- Etikettendruck-Export (QR-Codes, Artikeletiketten)

### 11.3 API (Zukunftssicher)
- RESTful API für Integration mit externen Systemen
- Mögliche Integrationen:
  - ERP-System
  - Buchhaltung / DATEV
  - Webshop / E-Commerce
  - Versanddienstleister (DHL, DPD, UPS etc.)
  - Lieferanten-Portale (EDI / Punchout)

---

## 12. Dokumentenmanagement

### 12.1 Systemdokumente
- Lieferscheine (eingehend & ausgehend)
- Bestellungen / Auftragsbestätigungen
- Rechnungen
- Inventurlisten / Zählprotokolle
- Retourenbelege / RMA-Dokumente
- Packlisten / Versandetiketten

### 12.2 Dokumenten-Ablage
- Upload und Verknüpfung von Dokumenten zu Artikeln, Lieferanten, Aufträgen
- Versionierung
- Vorlagen-Management (Templates für Lieferschein, Etikett etc.)
- Druck-Integration (Etikettendrucker, A4-Drucker)

---

## 13. Systemadministration & Konfiguration

### 13.1 Grundkonfiguration
- Firmendaten / Standortdaten
- Nummernkreise (Artikel, Aufträge, Lieferscheine etc.)
- Maßeinheiten-Verwaltung
- Währungsverwaltung
- Steuersätze
- Feiertage / Betriebskalender

### 13.2 Workflow-Konfiguration
- Genehmigungs-Workflows (z.B. Bestellfreigabe ab bestimmtem Wert)
- Status-Workflows konfigurierbar (z.B. Wareneingang-Prozess)
- Automatisierungsregeln (Trigger → Aktion)
- E-Mail-Templates für Benachrichtigungen

### 13.3 Datensicherung & Wartung
- Automatische Backups
- Datenarchivierung (alte Bewegungen, abgeschlossene Aufträge)
- System-Health-Monitor
- Fehlerprotokoll / System-Log

---

## 14. Datenmigrations-Strategie (aus Simplimus)

### Phase 1: Kern-Stammdaten (MVP-relevant)
- Kunden (`kunde`, `ab_anschriften`)
- Artikel/Produkte (`produkte`, `artikel`, `baustein`)
- Artikelgruppen (`produktgruppen`, `vkn_produkt_produktgruppe`)
- Lieferanten (`lieferanten`, `vkn_artikel_lieferant`)

### Phase 2: Transaktionsdaten
- Aufträge (`vorgang`, `vorgang_details`)
- Lieferungen/Rechnungen (`lieferung_rechnung`, `lrvorgang`)
- Preise (`preise`)

### Phase 3: Organisationsdaten
- Benutzer (`adminuser`, `admin_gruppen`, `admin_profiles`)
- Berechtigungen (`admin_permissions`, `benutzergruppen`)
- Projekte (`projekte`)

### Phase 4: Unterstützende Daten
- Texte/Beschreibungen (`texte`, `texts`, `zusatztext`)
- Status-Definitionen (`status`, `ab_status`, `lrstatus`)
- Konfiguration (`app_vars`, `basic_vars`)

> **Hinweis:** Die Datenbank liegt als SQL Server 2000 Backup vor (82 MB). Extrahierte CSV-Dateien und eine SQLite-Version existieren bereits im LLMRAG-Projekt. Ein modernes PostgreSQL-Schema (`MODERN_SCHEMA_PROPOSAL.sql`) mit Feld-Mapping (`MIGRATION_MAPPING.md`) ist ebenfalls vorhanden.

---

## 15. Feature-Priorisierung (vorgeschlagene Phasen)

### MVP (Phase 1) – Kernfunktionen
1. Artikelstamm-Verwaltung
2. Lagerstruktur (Lager, Zonen, Lagerplätze)
3. QR-Code-Scanning (Kamera + externer Scanner)
4. Wareneingang mit Scan-Workflow
5. Bestandsübersicht (Echtzeit)
6. Warenausgang mit Scan-Workflow
7. Einfache Umlagerung
8. Basis-Dashboard
9. Benutzerverwaltung (Login, Rollen: Admin, Lagermitarbeiter)
10. PWA-Grundfunktionalität (installierbar, responsive)

### Phase 2 – Erweiterter Betrieb
11. Chargen-/Seriennummern-Tracking
12. Inventur (Stichtag + permanent)
13. Bestellwesen / Einkauf
14. Lieferantenstamm
15. Kundenstamm
16. Erweiterte Reports & KPIs
17. Alert-System (Meldebestand, MHD)
18. Offline-Modus

### Phase 3 – Optimierung & Automatisierung
19. ABC-Analyse & automatische Klassifizierung
20. Automatische Bestellvorschläge
21. Kommissionier-Optimierung (Wegoptimierung, Batch-Picking)
22. Retouren-Management
23. Vollständiger Audit Trail
24. Erweiterte Workflows & Genehmigungen
25. Dokumentenmanagement

### Phase 4 – Integration & Skalierung
26. REST-API für externe Systeme
27. Legacy-Datenmigration (Simplimus-Komplett)
28. Versanddienstleister-Anbindung
29. Multi-Warehouse mit übergreifenden Umlagerungen
30. Erweiterte Analyse (Trends, Prognosen)

### Phase 5 – Monetarisierung, Governance & UX
31. Darkmode / Theme-System mit persistenter Benutzerpräferenz
32. Dynamisches RBAC (Custom Roles + Page/Action-Berechtigungen)
33. Produktpreise mit und ohne Mehrwertsteuer (netto-führend, brutto berechnet)
34. Kundenspezifische Preise mit Gültigkeitszeiträumen
35. Auftrags-, Lieferschein- und Rechnungsworkflow inkl. Teilrechnung
36. E-Rechnungsfähigkeit (XRechnung + ZUGFeRD Vorbereitung)
37. In-App-Guides und vollständige Feature-Dokumentation
38. Konfigurierbares Dashboard inkl. Rollen-Templates und Card-Policies

---

## 16. Nicht-funktionale Anforderungen

### Performance
- Seitenaufbau < 2 Sekunden
- QR-Scan-Erkennung < 500ms
- Echtzeit-Bestandsanzeige (max. 5 Sek. Verzögerung)
- Unterstützung für 50+ gleichzeitige Benutzer

### Sicherheit
- HTTPS / TLS-Verschlüsselung
- Session-Timeout & automatischer Logout
- OWASP Top 10 Absicherung
- Regelmäßige Backups
- Datenschutz (DSGVO-konform)

### Verfügbarkeit
- 99,5% Uptime
- Graceful Degradation bei Netzwerkproblemen (Offline-Modus)
- Automatische Fehlerbehandlung

### Usability
- Maximal 3 Klicks/Taps bis zur gewünschten Funktion
- Einheitliche Bedienphilosophie über alle Module
- Kontexthilfe / Tooltips
- Mehrsprachig vorbereitet (initial: Deutsch)

---

> **Nächster Schritt:** Umsetzung gemäß `directstock_phase5.md` und anschließende technische Realisierung der Phase-5-Workstreams.

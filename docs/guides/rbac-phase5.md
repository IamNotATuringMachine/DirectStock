# Guide: RBAC Permissions (Phase 5)

## Ziel
Rollen bleiben als Buendel, Berechtigungspruefung erfolgt technisch ueber Permission-Codes.
Zusatz in Phase 5.1x: Benutzer koennen jetzt Rollen plus direkte Permission-Overrides (`allow`/`deny`) erhalten.

## Wichtige Endpunkte
1. `GET /api/permissions`
2. `GET /api/pages`
3. `GET /api/roles`
4. `POST /api/roles`
5. `PUT /api/roles/{role_id}`
6. `PUT /api/roles/{role_id}/permissions`
7. `GET /api/users?managed_only=true`
8. `GET /api/users/{user_id}/access-profile`
9. `PUT /api/users/{user_id}/access-profile`

## Typisches Vorgehen
1. Rolle anlegen (`POST /api/roles`).
2. Permission-Codes zuweisen (`PUT /api/roles/{role_id}/permissions`).
3. Benutzer der Rolle zuordnen (`POST /api/users`).
4. Optional benutzerbezogene Overrides setzen (`PUT /api/users/{user_id}/access-profile`).
5. Ergebnis mit `GET /api/auth/me` pruefen (`permissions` Feld).

## Override-Logik
1. Basis sind alle Permissions aus den zugewiesenen Rollen.
2. `deny_permissions` entfernen Permissions aus der Basis.
3. `allow_permissions` fuegen Permissions additiv hinzu.
4. Effektiv gilt: `(role_permissions - deny_permissions) U allow_permissions`.
5. Dieselbe Permission darf nicht gleichzeitig in `allow` und `deny` stehen (HTTP `422`).

## Hinweise
1. Phase-5-Router nutzen `require_permissions(...)`.
2. Alte Rollen-Guards bleiben nur fuer Rueckwaertskompatibilitaet bestehen.
3. `managed_only=true` blendet Systembenutzer (`admin`, `lagerleiter`, `lagermitarbeiter`) aus der Konfigurationsliste aus.

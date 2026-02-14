# Guide: RBAC Permissions (Phase 5)

## Ziel
Rollen bleiben als Buendel, Berechtigungspruefung erfolgt technisch ueber Permission-Codes.

## Wichtige Endpunkte
1. `GET /api/permissions`
2. `GET /api/pages`
3. `GET /api/roles`
4. `POST /api/roles`
5. `PUT /api/roles/{role_id}`
6. `PUT /api/roles/{role_id}/permissions`

## Typisches Vorgehen
1. Rolle anlegen (`POST /api/roles`).
2. Permission-Codes zuweisen (`PUT /api/roles/{role_id}/permissions`).
3. Benutzer der Rolle zuordnen (`POST /api/users`).
4. Ergebnis mit `GET /api/auth/me` pruefen (`permissions` Feld).

## Hinweise
1. Phase-5-Router nutzen `require_permissions(...)`.
2. Alte Rollen-Guards bleiben nur fuer Rueckwaertskompatibilitaet bestehen.

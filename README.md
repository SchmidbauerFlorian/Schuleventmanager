# Schuleventmanager

Webanwendung zur Planung und Teilnahme an Schulevents mit:

- Flask-Backend
- MariaDB-Datenbank mit Stored Procedures
- Microsoft Entra ID (Azure AD) Login via MSAL
- Frontend mit HTML, CSS und JavaScript

## Inhalt

- [Funktionen](#funktionen)
- [Technologie-Stack](#technologie-stack)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Datenbank initialisieren](#datenbank-initialisieren)
- [Anwendung starten](#anwendung-starten)
- [Projektstruktur](#projektstruktur)
- [Typische Probleme](#typische-probleme)
- [Entwicklung](#entwicklung)

## Funktionen

- Login mit Microsoft-Konto
- Event-Erstellung und Event-Verwaltung
- Ressourcen und Attribute pro Event verwalten
- Teilnehmer-/Nutzerdaten aus Microsoft Graph synchronisieren
- Rechteprüfung: Bearbeitung nur durch Event-Ersteller

## Technologie-Stack

- Python 3
- Flask
- SQLAlchemy / Flask-SQLAlchemy
- MariaDB (inkl. Stored Procedures aus `db/schema.sql`)
- MSAL + Microsoft Graph API

## Voraussetzungen

- Python 3.10 oder neuer
- MariaDB Server 10.6+ (empfohlen)
- Zugriff auf ein Microsoft-Entra-ID-App-Register (Client ID + Secret)
- `pip` und virtuelle Umgebung (`venv`)

## Installation

1. Repository klonen oder Projektordner öffnen.
2. Virtuelle Umgebung erstellen.
3. Abhängigkeiten installieren.

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Windows (CMD):

```bat
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

Hinweis: Falls beim Start ein Fehler wie `ModuleNotFoundError: No module named 'mariadb'` auftritt, zusätzlich installieren:

```powershell
pip install mariadb
```

## Konfiguration

Lege im Projektroot eine Datei `.env` an (neben `app.py` und `run.py`):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=dein_passwort
DB_NAME=db_resourcemanagement

CLIENT_ID=deine_client_id
CLIENT_SECRET=dein_client_secret
AUTHORITY=https://login.microsoftonline.com/<tenant-id-oder-common>
REDIRECT_PATH=/getAToken
REDIRECT_URI=http://localhost:5000/getAToken
SCOPE=User.Read.All
ENDPOINT=https://graph.microsoft.com/v1.0/me
```

Wichtige Hinweise zu Microsoft Graph:

- Für den Login und Nutzerdaten werden Microsoft-Graph-Berechtigungen benötigt.
- Für den Start-Sync nutzt die App App-Only-Token (`/.default`). Dafür müssen die entsprechenden Application Permissions (z. B. `User.Read.All`) im App-Register gesetzt und admin-consented sein.

## Datenbank initialisieren

1. Stelle sicher, dass MariaDB läuft.
2. Führe das Schema aus:

```sql
SOURCE db/schema.sql;
```

Alternative über CLI (Beispiel):

```powershell
mariadb -u root -p < db/schema.sql
```

Das Skript erstellt die Datenbank `db_resourcemanagement`, Tabellen, Funktionen, Prozeduren und Basisdaten.

## Anwendung starten

Empfohlen über `run.py`:

```powershell
python run.py
```

Danach im Browser öffnen:

```text
http://localhost:5000
```

Beim Start wird einmalig ein Graph-User-Sync versucht. Anschließend erfolgt die Anmeldung über Microsoft Login.

## Projektstruktur

```text
.
|-- app.py                 # Flask-Routen und Auth-Flow
|-- config.py              # Laden der Umgebungsvariablen
|-- run.py                 # Startskript
|-- requirements.txt       # Python-Abhängigkeiten
|-- db/
|   |-- connection.py      # MariaDB Connection Pool
|   |-- queries.py         # Datenbankzugriffe
|   |-- schema.sql         # Komplettes DB-Schema + Prozeduren
|-- services/
|   |-- event_service.py
|   |-- graph_service.py
|   |-- permission_service.py
|-- templates/             # HTML-Templates
|-- static/                # CSS, JS, Assets
```

## Typische Probleme

- Redirect-Fehler nach Microsoft Login:
	- `REDIRECT_URI` in `.env` muss exakt mit der Redirect URI im App-Register übereinstimmen.
- Datenbankverbindung fehlgeschlagen:
	- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` prüfen.
	- Sicherstellen, dass die Datenbank `db_resourcemanagement` existiert (wird durch `db/schema.sql` angelegt).
- Keine Nutzer-/Klassen-Daten:
	- Graph-Berechtigungen und Admin Consent prüfen.
	- Prüfen, ob der Zugriff auf `https://graph.microsoft.com/v1.0/users` erlaubt ist.

## Entwicklung

Nützliche Befehle:

```powershell
pip freeze > requirements.txt
python run.py
```

Optional (wenn du Flask-CLI bevorzugst):

```powershell
$env:FLASK_APP = "app.py"
flask run
```

## Lizenz

Derzeit ist keine Lizenzdatei hinterlegt.
Wenn das Projekt veröffentlicht wird, sollte eine passende Lizenz (z. B. MIT) ergänzt werden.

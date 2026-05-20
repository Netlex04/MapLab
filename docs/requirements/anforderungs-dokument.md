# Anforderungsdokument MapLab – Webbasierte ECU-Tuning Plattform mit Versionierung, Community & AI Copilot

## Projektname

**TuneForge** _(Arbeitstitel)_

---

# 1. Vision

Eine moderne webbasierte Plattform für ECU-Tuning-Dateien, die:

- ECU-Dateien direkt im Browser editierbar macht
- Community-Sharing ermöglicht
- Versionierung & Collaboration integriert
- KI-gestützte Analyse und Assistenz bietet
- sicherer, transparenter und verständlicher als bestehende Tools ist

Ziel ist eine Kombination aus:

- GitHub
- Figma
- VSCode Copilot
- WinOLS/TunerPro

für ECU-Tuning.

---

# 2. Zielgruppen

## Primär

- Hobby-Tuner
- Semi-professionelle Tuner
- ECU-Mapper
- Chiptuning-Werkstätten

## Sekundär

- Lernende / Anfänger
- Automotive-YouTuber
- Performance-Communities
- Motorsport-Projekte

---

# 3. Kernprobleme bestehender Lösungen

| Problem                   | Beschreibung                                 |
| ------------------------- | -------------------------------------------- |
| Veraltete UX              | WinOLS/TunerPro wirken technisch alt         |
| Keine echte Kollaboration | Files werden per Discord/Telegram verschickt |
| Keine Versionierung       | Änderungen schwer nachvollziehbar            |
| Fehlende Transparenz      | Nutzer verstehen Maps oft nicht              |
| Keine KI-Unterstützung    | Keine intelligente Analyse                   |
| Keine sichere Community   | Viele schlechte/unsichere Files              |
| Lokale Installation       | Kein moderner Cloud-Workflow                 |

---

# 4. Hauptfeatures (MVP)

# 4.1 Benutzerkonto

## Funktionen

- Registrierung/Login
- OAuth (Google/GitHub)
- Rollen:
  - User
  - Verified Tuner
  - Moderator
  - Admin

## Profile

- Profilbild
- Bio
- Fahrzeugliste
- Reputation
- Upload-Historie
- Bewertungen

---

# 4.2 Projekt-System

Ein Projekt enthält:

- Originaldatei
- Bearbeitete Versionen
- Logs
- Notizen
- Kommentare
- Fahrzeugdaten

## Beispiel

Projekt:

- Golf 7 GTI
- Bosch MED17
- Stage 1
- 98 Oktan

---

# 4.3 File Upload

## Unterstützte Formate

- BIN
- HEX
- FRF
- OLS
- XDF
- A2L
- DAMOS

## Upload-Prozess

1. Datei hochladen
2. ECU erkennen
3. Softwareversion identifizieren
4. Metadaten extrahieren
5. Projekt anlegen

---

# 4.4 Browserbasierter Map-Editor

## Ansichten

### Hex View

- Byte-Editor
- Offset-Navigation
- Hex + ASCII

### 2D Map View

- Tabellenansicht
- Achsen
- Skalierung

### 3D Map View

- Interaktive 3D-Oberfläche
- Zoom
- Rotation

### Difference View

- Vergleich zweier Dateien
- Highlight geänderter Bereiche

---

# 4.5 Community Plattform

## File Sharing

Nutzer können:

- Maps veröffentlichen
- privat teilen
- verkaufen
- versionieren

## Community Features

- Likes
- Kommentare
- Bewertungen
- Forks
- Follow-System

## Kategorien

- Fahrzeugmarke
- ECU-Typ
- Leistungsstufe
- Kraftstoff
- Motorsport

---

# 4.6 Versionierung

Ähnlich GitHub.

## Features

- Commit-Historie
- Änderungsbeschreibung
- Vergleichsansicht
- Rollback
- Branches

## Beispiel

v1:

- Drehmomentbegrenzer angepasst

v2:

- Zündwinkel optimiert

---

# 4.7 AI Copilot

## Ziel

KI soll helfen — nicht blind tunen.

---

## Funktionen

### Map-Erkennung

- „Diese Tabelle ist wahrscheinlich Driver Wish“

### Erklärung

- „Diese Map beeinflusst Einspritzmenge“

### Sicherheitswarnungen

- „Lambda-Ziel wirkt kritisch“
- „Boost-Anforderung ungewöhnlich hoch“

### Vergleich

- „Ähnliche Builds nutzen typischerweise +12%“

### Lernmodus

- „Erkläre mir Torque Limiter“

### Autocomplete

- Vorschläge für Skalierung
- Map-Namen
- Achsen

### Intelligent Search

- „Zeige alle Torque Limiter“
- „Finde ähnliche Files“

---

# 4.8 Sicherheits- & Plausibilitätsprüfung

## Prüfungen

- Checksum Validation
- Inkonsistente Maps
- Unrealistische Werte
- Unvollständige Achsen
- Duplicate Maps

## Optional

- Safe Tune Score

---

# 5. Nicht-Ziele (wichtig)

Die Plattform soll NICHT:

- automatisches „One-Click-Tuning“ anbieten
- ungeprüfte KI-Optimierungen blind anwenden

---

# AI Services

## Aufgaben

- Implementierung gewünschter Anpassungen
- Klassifikation
- Map-Erkennung
- Diff-Analyse
- Safety Checks
- Erklärungen

---

# ECU Parsing Engine

## Möglichkeiten

- Rust/WASM Core
- Python Microservice
- Native C++ Library via API

---

# 6. Datenmodell

## User

- id
- username
- reputation
- verified

## Project

- vehicle
- ecu
- fuel
- owner

## FileVersion

- checksum
- version
- diff
- uploadDate

## Map

- type
- axis
- dimensions
- values

---

# 7. KI-Konzept

## Wichtig:

KI darf niemals:

- ungeprüft schreiben
- automatisch flashbare Files erzeugen
- Sicherheit ignorieren

## KI ist:

- Assistent
- Erklärer
- Prüfer
- Navigator
- Vergleichbar zu copilot oder claude code

---

# 8. Monetarisierung

## Freemium

- Öffentliche Projekte kostenlos
- Private Projekte bezahlt

## Pro Features

- AI Copilot
- Mehr Speicher
- Teamfunktionen
- Private Repositories
- Premium-Diffing

## Marketplace

Provision auf:

- verkaufte Files
- Verified Tuner Services

---

# 9. Roadmap

# Phase 1 – MVP

- Upload
- Hex Viewer
- 2D Maps
- Community
- Kommentare

# Phase 2

- AI Analyse / Copilot
- 3D Maps
- Live Collaboration
- Forking
- Versionierung

# Phase 3

- Marketplace
- AI Copilot Advanced
- Realtime Logs
- Dyno Integration

# Phase 4

- OBD/Flasher Integration
- Mobile App
- Remote Tuning Workflow

---

# 10. Designprinzipien

## UX

- Modern
- VSCode/Figma inspiriert
- Schnell
- Modular

## Fokus

„ECU-Tuning soll verständlich und kollaborativ werden.“

---

# 11. Konkurrenzanalyse

| Produkt          | Schwächen           |
| ---------------- | ------------------- |
| WinOLS           | Alte UX, lokal      |
| TunerPro         | Wenig modern        |
| ECM Titanium     | Geschlossen         |
| File Services    | Keine Kollaboration |
| Facebook/Discord | Chaos               |

---

# 12. Killer Feature

## „GitHub für ECU-Tuning“

Mit:

- Forks
- Diffs
- AI Reviews
- Community
- Browser Editing

Das existiert aktuell praktisch nicht in moderner Form.

---

# 13. Langfristige Vision

Die Plattform wird:

- Standard für kollaboratives Tuning
- Lernplattform
- Community
- Analyseplattform
- Infrastruktur für moderne ECU-Entwicklung
- Gatekeeping im Tuning-Bereich beenden

Nicht nur ein Editor.  
Sondern ein komplettes Ökosystem.

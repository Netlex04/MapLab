# Anforderungsdokument MapLab – Webbasierte ECU-Tuning Plattform mit Versionierung, Community & AI Copilot

## Projektname

**TuneForge** _(Arbeitstitel)_

---

# 0. MVP-Scope

## Unterstützte ECUs im MVP

Der MVP fokussiert sich **ausschließlich** auf die **Siemens MS4X-Plattform**:

| ECU | Motor | Fahrzeuge |
|---|---|---|
| **Siemens MS42** | BMW M52TU | E46 318i/320i/323i/328i, E39 520i/523i/528i |
| **Siemens MS43** | BMW M54 | E46 320i/325i/330i, E39 520i/525i/530i, Z3/Z4 |
| **Siemens MS45** | BMW S54 / M54 | E46 M3, E85/E86 Z4, E39 M5 (MS45.1) |
| **Siemens GS20** | SMG-Getriebesteuerung | E46 M3 SMG, E39 M5 SMG |

**Begründung:** Die MS4X-Plattform hat eine aktive, technisch versierte Community (ms4x.net, diverse BMW-Foren), verbreitete Open-Source-Dokumentation der Steuergerätstruktur, und ist ein idealer Startpunkt für tiefen, qualitativ hochwertigen Support statt oberflächlicher Breitenabdeckung.

Weitere ECUs werden in späteren Phasen ergänzt (z.B. Bosch ME7, Bosch MED17, VAG-spezifische ECUs).

---

# 1. Vision

Eine moderne webbasierte Plattform für das Tuning von **Siemens MS4X Steuergeräten** (MS42, MS43, MS45, GS20), die:

- ECU-Dateien direkt im Browser editierbar macht
- Community-Sharing innerhalb der MS4X/BMW-Community ermöglicht
- Versionierung & Collaboration integriert
- KI-gestützte Analyse und Assistenz speziell für MS4X-Maps bietet
- sicherer, transparenter und verständlicher als bestehende Tools ist

Ziel ist eine Kombination aus:

- GitHub
- Figma
- VSCode Copilot
- WinOLS/TunerPro

für ECU-Tuning — gestartet mit der MS4X-Plattform als tiefem, qualitätsorientiertem Kern.

---

# 2. Zielgruppen

## Primär (MVP)

- BMW E46 / E39 Hobby-Tuner mit MS4X Steuergerät
- Semi-professionelle MS4X-Tuner
- ECU-Mapper für BMW M52TU/M54/S54 Motoren
- Chiptuning-Werkstätten mit BMW-Fokus

## Sekundär (MVP)

- Lernende der MS4X-Plattform (Einsteiger in BMW-Tuning)
- BMW-Automotive-YouTuber & Performance-Creator
- E46/E39-Performance-Communities
- Motorsport-Projekte (E46 M3, E46 Race Cars)

## Langfristig (Post-MVP)

- Breitere Tuning-Community über MS4X hinaus
- Andere Fahrzeugmarken & ECU-Plattformen

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

## Beispiel (MVP)

Projekt:

- BMW E46 330i
- Siemens MS43
- Stage 1
- 98 Oktan

---

# 4.3 File Upload

## Unterstützte Formate (MVP – MS4X)

| Format | Priorität | Beschreibung |
|---|---|---|
| **BIN** | Pflicht | Rohes ECU-Binary (primäres Format für MS4X) |
| **HEX** | Pflicht | Intel HEX / Motorola S-Record |
| **DAMOS** | Hoch | Siemens/Continental Map-Definitionen (MS42/MS43/MS45 spezifisch) |
| **XDF** | Mittel | TunerPro Definitionsdatei (Community-Standard für MS4X) |
| **A2L** | Niedrig | ASAP2-Format |
| FRF | Post-MVP | Flash Read File (VAG-spezifisch, nicht MS4X) |
| OLS | Post-MVP | WinOLS Projektformat |

## Upload-Prozess

1. Datei hochladen
2. ECU erkennen (MS42 / MS43 / MS45 / GS20 via Fingerprinting)
3. Softwareversion identifizieren (z.B. MS43 SW7550460)
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

# Phase 1 – MVP (MS4X-fokussiert)

**ECU-Support:** Siemens MS42, MS43, MS45, GS20

- Upload & Fingerprinting für MS4X ECUs
- Hex Viewer
- 2D Map-Ansicht mit MS4X-spezifischen Map-Definitionen (via DAMOS/XDF)
- Community-Plattform für MS4X-Tuner
- Kommentare & Projekt-Sharing
- Checksum-Validierung (MS4X-spezifische Algorithmen)
- Forking & Versionierung (Git-Modell)

# Phase 2

**ECU-Support:** + erste Erweiterung (z.B. Bosch ME7.2, ME9)

- AI Analyse / Copilot (zunächst MS4X-optimiert)
- 3D Maps
- Live Collaboration

# Phase 3

**ECU-Support:** + Bosch MED17, VAG-Plattformen

- Marketplace
- AI Copilot Advanced (ECU-übergreifend)
- Realtime Logs
- Dyno Integration

# Phase 4

**ECU-Support:** Breit

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

# egoMorph

Eine emotionale KI fuer den Browser – erkennt Gefuehle, passt ihre Persoenlichkeit an, spricht, hoert zu und lernt aus deinem Feedback.
 
**Live-Demo: https://mcpasi.github.io/egoMorph-/**
 
---
 
## Inhaltsverzeichnis
 
1. [Ueberblick](#ueberblick)
2. [Features](#features)
3. [Ressourcen-Profile](#ressourcen-profile)
4. [Installation](#installation)
5. [API-Modus einrichten](#api-modus-einrichten)
6. [Einstellungen](#einstellungen)
7. [Projektstruktur](#projektstruktur)
8. [Fuer Entwickler](#fuer-entwickler)
9. [Tests](#tests)
10. [FAQ](#faq)
11. [Lizenz](#lizenz)

## Ueberblick
 
EgoMorph ist ein vollstaendig browserbasierter, emotionaler KI-Assistent. Die App laeuft als Progressive Web App (PWA) und kann auf dem Smartphone wie eine native App installiert werden. Alle Daten bleiben lokal im Browser – es wird kein Server benoetigt.
 
Je nach Hardware-Leistung kann EgoMorph in verschiedenen Modi betrieben werden – vom ultraleichten Keyword-Modus bis hin zur Anbindung an externe LLMs.

**Unterstuetzte Sprachen:** Deutsch, Englisch, Franzoesisch
 
---
 
## Features

- **Emotionserkennung** – Erkennt Freude, Wut, Traurigkeit, Angst, Vertrauen und Ueberraschung
- **Adaptives Verhalten** – Persoenlichkeit passt sich an deine Nachrichten an
- **Sprachein-/ausgabe** – Spricht ueber Web Speech API und hoert per Mikrofon zu
- **Langzeitgedaechtnis** – Merkt sich wichtige Themen ueber Sitzungen hinweg
- **Lernfaehig** – Verbessert Erkennung durch Nutzerfeedback
- **Denkmodus** – Beobachte EgoMorph beim "Nachdenken"
- **4 Ressourcen-Profile** – Von 0 MB RAM bis zu vollem LLM
- **Externe API-Anbindung** – Ollama, OpenAI, LM Studio und mehr
- **Offline-faehig** – Funktioniert nach dem ersten Laden ohne Internet
- **PWA** – Installierbar auf Desktop und Mobilgeraeten
 
---

## Ressourcen-Profile
 
EgoMorph bietet vier Betriebsmodi, je nachdem wie viel Leistung zur Verfuegung steht:

| Profil | RAM-Bedarf | Emotionserkennung | Antworten | Fuer wen |
|--------|-----------|-------------------|-----------|----------|
| **Lite** | ~0 MB | Keyword-basiert | Templates | Schwache Geraete, billiges Hosting |
| **Standard** | ~250-440 MB | ML-Modell (BERT) | Templates | Mittelklasse-Geraete |
| **Voll** | ~500-1000 MB | ML-Modell (BERT) | Lokales LLM (GPT-2) | Starke Hardware |
| **API** | ~0 MB lokal | Ueber externe API | Ueber externe API | Server mit API-Zugang |

### Profil aendern
 
1. EgoMorph oeffnen
2. **Einstellungen** > **Ressourcen-Profil**
3. Gewuenschtes Profil auswaehlen
4. **Seite neu laden** (Profilaenderung wird nach Neuladen wirksam)
 
### Lite-Modus

Der Lite-Modus ist ideal fuer:
- Sehr alte oder schwache Geraete
- Hosting auf kostenlosem Webspace
- Situationen ohne stabile Internetverbindung (nach dem ersten Laden)

Im Lite-Modus:
- Wird Transformers.js (~2 MB) **nicht geladen**
- Keine ML-Modelle noetig (~0 MB extra RAM)
- Emotionen werden per Keyword-Matching erkannt
- Antworten kommen aus vordefinierten Templates
- Sofort einsatzbereit, kein Model-Download
 
---

## Installation
 
### Variante 1: Direkt im Browser (einfachste Methode)
 
Oeffne einfach die Live-Demo:
**https://mcpasi.github.io/egoMorph-/**

Optional: Klicke auf "Installieren" in der Browser-Leiste, um EgoMorph als App auf deinem Geraet zu installieren.

### Variante 2: Lokaler Download
 
1. **Repository herunterladen:**
   ```bash
   git clone https://github.com/Mcpasi/egoMorph-.git
   ```
   Oder als ZIP/RAR von der [Releases-Seite](https://github.com/Mcpasi/egoMorph-/releases) herunterladen.

2. **Datei oeffnen:**
   Oeffne `index.html` in einem modernen Browser (Chrome, Edge, Firefox, Safari).
 
3. **Fertig.** Kein Server, kein Build-Schritt, keine Installation noetig.

### Variante 3: Auf eigenem Webserver hosten
 
Da EgoMorph nur aus statischen Dateien besteht, kann es auf jedem Webserver gehostet werden:

```bash
# Beispiel mit Python
cd egoMorph-
python3 -m http.server 8080
 
# Beispiel mit Node.js (npx)
npx serve .
 
# Beispiel mit nginx: Dateien in den Web-Root kopieren
cp -r egoMorph-/* /var/www/html/

**Systemanforderungen fuer das Hosting:**
- Lite-Modus: Jeder Webserver genuegt (statische Dateien, ~5 MB)
- Standard/Voll-Modus: Modelle werden beim Client im Browser geladen – der Server braucht keine besondere Leistung
- API-Modus: Braucht Zugang zu einem API-Endpunkt (lokal oder extern)
 
---

## API-Modus einrichten
 
Der API-Modus erlaubt es, ein externes LLM fuer Emotionserkennung und Antwortgenerierung zu verwenden. EgoMorph selbst braucht dabei quasi kein RAM – die Rechenarbeit uebernimmt der API-Server.


### Unterstuetzte API-Endpunkte
 
Jeder **OpenAI-kompatible** Endpunkt funktioniert:

| Anbieter | URL | API-Key noetig | Kostenlos |
|----------|-----|----------------|-----------|
| **Ollama** (lokal) | `http://localhost:11434` | Nein | Ja |
| **LM Studio** (lokal) | `http://localhost:1234` | Nein | Ja |
| **llama.cpp** (lokal) | `http://localhost:8080` | Nein | Ja |
| **OpenAI** | `https://api.openai.com` | Ja | Nein |
| **OpenRouter** | `https://openrouter.ai/api` | Ja | Teilweise |

### Einrichtung mit Ollama (empfohlen fuer lokales Hosting)
 
1. **Ollama installieren:**
   ```bash
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
 
   # macOS
   brew install ollama

# Windows: Download von https://ollama.ai

**Modell herunterladen:**
   ```bash
   # Kleines Modell (~2 GB) – gut fuer schwache Hardware
   ollama pull llama3.2:1b
 
   # Mittleres Modell (~4 GB) – gute Balance
   ollama pull llama3.2
 
   # Oder ein deutschsprachiges Modell
   ollama pull mistral
   ```

3. **Ollama starten:**
   ```bash
   ollama serve
   ```

4. **In EgoMorph konfigurieren:**
   - Einstellungen > Ressourcen-Profil > **API** auswaehlen
   - Seite neu laden
   - Einstellungen > API-Einstellungen:
     - **API-URL:** `http://localhost:11434`
     - **API-Key:** (leer lassen)
     - **Modell-Name:** `llama3.2` (oder dein heruntergeladenes Modell)
   - Auf **Speichern** klicken
   - Mit **Verbindung testen** pruefen, ob alles funktioniert

### Einrichtung mit LM Studio
 
1. [LM Studio herunterladen](https://lmstudio.ai/)
2. Ein Modell in LM Studio laden
3. Den lokalen Server in LM Studio starten (Standard-Port: 1234)
4. In EgoMorph:
   - **API-URL:** `http://localhost:1234`
   - **Modell-Name:** `local-model`

### Einrichtung mit OpenAI
 
1. API-Key erstellen: https://platform.openai.com/api-keys
2. In EgoMorph:
   - **API-URL:** `https://api.openai.com`
   - **API-Key:** `sk-...` (dein Key)
   - **Modell-Name:** `gpt-3.5-turbo` (guenstig) oder `gpt-4o-mini` (besser)
3. **Speichern** klicken

### CORS-Hinweis
 
Wenn EgoMorph auf einer anderen Domain als der API-Server laeuft, muss der Server CORS-Header senden.
 
**Ollama** hat CORS standardmaessig aktiviert. Bei anderen Servern muss ggf. `Access-Control-Allow-Origin: *` konfiguriert werden.
 
---

## Einstellungen
 
Alle Einstellungen befinden sich im Einstellungs-Panel (Zahnrad-Button).
 
### Schnellaktionen
- **Chatverlauf loeschen** – Setzt die Konversation zurueck
- **Stimme deaktivieren/aktivieren** – Schaltet die Sprachausgabe um
- **Modell herunterladen** – Laedt das Emotions-Modell manuell
- **Speichern/Loeschen** – Langzeitgedaechtnis exportieren oder loeschen

### Standardwerte
- **Standard-Emotion** – Legt die Ausgangsemotion von EgoMorph fest
 
### Persoenliche Ansprache
- **Dein Name** – EgoMorph spricht dich in Antworten mit diesem Namen an

### Eigene Antworten
- Ergaenze individuelle Reaktionen fuer bestimmte Emotionen

### Ressourcen-Profil
- Waehle zwischen Lite, Standard, Voll und API (siehe [Ressourcen-Profile](#ressourcen-profile))
 
### API-Einstellungen (nur im API-Modus sichtbar)
- **API-URL** – Endpunkt des LLM-Servers
- **API-Key** – Authentifizierung (optional, z. B. fuer OpenAI)
- **Modell-Name** – Welches Modell verwendet werden soll
- **Verbindung testen** – Prueft, ob der API-Server erreichbar ist

### Emotions-Modell (Standard- und Voll-Modus)
- **Hugging Face Model ID** – Beliebiges `text-classification`-Modell
- Voreingestellte Optionen:
  - `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~250 MB, schneller)
  - `Xenova/bert-base-multilingual-uncased-sentiment` (~440 MB, Standard)

### Chat-Modell / LLM (nur Voll-Modus)
- **Hugging Face Model ID** – Beliebiges `text-generation`-Modell
- **Max. Token** – Maximale Laenge der Antworten (20-300)
- **LLM-Antworten aktivieren** – Schaltet das lokale LLM ein/aus
- Voreingestellte Optionen:
  - `Xenova/distilgpt2` (~200 MB, sehr klein)
  - `Xenova/gpt2` (~500 MB, Standard)

## Projektstruktur
 
```
egoMorph-/
  index.html            Haupt-App (HTML + CSS + JS, Single-Page)
  resourceProfile.js    Ressourcen-Profil-Verwaltung & API-Client
  chatModel.js          Lokales LLM (Text-Generation via Transformers.js)
  emotionModel.js       Emotions-ML-Modell (Text-Classification)
vectorizeEmotion.js   Hilfsmodul fuer Emotionsvektorisierung
  ltmManager.js         Langzeitgedaechtnis-Verwaltung
  thinkingMode.js       Denkmodus-Visualisierung
  ego_settings.js       Erscheinungs-Einstellungen (Form, Farbe)
  loader.js             Ladebildschirm
  style.css             Haupt-Styling
  load-screen.css       Ladebildschirm-Styling
  sw.js                 Service Worker (Offline-Cache)
  manifest.json         PWA-Manifest
  package.json          Node.js-Konfiguration (nur fuer Tests)
  ego_icon_192.png      App-Icon 192x192
  ego_icon_512.png      App-Icon 512x512
  tests/
    emotionModel.test.js
    ltmManager.test.js
    vectorizeEmotion.test.js

| Datei | Beschreibung |
|-------|-------------|
| `index.html` | Gesamte App-Logik: UI, Emotionssystem, Kategorien, Konversation, Persoenlichkeit, NLP-Boost, Sprachein-/ausgabe |
| `resourceProfile.js` | Steuert die vier Betriebsmodi (Lite/Standard/Voll/API), keyword-basierte Emotionserkennung, OpenAI-kompatibler API-Client |
| `chatModel.js` | Laedt und verwaltet Text-Generation-Modelle ueber Transformers.js |
| `emotionModel.js` | Laedt und verwaltet Text-Classification-Modelle fuer Emotionserkennung |
| `ltmManager.js` | Langzeitgedaechtnis mit Scoring (Haeufigkeit + Aktualitaet + Themenrelevanz), max. 200 Eintraege |
| `sw.js` | Service Worker – cached App-Dateien fuer Offline-Nutzung |
 
---

## Fuer Entwickler
 
### Code anpassen
 
1. Repository klonen:
   ```bash
   git clone https://github.com/Mcpasi/egoMorph-.git
   cd egoMorph-
   ```

2. Dateien in einem Editor oeffnen (z. B. [VS Code](https://code.visualstudio.com/)).

3. Aendern nach Bedarf:
   - **Antwort-Templates:** In `index.html` im `categories`-Objekt (Zeile ~726)
   - **Emotionen/Keywords:** In `index.html` in den Wortlisten und `categories`
   - **Keyword-Erkennung (Lite-Modus):** In `resourceProfile.js` im `KEYWORD_EMOTIONS`-Objekt
   - **API-Prompts:** In `resourceProfile.js` in `apiEmotionDetect()` und `apiGenerateReply()`
   - **UI/CSS:** In `style.css` und im `<style>`-Block von `index.html`

4. Im Browser oeffnen und testen:
   ```bash
   # Einfacher lokaler Server
   npx serve .
   ```

### Architektur
 
```
Browser-Start
  |
  +-> resourceProfile.js laedt Profil aus localStorage
  |
  +-> Transformers.js wird nur geladen wenn Profil = standard/full
  |
+-> emotionModel.js initialisiert (oder ueberspringt bei lite/api)
  +-> chatModel.js initialisiert (oder ueberspringt wenn != full)
  |
 +-> Nutzer-Nachricht
        |
        +-> predictEmotionDistribution()
        |     lite:     keywordEmotionDetect()
        |     api:      apiEmotionDetect()
        |     standard: ML-Modell (Transformers.js)
        |     full:     ML-Modell (Transformers.js)
        |
+-> Kategorie-Matching (keywords)
        +-> Template-Antwort auswaehlen
        +-> generateSmartReply()
              |
              +-> api:  apiGenerateReply() -> fertig
              +-> full: generateWithLLM()  -> fertig (wenn LLM aktiv)
              +-> *:    Template-Antwort + Emotion-Kommentar + Kontext































  

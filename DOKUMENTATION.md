# EgoMorph Dokumentation

EgoMorph ist eine installierbare Progressive Web App (PWA) mit emotionaler Texteingabe, Chat-Antworten, lokalem Speicher, optionaler Modellnutzung und einem integrierten Schreibeditor namens EgoMorph Writer.

## 1. Ziel der App

EgoMorph soll als emotionaler KI-Assistent im Browser laufen. Die App analysiert Texteingaben, erkennt eine emotionale Tendenz, passt Reaktionen daran an und kann je nach Ressourcen-Profil lokale Modelle oder externe APIs verwenden.

Die App ist fuer PWA- und PWABuilder-Deployments vorbereitet, damit sie spaeter als Android APK oder AAB exportiert werden kann.

## 2. Projektstruktur

```text
egoMorph-pwa/
├── index.html              # Hauptoberflaeche und App-Logik
├── style.css               # Basis-Styles der App
├── load-screen.css         # Ladebildschirm-Styles
├── loader.js               # Ladebildschirm-Logik
├── manifest.json           # PWA Manifest fuer Installation/PWABuilder
├── sw.js                   # Service Worker fuer Offline-Cache
├── resourceProfile.js      # Lite/Standard/Full/API Profilsteuerung
├── emotionModel.js         # Emotionserkennung mit Transformers.js
├── chatModel.js            # Lokales Textgenerierungsmodell im Full-Modus
├── Safetyfilter.js         # Sicherheitsfilter fuer Modellantworten
├── Safetyfilter.ts         # TypeScript-Quelle des Sicherheitsfilters
├── ltmManager.js           # Long-Term-Memory Export/Loeschen
├── ego_settings.js         # Appearance-/Avatar-Einstellungen
├── thinkingMode.js         # Antwortweg-/Trace-Panel
├── Writer.js               # EgoMorph Writer Editor
├── vectorizeEmotion.js     # Emotionsvektor-Hilfen
├── PWABUILDER.md           # Hinweise fuer APK/AAB Export
├── DOKUMENTATION.md        # Diese Dokumentation
├── scripts/
│   └── validate-pwa.js     # Lokale PWA-Pruefung
└── tests/                  # Jest-Tests fuer Kernmodule
```

## 3. Ressourcen-Profile

EgoMorph hat vier Betriebsmodi. Die Auswahl erfolgt in den Einstellungen unter "Ressourcen-Profil".

| Profil | Zweck | Modelle/API | Geeignet fuer |
| --- | --- | --- | --- |
| Lite | Sehr leichter Betrieb | Keine ML-Modelle, Keyword-Erkennung | Schwache Geraete, schnelle Tests |
| Standard | Emotionserkennung lokal | Transformers.js Textklassifikation | Normale Browser-Nutzung |
| Full | Emotion + lokales LLM | Transformers.js Klassifikation + lokales Textgenerierungsmodell | Offline-nahe Nutzung mit mehr RAM |
| API | Externe API | OpenRouter/OpenAI/Ollama/LM Studio kompatibel | Beste Qualitaet ohne lokale Modelllast |

Profilwechsel werden nach einem Neuladen der Seite voll wirksam.

## 4. API-Modus und OpenRouter

Der API-Modus kann OpenRouter, OpenAI-kompatible Endpunkte, Ollama, LM Studio und llama.cpp-Server verwenden.

### OpenRouter Beispiel

```text
API-URL: https://openrouter.ai/api/v1/chat/completions
API-Key: dein OpenRouter Key
Modell:  openrouter/auto
```

Alternativ kann als Modell z. B. `openai/gpt-4o-mini` verwendet werden.

EgoMorph normalisiert OpenRouter-URLs automatisch. Diese Eingaben funktionieren:

```text
https://openrouter.ai
https://openrouter.ai/api
https://openrouter.ai/api/v1
https://openrouter.ai/api/v1/chat/completions
```

Intern werden fuer OpenRouter passende Header gesetzt:

```text
Authorization: Bearer <API-Key>
HTTP-Referer: <App-Origin>
X-OpenRouter-Title: EgoMorph
X-OpenRouter-Categories: productivity,education,utilities
```

Wichtig: API-Keys werden im Browser gespeichert. Fuer oeffentliche Deployments ist ein eigener Proxy sicherer als ein direkt eingetragener Key.

## 5. Chat und Antwortgenerierung

Die normale Eingabe laeuft ueber das Formular im Hauptbereich.

Der Ablauf:

1. Nutzereingabe wird gespeichert und in den Kurzzeitkontext aufgenommen.
2. Emotion wird je nach Profil per Keyword, lokalem Modell oder API erkannt.
3. Avatar, Memory und Antwortlogik werden aktualisiert.
4. In `api` wird eine externe API-Antwort bevorzugt.
5. In `full` wird ein lokales LLM bevorzugt, sofern geladen und aktiviert.
6. Wenn keine Modellantwort verfuegbar ist, faellt EgoMorph auf Regel-/Template-Antworten zurueck.

## 6. Thinking Mode

Der Thinking Mode ist kein dekorativer Gedankenblasen-Modus mehr. Er zeigt einen nachvollziehbaren Antwortweg:

- Eingabe und Normalisierung
- dominante Emotion mit Prozentwerten
- erkannte Signale wie Frage, Hilfe oder Korrektur
- Kontext aus Memory/Topics
- geplante Antwortquelle
- Basisantwort und finale Antwort

Der Modus zeigt die App-Pipeline und Entscheidungsgrundlagen. Er legt keine versteckten internen Modellgedanken offen.

## 7. EgoMorph Writer

Der EgoMorph Writer ist ein integrierter Editor in `Writer.js`.

### Lokale Funktionen

Diese Funktionen funktionieren in jedem Profil:

- Dokumenttitel setzen
- Text schreiben
- Speichern in `localStorage`
- Automatisches Speichern
- Export als `.txt`
- Wortzaehlung
- Zeichenzahl
- Editor leeren

### Agentische Funktionen

Diese Funktionen sind nur in `Full` und `API` aktiv:

- Weiterschreiben
- Verbessern
- Zusammenfassen

Im API-Modus nutzt der Writer `egoProfile.apiChatCompletion`. Im Full-Modus nutzt er das lokale LLM ueber `generateWithLLM`, wenn das Modell geladen und aktiviert ist.

## 8. Lokaler Speicher

EgoMorph nutzt `localStorage` fuer:

- Ressourcen-Profil
- API-URL, API-Key und Modellname
- Chatverlauf
- Kurzzeit-Memory und Topics
- Long-Term-Memory Daten
- EgoMorph Writer Dokument und Titel
- UI-Einstellungen
- Thinking-Mode Status

Beim Loeschen von Browserdaten gehen diese lokalen Daten verloren.

## 9. PWA und Offline-Faehigkeit

Die App ist als PWA vorbereitet:

- `manifest.json` enthaelt Name, Icons, Scope, Start-URL und Display-Modus.
- `sw.js` cached die App-Shell.
- Navigationen fallen offline auf `index.html` zurueck.
- `Writer.js`, `thinkingMode.js`, Icons und Kernskripte sind im Cache enthalten.

Externe APIs und CDN-Modelle funktionieren offline nicht. Bereits gecachte App-Dateien koennen aber geladen werden.

## 10. PWABuilder APK/AAB Export

Fuer PWABuilder muss die App ueber HTTPS erreichbar sein.

Empfohlener Ablauf:

1. `/root/egoMorph-pwa` auf GitHub Pages, Netlify, Vercel oder einen eigenen HTTPS-Server deployen.
2. Die HTTPS-URL in PWABuilder eintragen.
3. Android-Export waehlen.
4. Fuer Play Store: `AAB` exportieren.
5. Fuer Test/Direct Install: `APK` exportieren.
6. Von PWABuilder erzeugte `assetlinks.json` unter `/.well-known/assetlinks.json` auf deiner Domain ausliefern.

Eine Vorlage liegt unter:

```text
.well-known/assetlinks.json.template
```

## 11. Lokale Entwicklung

### Abhaengigkeiten installieren

```bash
npm install
```

### Safetyfilter TypeScript pruefen/kompilieren

```bash
npm run build:safetyfilter
```

### PWA validieren

```bash
npm run pwa:validate
```

### Lokal starten

```bash
npm run serve
```

Danach:

```text
http://localhost:4173
```

## 12. Tests

Vorhandene Tests:

```bash
npm test
```

Zusaetzliche schnelle Checks:

```bash
node scripts/validate-pwa.js
node --check Writer.js
node --check thinkingMode.js
node --check Safetyfilter.js
node --check sw.js
```

## 13. Sicherheitshinweise

- API-Keys im Browser sind fuer private Tests bequem, fuer oeffentliche Apps aber riskant.
- Fuer OpenRouter/OpenAI in Produktion sollte ein eigener Backend-Proxy verwendet werden.
- Der Safetyfilter maskiert oder blockiert erkannte problematische Modellantworten, ersetzt aber keine serverseitige Moderation.
- Long-Term-Memory und Writer-Dokumente liegen lokal im Browser des Nutzers.

## 14. Release-Checkliste

Vor einem APK/AAB Export:

- `npm run pwa:validate` ausfuehren.
- App auf HTTPS deployen.
- Manifest unter `https://deine-domain/manifest.json` pruefen.
- Service Worker im Browser DevTools Tab "Application" pruefen.
- OpenRouter/API-Modus mit echtem Key testen.
- Full-Modus nur aktivieren, wenn das Zielgeraet genug RAM hat.
- PWABuilder Android Report pruefen.
- `assetlinks.json` nach PWABuilder Export korrekt auf der Domain bereitstellen.

## 15. Wichtige Dateien fuer Erweiterungen

| Datei | Zweck |
| --- | --- |
| `resourceProfile.js` | Neue API-Provider, Profile, API-Aufrufe |
| `chatModel.js` | Lokales LLM im Full-Modus |
| `Writer.js` | EgoMorph Writer und Agent-Aktionen |
| `thinkingMode.js` | Antwortweg/Trace UI |
| `Safetyfilter.ts` | Quelle fuer Sicherheitsfilter |
| `index.html` | Haupt-UI und bestehende App-Logik |
| `sw.js` | Offline-Cache und PWA-Aktualisierung |


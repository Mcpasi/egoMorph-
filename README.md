
Teste Egomorph hier live
**👉 https://mcpasi.github.io/egoMorph-/**
# egoMorph-
Eine emotionale KI für den Browser: erkennt Gefühle, passt ihre Persönlichkeit an, spricht, hört zu und lernt aus deinem Feedback – komplett offline mit TensorFlow.js.

## Anleitung für Anfänger

### Nach dem Download von **Egomorph-xxxx-alpha.rar**

**Entpacken der Datei**  
Entpacken Sie die heruntergeladene RAR-Datei auf Ihrem Computer.

**Starten von Egomorph (Desktop)**  
Öffnen Sie die Datei **index.html**.  
- Klicken Sie mit der linken Maustaste auf **index.html** und wählen Sie „Öffnen mit“.  
- Wählen Sie anschließend **Google Chrome** aus.  
- Falls Google Chrome noch nicht installiert ist, laden Sie ihn bitte herunter und installieren Sie ihn.

**Verwendung auf Mobilgeräten**  
Für Smartphones und Tablets wird die Nutzung der **Web-Version** empfohlen.  
- Alternativ können Sie auch die RAR-Datei herunterladen und dort die **index.html** öffnen.  
- In der Web-Version tippen Sie auf den Button **„Installieren“**. Danach kann Egomorph wie eine native App genutzt werden.

## Anleitung für Fortgeschrittene

Wenn Sie den Code von **Egomorph** anpassen möchten, benötigen Sie einen Editor wie  
[Visual Studio Code](https://code.visualstudio.com/) oder [Notepad++](https://notepad-plus-plus.org/).

### Aufbau der index.html
- **HTML-Struktur**: Enthält das Grundgerüst der App, z. B. das Gesicht (`#entity`), Eingabefeld, Buttons und das Einstellungsmenü.  
- **CSS-Styles**: Im `<style>`-Bereich definiert. Hier können Sie Aussehen und Animationen ändern (z. B. Farben, Formen, „Evil Mode“).  
- **JavaScript**: Im `<script>`-Block am Ende und in ausgelagerten Dateien (`vectorizeEmotion.js`, `emotionModel.js`, `ltmManager.js`).  
  - Steuert die Emotionserkennung, Speicherfunktionen und die visuelle Darstellung.  
  - Kategorien und Antworten sind in Objekten wie `categories` definiert – hier lassen sich neue Emotionen, Schlüsselwörter oder Reaktionen hinzufügen.  
  - CSS-Variablen (z. B. `--scale`) werden per JS angepasst, um Animationen mit Emotionen zu koppeln.

### So nehmen Sie Änderungen vor
1. Öffnen Sie die Datei **index.html** in Ihrem Editor.  
2. Ändern Sie nach Bedarf:
   - Texte (Antworten von EgoMorph, Labels im Interface).  
   - CSS-Regeln (Farben, Formen, Animationen).  
   - JavaScript-Logik (z. B. neue Keywords oder zusätzliche Emotionen im `categories`-Objekt).  
3. Speichern Sie die Datei.  
4. Laden Sie die **index.html** im Browser neu, um die Änderungen sofort zu testen.  

### Hinweis
- Änderungen sind lokal - wenn Sie möchten, dass andere Ihre Anpassungen nutzen können, committen Sie die geänderten Dateien auf GitHub und erstellen ggf. einen **Pull Request**.  
- EgoMorph speichert Daten lokal im Browser (`localStorage`). Änderungen am Code beeinflussen nicht automatisch bestehende gespeicherte Daten.  

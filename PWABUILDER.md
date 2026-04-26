# PWABuilder Vorbereitung

Dieses Verzeichnis ist die bereinigte PWA-Struktur fuer den Export als Android APK/AAB.

## Vor dem Upload

1. Projekt auf HTTPS hosten, zum Beispiel GitHub Pages, Netlify, Vercel oder eigener Server.
2. Die gehostete URL in PWABuilder eintragen.
3. In PWABuilder den Android-Export waehlen.
4. Fuer Play Store Release `AAB` verwenden, fuer direkte Installation/Test `APK`.

## Lokale Checks

```bash
npm install
npm run build:safetyfilter
npm run pwa:validate
npm run serve
```

Danach im Browser `http://localhost:4173` oeffnen. PWABuilder selbst muss spaeter eine HTTPS-URL pruefen.

## Android Asset Links

PWABuilder erzeugt fuer Trusted Web Activity ein eigenes `assetlinks.json`, sobald Paketname und Signatur bekannt sind. Die Datei muss danach unter:

```text
https://deine-domain.example/.well-known/assetlinks.json
```

ausgeliefert werden. Ohne diese finale Datei startet Android die App ggf. mit Browser-Leiste statt als voll vertrauenswuerdige TWA.

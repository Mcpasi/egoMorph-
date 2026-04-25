"use strict";
/**
 * Safetyfilter.ts – Sicherheitsfilter für anstößige Modell-Ausgaben.
 *
 * Wird im "Full"-Modus (lokales LLM via Transformers.js) auf die generierte
 * Antwort angewendet, bevor sie der Nutzer:in angezeigt wird. In anderen
 * Profilen (lite, standard, api) bleibt der Filter inaktiv – er kann dort
 * aber jederzeit explizit aufgerufen werden.
 *
 * Externe Einbindung über <script src="Safetyfilter.js"></script> nach
 * Kompilierung mit `tsc`. Der Filter registriert sich global als
 * `window.SafetyFilter` und wird von chatModel.js automatisch genutzt,
 * sofern verfügbar.
 */
(function () {
    'use strict';
    // Wortliste für Deutsch + Englisch. Bewusst klein gehalten und auf klar
    // anstößige Begriffe (Beleidigungen, Gewalt, Sexualisierung, Hass)
    // beschränkt. Keine Stoppwort-Listen oder politische Begriffe.
    const BLOCKED_TERMS = [
        // Beleidigungen / Hass (DE)
        'arschloch', 'arschlöcher', 'wichser', 'fotze', 'fotzen', 'hure', 'huren',
        'hurensohn', 'hurensöhne', 'schlampe', 'schlampen', 'missgeburt',
        'missgeburten', 'spast', 'spasti', 'spastiker', 'mongo', 'mongos',
        'krüppel', 'behindi', 'kanake', 'kanaken', 'nigger', 'neger',
        'judensau', 'untermensch', 'untermenschen',
        // Gewalt / Drohung (DE)
        'umbringen', 'töten', 'erschießen', 'erstechen', 'vergewaltigen',
        'vergewaltigung', 'abschlachten', 'massakrieren',
        // Sexualisierung / explizit (DE)
      

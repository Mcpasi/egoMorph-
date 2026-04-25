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
        'kinderporno', 'kinderpornos', 'kinderpornographie', 'kinderpornografie',
        'pädophil', 'paedophil', 'pädo', 'paedo',
        // Beleidigungen / Hass (EN)
        'asshole', 'assholes', 'bitch', 'bitches', 'cunt', 'cunts', 'whore',
        'whores', 'slut', 'sluts', 'faggot', 'faggots', 'retard', 'retards',
        'nigga', 'niggas',
        // Gewalt / Drohung (EN)
        'kill yourself', 'kys', 'rape', 'raping', 'molest', 'molesting',
        // Sexualisierung / explizit (EN)
        'child porn', 'childporn', 'cp ', 'pedo', 'pedophile',
    ];
    const DEFAULT_BLOCK_RESPONSE = 'Entschuldigung, diese Antwort wurde aus Sicherheitsgründen gefiltert.';
    function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function buildPattern(terms) {
        // Phrasen (mit Leerzeichen) und Einzelwörter werden gemeinsam erkannt.
        // Das führende Trennzeichen wird als Gruppe erfasst, damit kein Regex-
        // Lookbehind nötig ist und der Filter auch in älteren Browsern läuft.
        const escaped = terms
            .slice()
            .sort(function (a, b) { return b.length - a.length; })
            .map(escapeRegex);
        return new RegExp('(^|[^\\p{L}])(' + escaped.join('|') + ')(?![\\p{L}])', 'giu');
    }
    function normalize(text) {
        return (text || '').toLowerCase();
    }
    function dedupe(values) {
        const seen = {};
        const out = [];
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (!seen[v]) {
                seen[v] = true;
                out.push(v);
            }
        }
        return out;
    }
    function getActiveTerms(extra) {
        if (!extra || extra.length === 0)
            return BLOCKED_TERMS;
        const merged = BLOCKED_TERMS.slice();
        for (let i = 0; i < extra.length; i++) {
            const t = (extra[i] || '').toLowerCase().trim();
            if (t)
                merged.push(t);
        }
        return dedupe(merged);
    }
    function contains(text, extraTerms) {
        if (!text || typeof text !== 'string')
            return false;
        const pattern = buildPattern(getActiveTerms(extraTerms));
        return pattern.test(normalize(text));
    }
    function filter(text, options) {
        const opts = options || {};
        const maskChar = opts.maskChar && opts.maskChar.length > 0 ? opts.maskChar[0] : '*';
        const blockOnMatch = opts.blockOnMatch === true;
        if (!text || typeof text !== 'string') {
            return { text: text || null, flagged: false, matches: [] };
        }
        const pattern = buildPattern(getActiveTerms(opts.extraTerms));
        const found = [];
        const cleaned = text.replace(pattern, function (match, prefix, term) {
            found.push(term.toLowerCase());
            return prefix + maskChar.repeat(term.length);
        });
        const flagged = found.length > 0;
        const matches = dedupe(found);
        if (flagged && blockOnMatch) {
            return { text: null, flagged: true, matches: matches };
        }
        return { text: cleaned, flagged: flagged, matches: matches };
    }
    /**
     * Convenience-Wrapper, der von chatModel.js im Full-Modus aufgerufen wird.
     * Bei eindeutig anstößigem Inhalt wird die Antwort komplett ersetzt,
     * damit nicht nur ein zerlöcherter Satz übrig bleibt.
     */
    function filterModelOutput(text) {
        if (text === null || text === undefined)
            return null;
        if (typeof text !== 'string' || text.length === 0)
            return null;
        const result = filter(text, { blockOnMatch: false });
        if (!result.flagged)
            return result.text;
        if (result.matches.length >= 2 || result.text === null) {
            try {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[SafetyFilter] Antwort blockiert. Treffer:', result.matches);
                }
            }
            catch (_) { /* ignore */ }
            return DEFAULT_BLOCK_RESPONSE;
        }
        try {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[SafetyFilter] Antwort maskiert. Treffer:', result.matches);
            }
        }
        catch (_) { /* ignore */ }
        return result.text;
    }
    function getBlockedTerms() {
        return BLOCKED_TERMS.slice();
    }
    const api = {
        contains: contains,
        filter: filter,
        filterModelOutput: filterModelOutput,
        getBlockedTerms: getBlockedTerms,
    };
    // Browser-Registrierung
    if (typeof window !== 'undefined') {
        window.SafetyFilter = api;
    }
    // CommonJS-Export für Tests (Jest / Node)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _mod = typeof module !== 'undefined' ? module : null;
    if (_mod && _mod.exports) {
        _mod.exports = api;
    }
})();

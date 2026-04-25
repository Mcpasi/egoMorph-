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

interface SafetyFilterOptions {
  /** Wenn true: bei Treffern komplette Antwort verwerfen (null zurückgeben). */
  blockOnMatch?: boolean;
  /** Maskierungszeichen für das Ersetzen einzelner Wörter. Default: '*'. */
  maskChar?: string;
  /** Zusätzliche, projekteigene Begriffe (lower-case). */
  extraTerms?: string[];
}

interface SafetyFilterResult {
  /** Die bereinigte Antwort, oder null wenn vollständig blockiert. */
  text: string | null;
  /** True, wenn mindestens ein Treffer gefunden wurde. */
  flagged: boolean;
  /** Liste der erkannten Begriffe (lower-case, dedupliziert). */
  matches: string[];
}

interface SafetyFilterApi {
  contains(text: string, extraTerms?: string[]): boolean;
  filter(text: string, options?: SafetyFilterOptions): SafetyFilterResult;
  filterModelOutput(text: string | null | undefined): string | null;
  getBlockedTerms(): string[];
}

(function (): void {
  'use strict';

  // Wortliste für Deutsch + Englisch. Bewusst klein gehalten und auf klar
  // anstößige Begriffe (Beleidigungen, Gewalt, Sexualisierung, Hass)
  // beschränkt. Keine Stoppwort-Listen oder politische Begriffe.
  const BLOCKED_TERMS: string[] = [
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

  const DEFAULT_BLOCK_RESPONSE: string =
    'Entschuldigung, diese Antwort wurde aus Sicherheitsgründen gefiltert.';

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildPattern(terms: string[]): RegExp {
    // Phrasen (mit Leerzeichen) und Einzelwörter werden gemeinsam erkannt.
    // \b funktioniert für lateinische Buchstaben + Umlaute via Unicode-Flag.
    const escaped: string[] = terms.map(escapeRegex);
    return new RegExp('(?<![\\p{L}])(' + escaped.join('|') + ')(?![\\p{L}])', 'giu');
  }

  function normalize(text: string): string {
    return (text || '').toLowerCase();
  }

 function dedupe(values: string[]): string[] {
    const seen: Record<string, true> = {};
    const out: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (!seen[v]) {
        seen[v] = true;
        out.push(v);
      }
    }
    return out;
  }

  function getActiveTerms(extra?: string[]): string[] {
    if (!extra || extra.length === 0) return BLOCKED_TERMS;
    const merged: string[] = BLOCKED_TERMS.slice();
    for (let i = 0; i < extra.length; i++) {
      const t = (extra[i] || '').toLowerCase().trim();
      if (t) merged.push(t);
    }
    return dedupe(merged);
  }

 function contains(text: string, extraTerms?: string[]): boolean {
    if (!text || typeof text !== 'string') return false;
    const pattern = buildPattern(getActiveTerms(extraTerms));
    return pattern.test(normalize(text));
  }

  function filter(text: string, options?: SafetyFilterOptions): SafetyFilterResult {
    const opts: SafetyFilterOptions = options || {};
    const maskChar: string = opts.maskChar && opts.maskChar.length > 0 ? opts.maskChar[0] : '*';
    const blockOnMatch: boolean = opts.blockOnMatch === true;

    if (!text || typeof text !== 'string') {
      return { text: text || null, flagged: false, matches: [] };
    }

  const pattern = buildPattern(getActiveTerms(opts.extraTerms));
    const found: string[] = [];

    const cleaned: string = text.replace(pattern, function (match: string): string {
      found.push(match.toLowerCase());
      return maskChar.repeat(match.length);
    });

    const flagged: boolean = found.length > 0;
    const matches: string[] = dedupe(found);

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
  function filterModelOutput(text: string | null | undefined): string | null {
    if (text === null || text === undefined) return null;
    if (typeof text !== 'string' || text.length === 0) return null;

    const result: SafetyFilterResult = filter(text, { blockOnMatch: false });
    if (!result.flagged) return result.text;

    if (result.matches.length >= 2 || result.text === null) {
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[SafetyFilter] Antwort blockiert. Treffer:', result.matches);
        }
      } catch (_) { /* ignore */ }
      return DEFAULT_BLOCK_RESPONSE;
    }

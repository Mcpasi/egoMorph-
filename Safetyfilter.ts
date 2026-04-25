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

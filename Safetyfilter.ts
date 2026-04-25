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

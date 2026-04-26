/**
 * EgoMorph Thinking Mode (v3)
 * ===========================
 * Zeigt keinen dekorativen "Gedankenstrom", sondern eine nachvollziehbare
 * Antwortspur: Welche Eingabe ankam, welche Emotionen erkannt wurden, welcher
 * Kontext herangezogen wurde und welche Antwortquelle verwendet werden sollte.
 */
(function () {
  'use strict';

  if (window.__egoThinkingModeLoaded) {
    console.warn('[ThinkingMode] bereits geladen, überspringe...');
    return;
  }
  window.__egoThinkingModeLoaded = true;

  const CONFIG = {
    enabled: true,
    storageKey: 'egoThinkingMode',
    maxInputPreview: 160,
    maxReplyPreview: 220,
    maxStoredTraces: 8,
    debugMode: false,
  };

  const STYLES = `
    #thinking-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(110, 168, 254, 0.55);
      border-radius: 50%;
      background: #171b26;
      color: #eaf1ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38);
      cursor: pointer;
    }

    #thinking-toggle.active {
      background: #21304a;
      border-color: #7db2ff;
      box-shadow: 0 0 0 2px rgba(125, 178, 255, 0.15), 0 10px 28px rgba(0, 0, 0, 0.42);
    }

    #thinking-trace-panel {
      position: fixed;
      top: 72px;
      right: 20px;
      z-index: 9998;
      width: min(380px, calc(100vw - 32px));
      max-height: min(72vh, 680px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: rgba(14, 18, 28, 0.97);
      border: 1px solid rgba(110, 168, 254, 0.28);
      border-radius: 10px;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.48);
      color: #edf3ff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #thinking-trace-panel[hidden] {
      display: none;
    }

    .thinking-trace-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(110, 168, 254, 0.18);
      background: rgba(22, 28, 43, 0.95);
    }

    .thinking-trace-title {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: 0;
    }

    .thinking-trace-status {
      font-size: 0.72rem;
      color: #9db1d4;
      white-space: nowrap;
    }

    .thinking-trace-body {
      padding: 12px 14px 14px;
      overflow-y: auto;
    }

    .thinking-empty {
      margin: 0;
      color: #a9b5ca;
      font-size: 0.86rem;
      line-height: 1.45;
    }

    .thinking-step {
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .thinking-step:last-child {
      border-bottom: 0;
    }

    .thinking-step-index {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #263653;
      color: #b9d5ff;
      font-size: 0.72rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .thinking-step-label {
      margin: 1px 0 4px;
      color: #91bdff;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .thinking-step-text {
      margin: 0;
      color: #edf3ff;
      font-size: 0.86rem;
      line-height: 1.42;
      overflow-wrap: anywhere;
    }

    .thinking-step-detail {
      margin: 5px 0 0;
      color: #a9b5ca;
      font-size: 0.78rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .thinking-meter {
      margin-top: 7px;
      display: grid;
      gap: 5px;
    }

    .thinking-meter-row {
      display: grid;
      grid-template-columns: 86px 1fr 42px;
      gap: 8px;
      align-items: center;
      font-size: 0.74rem;
      color: #c3cde0;
    }

    .thinking-meter-track {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
    }

    .thinking-meter-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #6ea8fe, #8b5cf6);
    }

    @media (max-width: 640px) {
      #thinking-toggle {
        top: 14px;
        right: 14px;
      }

      #thinking-trace-panel {
        top: auto;
        right: 10px;
        left: 10px;
        bottom: 78px;
        width: auto;
        max-height: 58vh;
      }
    }
  `;

  class ThinkingMode {
    constructor() {
      this.enabled = CONFIG.enabled;
      this.container = null;
      this.toggle = null;
      this.traces = [];
      this.activeTrace = null;
      this.traceCounter = 0;
      this.lastEmotionResults = null;
      this.generateHookInstalled = false;
      this.hookAttempts = 0;

      this.init();
    }

    init() {
      this.loadSettings();
      this.injectStyles();
      this.createToggle();
      this.createPanel();
      this.setupEmotionHook();
      this.installGenerateHookWhenReady();
      this.render();
    }

    injectStyles() {
      if (document.getElementById('thinking-mode-styles')) return;
      const style = document.createElement('style');
      style.id = 'thinking-mode-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    createToggle() {
      this.toggle = document.getElementById('thinking-toggle');
      if (!this.toggle) {
        this.toggle = document.createElement('button');
        this.toggle.id = 'thinking-toggle';
        this.toggle.type = 'button';
        this.toggle.textContent = '↯';
        document.body.appendChild(this.toggle);
      }
      this.toggle.title = 'Antwortweg anzeigen';
      this.toggle.setAttribute('aria-label', 'Thinking Trace ein- oder ausblenden');
      this.toggle.classList.toggle('active', this.enabled);
      this.toggle.addEventListener('click', () => {
        this.enabled = !this.enabled;
        this.toggle.classList.toggle('active', this.enabled);
        this.saveSettings();
        this.render();
      });
    }

    createPanel() {
      this.container = document.getElementById('thinking-trace-panel');
      if (this.container) return;

      this.container = document.createElement('aside');
      this.container.id = 'thinking-trace-panel';
      this.container.setAttribute('aria-live', 'polite');
      this.container.innerHTML = [
        '<div class="thinking-trace-header">',
        '  <h2 class="thinking-trace-title">Antwortweg</h2>',
        '  <span class="thinking-trace-status">bereit</span>',
        '</div>',
        '<div class="thinking-trace-body"></div>',
      ].join('');
      document.body.appendChild(this.container);
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved !== null) this.enabled = saved === 'true';
      } catch (_) {}
    }

    saveSettings() {
      try {
        localStorage.setItem(CONFIG.storageKey, String(this.enabled));
      } catch (_) {}
    }

    setupEmotionHook() {
      const self = this;
      const originalHandler = window.handleEmotionOutput;

      window.handleEmotionOutput = function (emotionResults) {
        if (typeof originalHandler === 'function') {
          try { originalHandler(emotionResults); } catch (err) { console.warn('[ThinkingMode] handleEmotionOutput original failed:', err); }
        }

        self.lastEmotionResults = self.normalizeEmotionResults(emotionResults);
        if (self.activeTrace && self.activeTrace.status === 'running') {
          self.activeTrace.emotionResults = self.lastEmotionResults;
          self.rebuildTraceSteps(self.activeTrace);
          self.render();
        }
      };
    }

    installGenerateHookWhenReady() {
      if (this.generateHookInstalled) return;

      if (typeof window.generateSmartReply === 'function') {
        this.wrapGenerateSmartReply();
        return;
      }

      if (this.hookAttempts > 40) return;
      this.hookAttempts += 1;
      setTimeout(() => this.installGenerateHookWhenReady(), 100);
    }

    wrapGenerateSmartReply() {
      if (this.generateHookInstalled || window.generateSmartReply.__thinkingTraceWrapped) return;

      const self = this;
      const original = window.generateSmartReply;

      async function tracedGenerateSmartReply(text, reply, emotionResults) {
        const trace = self.startTrace(text, reply, emotionResults);
        try {
          const result = await original.apply(this, arguments);
          self.finishTrace(trace.id, result, null);
          return result;
        } catch (err) {
          self.finishTrace(trace.id, null, err);
          throw err;
        }
      }

      tracedGenerateSmartReply.__thinkingTraceWrapped = true;
      tracedGenerateSmartReply.__thinkingTraceOriginal = original;
      window.generateSmartReply = tracedGenerateSmartReply;
      this.generateHookInstalled = true;
    }

    startTrace(text, baseReply, emotionResults) {
      const trace = {
        id: ++this.traceCounter,
        startedAt: Date.now(),
        status: 'running',
        input: typeof text === 'string' ? text : '',
        baseReply: typeof baseReply === 'string' ? baseReply : '',
        finalReply: '',
        emotionResults: this.normalizeEmotionResults(emotionResults) || this.lastEmotionResults,
        error: null,
        steps: [],
      };

      this.activeTrace = trace;
      this.traces.unshift(trace);
      if (this.traces.length > CONFIG.maxStoredTraces) this.traces.length = CONFIG.maxStoredTraces;

      this.rebuildTraceSteps(trace);
      this.render();
      return trace;
    }

    finishTrace(id, finalReply, error) {
      const trace = this.traces.find(item => item.id === id);
      if (!trace) return;

      trace.status = error ? 'error' : 'done';
      trace.finalReply = typeof finalReply === 'string' ? finalReply : '';
      trace.error = error || null;
      trace.durationMs = Date.now() - trace.startedAt;
      this.rebuildTraceSteps(trace);
      this.render();
    }

    rebuildTraceSteps(trace) {
      const steps = [];
      const inputPreview = this.truncate(trace.input, CONFIG.maxInputPreview);
      const emotion = this.describeEmotion(trace.emotionResults);
      const intent = this.detectIntent(trace.input);
      const questionType = this.detectQuestionType(trace.input);
      const context = this.describeContext(trace.input);
      const source = this.describeReplySource();

      steps.push({
        label: 'Eingabe',
        text: inputPreview ? 'Nutzereingabe wurde übernommen und normalisiert.' : 'Keine Eingabe erkannt.',
        detail: inputPreview ? '"' + inputPreview + '"' : '',
      });

      steps.push({
        label: 'Emotion',
        text: emotion.summary,
        detail: emotion.detail,
        meters: emotion.meters,
      });

      steps.push({
        label: 'Signalbewertung',
        text: this.describeSignalDecision(intent, questionType),
        detail: this.describeSignalDetail(intent, questionType),
      });

      steps.push({
        label: 'Kontext',
        text: context.summary,
        detail: context.detail,
      });

      steps.push({
        label: 'Antwortquelle',
        text: source.summary,
        detail: source.detail,
      });

      if (trace.baseReply) {
        steps.push({
          label: 'Basisantwort',
          text: 'Vor der intelligenten Erweiterung stand eine passende Ausgangsantwort bereit.',
          detail: '"' + this.truncate(trace.baseReply, CONFIG.maxReplyPreview) + '"',
        });
      }

      if (trace.status === 'running') {
        steps.push({
          label: 'Generierung',
          text: 'Antwort wird gerade mit den verfügbaren Signalen zusammengesetzt.',
          detail: 'Der finale Text wird nach Abschluss ergänzt.',
        });
      } else if (trace.error) {
        steps.push({
          label: 'Fehler',
          text: 'Die Antwortgenerierung wurde mit einem Fehler beendet.',
          detail: String(trace.error && trace.error.message ? trace.error.message : trace.error),
        });
      } else {
        steps.push({
          label: 'Finale Antwort',
          text: 'Die sichtbare Antwort wurde aus Quelle, Emotion und Kontext abgeleitet.',
          detail: trace.finalReply ? '"' + this.truncate(trace.finalReply, CONFIG.maxReplyPreview) + '"' : 'Keine finale Antwort zurückgegeben.',
        });
      }

      trace.steps = steps;
    }

    describeEmotion(results) {
      const normalized = this.normalizeEmotionResults(results);
      if (!normalized) {
        return {
          summary: 'Noch keine Emotionsverteilung verfügbar.',
          detail: 'Der Trace wartet auf predictEmotionDistribution oder nutzt den zuletzt bekannten Wert.',
          meters: [],
        };
      }

      const entries = Object.keys(normalized)
        .filter(key => typeof normalized[key] === 'number' && isFinite(normalized[key]))
        .sort((a, b) => normalized[b] - normalized[a]);

      if (!entries.length) {
        return {
          summary: 'Die Emotionsdaten waren leer oder ungültig.',
          detail: '',
          meters: [],
        };
      }

      const dominant = entries[0];
      const confidence = normalized[dominant];
      const second = entries[1];
      const gap = second ? confidence - normalized[second] : confidence;
      let certainty = 'unsicher';
      if (confidence >= 0.66 && gap >= 0.18) certainty = 'klar';
      else if (confidence >= 0.45) certainty = 'moderat';

      return {
        summary: 'Dominante Emotion: ' + this.labelEmotion(dominant) + ' (' + Math.round(confidence * 100) + '%, ' + certainty + ').',
        detail: second ? 'Zweitstärkstes Signal: ' + this.labelEmotion(second) + ' (' + Math.round(normalized[second] * 100) + '%).' : '',
        meters: entries.slice(0, 5).map(key => ({
          label: this.labelEmotion(key),
          value: Math.max(0, Math.min(1, normalized[key])),
        })),
      };
    }

    normalizeEmotionResults(results) {
      if (!results || typeof results !== 'object') return null;
      const out = {};
      let sum = 0;
      for (const key in results) {
        const value = Number(results[key]);
        if (isFinite(value) && value >= 0) {
          out[key] = value;
          sum += value;
        }
      }
      if (sum <= 0) return null;
      for (const key in out) out[key] = out[key] / sum;
      return out;
    }

    labelEmotion(key) {
      const labels = {
        freude: 'Freude',
        wut: 'Wut',
        traurigkeit: 'Traurigkeit',
        angst: 'Angst',
        vertrauen: 'Vertrauen',
        ueberraschung: 'Überraschung',
        neutral: 'Neutral',
      };
      return labels[key] || key;
    }

    detectIntent(text) {
      const normalized = this.normalizeText(text);
      const intents = [
        { name: 'Hilfe', patterns: ['hilfe', 'help', 'wie geht', 'anleitung', 'schritt fuer schritt', 'schritt für schritt'] },
        { name: 'Speichern', patterns: ['speicher', 'merken', 'notier', 'save'] },
        { name: 'Korrektur', patterns: ['falsch', 'stimmt nicht', 'du liegst falsch', 'nein falsch'] },
        { name: 'Fähigkeiten', patterns: ['was kannst du', 'funktionen', 'wozu bist du in der lage'] },
        { name: 'Stimmung', patterns: ['mir geht es', 'ich fuehle', 'ich fühle', 'stimmung', 'laune'] },
      ];

      for (const intent of intents) {
        for (const pattern of intent.patterns) {
          if (normalized.indexOf(this.normalizeText(pattern)) !== -1) return intent.name;
        }
      }
      return null;
    }

    detectQuestionType(text) {
      const normalized = this.normalizeText(text);
      if (!normalized) return null;
      if (/\?$/.test((text || '').trim())) return 'Direkte Frage';
      if (/^(wer|was|wann|wo|warum|wieso|wie|kannst|kann|soll|ist|sind)\b/.test(normalized)) return 'Frage';
      return null;
    }

    describeSignalDecision(intent, questionType) {
      const parts = [];
      if (intent) parts.push('Intent "' + intent + '"');
      if (questionType) parts.push(questionType);
      if (!parts.length) return 'Keine spezielle Absicht erkannt; EgoMorph nutzt Emotion, Kategorie und Standardkontext.';
      return parts.join(' und ') + ' erkannt; die Antwort wird entsprechend ausgerichtet.';
    }

    describeSignalDetail(intent, questionType) {
      const detail = [];
      if (intent) detail.push('Intent steuert Zusatzformulierungen wie Hilfe, Speichern oder Feedback.');
      if (questionType) detail.push('Frageform priorisiert eine erklärende statt rein emotionale Antwort.');
      return detail.join(' ');
    }

    describeContext(inputText) {
      const memory = this.readJsonStorage('egoMemory', []);
      const topics = this.readJsonStorage('egoMemoryTopics', []);
      const inputTokens = new Set(this.tokenize(inputText));
      const matchedTopics = Array.isArray(topics)
        ? topics.filter(topic => inputTokens.has(this.normalizeText(topic))).slice(0, 4)
        : [];

      const recentMemory = Array.isArray(memory)
        ? memory.filter(Boolean).slice(-3)
        : [];

      if (matchedTopics.length) {
        return {
          summary: 'Bekannte Themen wurden wiedererkannt.',
          detail: 'Treffer: ' + matchedTopics.join(', ') + '.',
        };
      }

      if (recentMemory.length) {
        return {
          summary: 'Kurzzeitgedächtnis ist verfügbar.',
          detail: 'Letzte Einträge: ' + recentMemory.map(item => this.truncate(String(item), 48)).join(' | '),
        };
      }

      return {
        summary: 'Kein relevanter gespeicherter Kontext gefunden.',
        detail: 'Die Antwort basiert auf aktueller Eingabe und Emotionsdaten.',
      };
    }

    describeReplySource() {
      try {
        if (window.egoProfile && typeof window.egoProfile.usesApi === 'function' && window.egoProfile.usesApi()) {
          return {
            summary: 'API-Modus ist aktiv; externe Antwortgenerierung wird bevorzugt.',
            detail: 'Falls die API fehlschlägt, fällt EgoMorph auf die lokale Regelpipeline zurück.',
          };
        }
      } catch (_) {}

      try {
        const llmEnabled = typeof window.isLLMEnabled === 'function' && window.isLLMEnabled();
        const llmReady = typeof window.getChatModelStatus === 'function' && window.getChatModelStatus() === 'ready';
        if (llmEnabled && llmReady && typeof window.generateWithLLM === 'function') {
          return {
            summary: 'Lokales LLM ist aktiv und bereit; Modellantwort wird bevorzugt.',
            detail: 'Bei leerer oder fehlerhafter Modellantwort nutzt EgoMorph die Regelpipeline.',
          };
        }
      } catch (_) {}

      return {
        summary: 'Regel- und Kontextpipeline wird verwendet.',
        detail: 'Kategorie, Emotion, Persönlichkeit, Name, Memory und Intent-Zusätze formen die Antwort.',
      };
    }

    render() {
      if (!this.container) return;

      this.container.hidden = !this.enabled;
      if (!this.enabled) return;

      const statusEl = this.container.querySelector('.thinking-trace-status');
      const bodyEl = this.container.querySelector('.thinking-trace-body');
      const trace = this.activeTrace || this.traces[0];

      if (!bodyEl) return;
      if (!trace) {
        if (statusEl) statusEl.textContent = 'bereit';
        bodyEl.innerHTML = '<p class="thinking-empty">Sende eine Nachricht, um den Antwortweg zu sehen.</p>';
        return;
      }

      if (statusEl) {
        statusEl.textContent = trace.status === 'running'
          ? 'arbeitet'
          : (trace.durationMs ? trace.durationMs + ' ms' : 'fertig');
      }

      bodyEl.textContent = '';
      trace.steps.forEach((step, index) => {
        bodyEl.appendChild(this.renderStep(step, index + 1));
      });
    }

    renderStep(step, index) {
      const row = document.createElement('section');
      row.className = 'thinking-step';

      const num = document.createElement('span');
      num.className = 'thinking-step-index';
      num.textContent = String(index);
      row.appendChild(num);

      const content = document.createElement('div');
      const label = document.createElement('div');
      label.className = 'thinking-step-label';
      label.textContent = step.label;
      content.appendChild(label);

      const text = document.createElement('p');
      text.className = 'thinking-step-text';
      text.textContent = step.text || '';
      content.appendChild(text);

      if (step.detail) {
        const detail = document.createElement('p');
        detail.className = 'thinking-step-detail';
        detail.textContent = step.detail;
        content.appendChild(detail);
      }

      if (Array.isArray(step.meters) && step.meters.length) {
        content.appendChild(this.renderMeters(step.meters));
      }

      row.appendChild(content);
      return row;
    }

    renderMeters(meters) {
      const wrap = document.createElement('div');
      wrap.className = 'thinking-meter';

      meters.forEach(item => {
        const row = document.createElement('div');
        row.className = 'thinking-meter-row';

        const label = document.createElement('span');
        label.textContent = item.label;

        const track = document.createElement('span');
        track.className = 'thinking-meter-track';
        const fill = document.createElement('span');
        fill.className = 'thinking-meter-fill';
        fill.style.width = Math.round(item.value * 100) + '%';
        track.appendChild(fill);

        const value = document.createElement('span');
        value.textContent = Math.round(item.value * 100) + '%';

        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(value);
        wrap.appendChild(row);
      });

      return wrap;
    }

    showManualTrace(text, type, opts) {
      const trace = this.startTrace(String(text || ''), '', this.lastEmotionResults);
      trace.status = 'done';
      trace.finalReply = opts && opts.reply ? String(opts.reply) : '';
      trace.steps.push({
        label: type || 'Hinweis',
        text: String(text || ''),
        detail: opts && opts.detail ? String(opts.detail) : '',
      });
      this.render();
      return trace.id;
    }

    explainLast() {
      return this.activeTrace || this.traces[0] || null;
    }

    readJsonStorage(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (_) {
        return fallback;
      }
    }

    normalizeText(text) {
      return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    tokenize(text) {
      return this.normalizeText(text)
        .split(' ')
        .filter(Boolean);
    }

    truncate(text, maxLength) {
      const value = String(text || '').replace(/\s+/g, ' ').trim();
      if (value.length <= maxLength) return value;
      return value.slice(0, Math.max(0, maxLength - 1)).trim() + '…';
    }
  }

  function init() {
    if (window.EgoThinkingMode) return;

    try {
      window.EgoThinkingMode = new ThinkingMode();
      window.showThought = function (text, type, opts) {
        return window.EgoThinkingMode
          ? window.EgoThinkingMode.showManualTrace(text, type, opts || {})
          : null;
      };
      window.clearThoughts = function () {
        if (!window.EgoThinkingMode) return;
        window.EgoThinkingMode.traces = [];
        window.EgoThinkingMode.activeTrace = null;
        window.EgoThinkingMode.render();
      };
      window.explainLastReply = function () {
        return window.EgoThinkingMode ? window.EgoThinkingMode.explainLast() : null;
      };
    } catch (err) {
      console.error('[ThinkingMode] Init fehlgeschlagen:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

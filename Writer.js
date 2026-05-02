/**
 * EgoMorph Writer
 * ===============
 * Ein lokaler Editor mit einfachen Agenten-Aktionen. Die KI-Funktionen sind
 * bewusst nur im Full- oder API-Profil aktiv; Speichern, Export und Zaehlen
 * laufen lokal im Browser.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'egoMorphWriterDocument';
  var TITLE_KEY = 'egoMorphWriterTitle';
  var OPEN_KEY = 'egoMorphWriterOpen';
  var AUTOSAVE_DELAY = 500;

  var state = {
    root: null,
    panel: null,
    titleInput: null,
    editor: null,
    status: null,
    wordCount: null,
    charCount: null,
    countText: null,
    toggle: null,
    autosaveTimer: null,
    busy: false
  };

  var STYLES = [
    '#egoWriterMount{width:min(720px,94vw);margin-top:14px}',
    '#egoWriterPanel{display:none;width:100%;background:#161923;border:1px solid #34384a;border-radius:10px;box-shadow:0 10px 26px rgba(0,0,0,.34);overflow:hidden;text-align:left}',
    '#egoWriterPanel.open{display:block}',
    '.writer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(76,81,106,.45);background:#1d2130}',
    '.writer-title{margin:0;font-size:1rem;color:#eef3ff;font-weight:700}',
    '.writer-mode{font-size:.78rem;color:#a9b5ca;white-space:nowrap}',
    '.writer-body{display:flex;flex-direction:column;gap:10px;padding:12px}',
    '.writer-title-input{width:100%;background:#11141f;color:#eef3ff;border:1px solid #34384a;border-radius:6px;padding:9px 10px;font:inherit}',
    '.writer-editor{width:100%;min-height:260px;max-height:52vh;resize:vertical;background:#10131c;color:#f2f5fb;border:1px solid #34384a;border-radius:8px;padding:12px;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;outline:none}',
    '.writer-editor:focus,.writer-title-input:focus{border-color:#6ea8fe;box-shadow:0 0 0 2px rgba(110,168,254,.16)}',
    '.writer-toolbar{display:flex;flex-wrap:wrap;gap:8px}',
    '.writer-toolbar button{margin-top:0;padding:8px 12px;border-radius:6px;background:#252b3b;border:1px solid #3a4156;color:#eef3ff}',
    '.writer-toolbar button.primary{background:#2d4c7c;border-color:#4773b8}',
    '.writer-toolbar button:disabled{opacity:.55;cursor:not-allowed}',
    '.writer-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#a9b5ca;font-size:.8rem;flex-wrap:wrap}',
    '.writer-status{color:#a9b5ca}',
    '.writer-status.error{color:#ff9c9c}',
    '.writer-status.ok{color:#9ef1a8}',
    '.writer-locked{padding:10px 12px;border:1px solid rgba(250,170,40,.45);border-radius:8px;background:rgba(250,170,40,.08);color:#ffd99a;font-size:.86rem;line-height:1.4}',
    '@media(max-width:640px){#egoWriterMount{width:min(360px,92vw)}.writer-head{align-items:flex-start;flex-direction:column}.writer-editor{min-height:220px}.writer-toolbar button{flex:1 1 calc(50% - 8px);justify-content:center}}'
  ].join('\n');

  function init() {
    state.root = document.getElementById('egoWriterMount');
    if (!state.root) return;
    injectStyles();
    renderShell();
    bindEvents();
    restoreDocument();
    updateAvailability();
    updateCounts();
    restoreOpenState();

    document.addEventListener('ego-profile-change', function () {
      updateAvailability();
      updateModeLabel();
    });
    document.addEventListener('ego-language-change', function () {
      updateTranslations();
      updateAvailability();
      updateModeLabel();
    });
  }

  function t(key, fallback, replacements) {
    var value = window.egoT ? window.egoT(key) : fallback;
    if (!value || value === key) value = fallback || key;
    if (replacements) {
      for (var name in replacements) {
        value = value.replace('{' + name + '}', replacements[name]);
      }
    }
    return value;
  }

  function injectStyles() {
    if (document.getElementById('ego-writer-styles')) return;
    var style = document.createElement('style');
    style.id = 'ego-writer-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function renderShell() {
    state.root.innerHTML = [
      '<div id="egoWriterPanel" aria-live="polite">',
      '  <div class="writer-head">',
      '    <h2 id="writerTitleText" class="writer-title">EgoMorph Writer</h2>',
      '    <span id="writerModeText" class="writer-mode"></span>',
      '  </div>',
      '  <div class="writer-body">',
      '    <div id="writerLockNotice" class="writer-locked" hidden>Der Writer-Agent arbeitet nur im Full- oder API-Modus. Lokales Schreiben, Speichern, Export und Wortzaehlung bleiben verfuegbar.</div>',
      '    <input id="writerTitleInput" class="writer-title-input" type="text" maxlength="80" placeholder="Dokumenttitel">',
      '    <textarea id="writerEditor" class="writer-editor" placeholder="Schreibe hier deinen Text..."></textarea>',
      '    <div class="writer-toolbar">',
      '      <button id="writerSaveBtn" type="button" class="primary">Speichern</button>',
      '      <button id="writerExportBtn" type="button">Export als Text</button>',
      '      <button id="writerContinueBtn" type="button" data-agent-action="continue">Weiterschreiben</button>',
      '      <button id="writerImproveBtn" type="button" data-agent-action="improve">Verbessern</button>',
      '      <button id="writerSummarizeBtn" type="button" data-agent-action="summarize">Zusammenfassen</button>',
      '      <button id="writerClearBtn" type="button">Leeren</button>',
      '    </div>',
      '    <div class="writer-footer">',
      '      <span><strong id="writerWordCount">0</strong> <span id="writerWordsLabel">Woerter</span> · <strong id="writerCharCount">0</strong> <span id="writerCharsLabel">Zeichen</span></span>',
      '      <span id="writerStatus" class="writer-status">bereit</span>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    state.panel = document.getElementById('egoWriterPanel');
    state.titleInput = document.getElementById('writerTitleInput');
    state.editor = document.getElementById('writerEditor');
    state.status = document.getElementById('writerStatus');
    state.wordCount = document.getElementById('writerWordCount');
    state.charCount = document.getElementById('writerCharCount');
    state.countText = document.getElementById('writerWordsLabel');
    state.toggle = document.getElementById('writerToggle');
    updateTranslations();
    updateModeLabel();
  }

  function updateTranslations() {
    setText('writerTitleText', 'writerTitle', 'EgoMorph Writer');
    setText('writerLockNotice', 'writerLockNotice', 'Der Writer-Agent arbeitet nur im Full- oder API-Modus. Lokales Schreiben, Speichern, Export und Wortzaehlung bleiben verfuegbar.');
    setText('writerSaveBtn', 'writerSaveBtn', 'Speichern');
    setText('writerExportBtn', 'writerExportBtn', 'Export als Text');
    setText('writerContinueBtn', 'writerContinueBtn', 'Weiterschreiben');
    setText('writerImproveBtn', 'writerImproveBtn', 'Verbessern');
    setText('writerSummarizeBtn', 'writerSummarizeBtn', 'Zusammenfassen');
    setText('writerClearBtn', 'writerClearBtn', 'Leeren');
    setText('writerWordsLabel', 'writerWordsLabel', 'Woerter');
    setText('writerCharsLabel', 'writerCharsLabel', 'Zeichen');
    if (state.titleInput) state.titleInput.placeholder = t('writerTitlePlaceholder', 'Dokumenttitel');
    if (state.editor) state.editor.placeholder = t('writerEditorPlaceholder', 'Schreibe hier deinen Text...');
    if (state.status && isReadyStatus(state.status.textContent)) {
      state.status.textContent = t('writerReadyStatus', 'bereit');
    }
  }

  function setText(id, key, fallback) {
    var el = document.getElementById(id);
    if (el) el.textContent = t(key, fallback);
  }

  function isReadyStatus(text) {
    return ['bereit', 'ready', 'prêt'].indexOf(text) !== -1;
  }

  function bindEvents() {
    if (state.toggle) {
      state.toggle.addEventListener('click', function () {
        setOpen(!state.panel.classList.contains('open'));
      });
    }

    state.editor.addEventListener('input', function () {
      updateCounts();
      scheduleAutosave();
    });
    state.titleInput.addEventListener('input', scheduleAutosave);

    document.getElementById('writerSaveBtn').addEventListener('click', function () {
      saveDocument(true);
    });
    document.getElementById('writerExportBtn').addEventListener('click', exportText);
    document.getElementById('writerClearBtn').addEventListener('click', clearEditor);

    var agentButtons = state.panel.querySelectorAll('[data-agent-action]');
    for (var i = 0; i < agentButtons.length; i++) {
      agentButtons[i].addEventListener('click', function (event) {
        runAgentAction(event.currentTarget.getAttribute('data-agent-action'));
      });
    }
  }

  function setOpen(open) {
    state.panel.classList.toggle('open', open);
    if (state.toggle) state.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (_) {}
  }

  function restoreOpenState() {
    var open = false;
    try { open = localStorage.getItem(OPEN_KEY) === '1'; } catch (_) {}
    setOpen(open);
  }

  function getProfile() {
    try {
      return window.egoProfile && typeof window.egoProfile.get === 'function'
        ? window.egoProfile.get()
        : 'standard';
    } catch (_) {
      return 'standard';
    }
  }

  function canUseAgent() {
    var profile = getProfile();
    return profile === 'api' || profile === 'full';
  }

  function updateAvailability() {
    var allowed = canUseAgent();
    var notice = document.getElementById('writerLockNotice');
    if (notice) notice.hidden = allowed;

    var buttons = state.panel.querySelectorAll('[data-agent-action]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = !allowed || state.busy;
      buttons[i].title = allowed
        ? t('writerAgentRunTitle', 'Writer-Agent ausfuehren')
        : t('writerAgentLockedTitle', 'Nur im Full- oder API-Modus verfuegbar');
    }
  }

  function updateModeLabel() {
    var el = document.getElementById('writerModeText');
    if (!el) return;
    var profile = getProfile();
    if (profile === 'api') el.textContent = t('writerApiModeActive', 'API-Agent aktiv');
    else if (profile === 'full') el.textContent = t('writerFullModeActive', 'Full-Agent aktiv');
    else el.textContent = t('writerAgentLockedMode', 'Agent gesperrt: {profile}', { profile: profile });
  }

  function restoreDocument() {
    try {
      state.titleInput.value = localStorage.getItem(TITLE_KEY) || '';
      state.editor.value = localStorage.getItem(STORAGE_KEY) || '';
    } catch (_) {}
  }

  function saveDocument(showStatus) {
    try {
      localStorage.setItem(TITLE_KEY, state.titleInput.value || '');
      localStorage.setItem(STORAGE_KEY, state.editor.value || '');
      if (showStatus) setStatus(t('writerSavedStatus', 'Gespeichert'), 'ok');
    } catch (err) {
      setStatus(t('writerSaveFailedPrefix', 'Speichern fehlgeschlagen: ') + shortError(err), 'error');
    }
  }

  function scheduleAutosave() {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(function () {
      saveDocument(false);
      setStatus(t('writerAutosavedStatus', 'Automatisch gespeichert'), 'ok');
    }, AUTOSAVE_DELAY);
  }

  function exportText() {
    var title = (state.titleInput.value || 'egomorph-writer').trim();
    var safeTitle = title.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'egomorph-writer';
    var blob = new Blob([state.editor.value || ''], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = safeTitle + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    setStatus(t('writerExportedStatus', 'Text exportiert'), 'ok');
  }

  function clearEditor() {
    if (state.editor.value && !confirm(t('writerClearConfirm', 'Editor wirklich leeren?'))) return;
    state.editor.value = '';
    updateCounts();
    saveDocument(true);
  }

  function updateCounts() {
    var text = state.editor.value || '';
    var words = text.trim()
      ? text.trim().split(/\s+/).filter(function (part) { return /\p{L}|\p{N}/u.test(part); }).length
      : 0;
    state.wordCount.textContent = String(words);
    state.charCount.textContent = String(text.length);
  }

  async function runAgentAction(action) {
    if (!canUseAgent()) {
      setStatus(t('writerAgentOnlyStatus', 'Agent nur im Full- oder API-Modus verfuegbar'), 'error');
      updateAvailability();
      return;
    }
    if (state.busy) return;

    var currentText = state.editor.value || '';
    if (!currentText.trim() && action !== 'continue') {
      setStatus(t('writerEmptyStatus', 'Der Editor ist leer'), 'error');
      return;
    }

    state.busy = true;
    updateAvailability();
    setStatus(t('writerWorkingStatus', 'Agent arbeitet...'), '');

    try {
      var output = await askWriterAgent(action, currentText, state.titleInput.value || '');
      if (!output || !output.trim()) throw new Error(t('writerEmptyAgentResponse', 'Leere Agent-Antwort'));
      applyAgentOutput(action, output.trim());
      updateCounts();
      saveDocument(false);
      setStatus(t('writerDoneStatus', 'Agent-Aktion abgeschlossen'), 'ok');
    } catch (err) {
      setStatus(shortError(err), 'error');
    } finally {
      state.busy = false;
      updateAvailability();
    }
  }

  function applyAgentOutput(action, output) {
    if (action === 'continue') {
      var separator = state.editor.value.trim() ? '\n\n' : '';
      state.editor.value = state.editor.value.replace(/\s+$/g, '') + separator + output;
      return;
    }
    state.editor.value = output;
  }

  async function askWriterAgent(action, text, title) {
    var profile = getProfile();
    var prompt = buildPrompt(action, text, title);

    if (profile === 'api') {
      if (!window.egoProfile || typeof window.egoProfile.apiChatCompletion !== 'function') {
        throw new Error(t('writerApiNotReady', 'API-Modus ist nicht bereit'));
      }
      return window.egoProfile.apiChatCompletion([
        {
          role: 'system',
          content: t('writerSystemPrompt', 'Du bist EgoMorph Writer, ein praeziser deutscher Schreibagent. Antworte nur mit dem gewuenschten Text, ohne Vorrede.')
        },
        { role: 'user', content: prompt }
      ], 700, { temperature: 0.55 });
    }

    if (profile === 'full') {
      if (typeof window.isLLMEnabled !== 'function' || !window.isLLMEnabled()) {
        throw new Error(t('writerLocalLlmDisabled', 'Lokales LLM ist im Full-Modus deaktiviert'));
      }
      if (typeof window.getChatModelStatus !== 'function' || window.getChatModelStatus() !== 'ready') {
        throw new Error(t('writerLocalLlmNotReady', 'Lokales LLM ist noch nicht bereit'));
      }
      if (typeof window.generateWithLLM !== 'function') {
        throw new Error(t('writerLocalLlmMissing', 'Lokale LLM-Funktion fehlt'));
      }
      return window.generateWithLLM(prompt, { freude: 0.34, wut: 0.33, traurigkeit: 0.33 });
    }

    throw new Error(t('writerAgentUnavailable', 'Writer-Agent nur in Full oder API nutzbar'));
  }

  function buildPrompt(action, text, title) {
    var heading = title ? t('writerPromptTitle', 'Titel: {title}', { title: title }) + '\n' : '';
    if (action === 'continue') {
      return heading + t('writerPromptContinue', 'Schreibe diesen Text sinnvoll weiter. Behalte Stil, Sprache und Perspektive bei. Gib nur die Fortsetzung aus.\n\nText:\n{text}', {
        text: text || t('writerNoTextYet', '[Noch kein Text vorhanden]')
      });
    }
    if (action === 'improve') {
      return heading + t('writerPromptImprove', 'Verbessere den folgenden Text sprachlich, strukturell und in der Klarheit. Erhalte Inhalt und Sprache. Gib nur die verbesserte Fassung aus.\n\nText:\n{text}', { text: text });
    }
    if (action === 'summarize') {
      return heading + t('writerPromptSummarize', 'Fasse den folgenden Text kompakt und praezise zusammen. Gib nur die Zusammenfassung aus.\n\nText:\n{text}', { text: text });
    }
    return heading + text;
  }

  function setStatus(message, type) {
    if (!state.status) return;
    state.status.textContent = message || '';
    state.status.classList.remove('error', 'ok');
    if (type) state.status.classList.add(type);
  }

  function shortError(err) {
    var msg = err && err.message ? err.message : String(err || t('writerUnknownError', 'Unbekannter Fehler'));
    return msg.length > 120 ? msg.slice(0, 117) + '...' : msg;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

(function () {
  'use strict';

  // === Local Llama via Ollama (http://localhost:11434) ===
  // Sends chat messages to a locally running Ollama instance.
  // This is completely free – Ollama runs on your own machine.
  // Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md

  var OLLAMA_URL_KEY     = 'egoOllamaUrl';
  var OLLAMA_MODEL_KEY   = 'egoOllamaModel';
  var OLLAMA_ENABLED_KEY = 'egoOllamaEnabled';

  var _ollamaEnabled = false;
  var _ollamaUrl     = 'http://localhost:11434';
  var _ollamaModel   = 'llama3';
  var _ollamaStatus  = 'idle'; // 'idle' | 'checking' | 'ready' | 'error'

  // ── UI helpers ────────────────────────────────────────────────────────────

  function setStatusEl(msg, color) {
    var el = typeof document !== 'undefined' && document.getElementById('ollamaStatusText');
    if (el) {
      el.textContent = msg;
      el.style.color = color || '';
    }
  }

  // ── Prompt builder ────────────────────────────────────────────────────────

  function buildMessages(userText, emotionContext) {
    var emotionStr = '';
    if (emotionContext && typeof emotionContext === 'object') {
      var dominant = null;
      var maxVal   = 0;
      for (var k in emotionContext) {
        if (typeof emotionContext[k] === 'number' && emotionContext[k] > maxVal) {
          dominant = k;
          maxVal   = emotionContext[k];
        }
      }
      if (dominant) emotionStr = dominant;
    }

    var systemMsg = 'Du bist EgoMorph, ein emotionaler KI-Assistent.';
    if (emotionStr) systemMsg += ' Aktuelle Emotion: ' + emotionStr + '.';
    systemMsg += ' Antworte kurz und prägnant auf Deutsch.';

    var messages = [{ role: 'system', content: systemMsg }];

    // Include recent conversation history (last 3 turns)
    try {
      var hist = JSON.parse(localStorage.getItem('egoConversation') || '[]');
      if (Array.isArray(hist) && hist.length > 0) {
        var recent = hist.slice(-3);
        for (var i = 0; i < recent.length; i++) {
          if (recent[i].user)  messages.push({ role: 'user',      content: recent[i].user  });
          if (recent[i].reply) messages.push({ role: 'assistant', content: recent[i].reply });
        }
      }
    } catch (_) { /* ignore */ }

    messages.push({ role: 'user', content: userText });
    return messages;
  }

  // ── Connection test ───────────────────────────────────────────────────────

  async function testOllamaConnection() {
    _ollamaStatus = 'checking';
    setStatusEl('Verbinde…', '#aaa');

    var url = _ollamaUrl.replace(/\/$/, '');
    try {
      var res = await fetch(url + '/api/tags', {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var models = (data.models || []).map(function (m) { return m.name; });
      _ollamaStatus = 'ready';
      setStatusEl('Verbunden – ' + (models.length ? models.join(', ') : 'keine Modelle'), '#6f6');
      console.log('[ollamaModel] Connected. Available models:', models);
      return true;
    } catch (err) {
      _ollamaStatus = 'error';
      var hint = (err && err.message) ? err.message.slice(0, 80) : String(err).slice(0, 80);
      setStatusEl('Fehler: ' + hint, '#f66');
      console.warn('[ollamaModel] Connection failed:', err);
      return false;
    }
  }

  // ── Public: generate a reply ──────────────────────────────────────────────

  async function generateWithOllama(userText, emotionContext) {
    if (!_ollamaEnabled) return null;

    var url   = _ollamaUrl.replace(/\/$/, '');
    var model = _ollamaModel.trim();
    if (!url || !model) return null;

    // Auto-test if still idle
    if (_ollamaStatus === 'idle') {
      await testOllamaConnection();
    }
    if (_ollamaStatus === 'error') return null;

    var messages = buildMessages(userText, emotionContext);

    try {
      var res = await fetch(url + '/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    model,
          messages: messages,
          stream:   false,
          options:  { temperature: 0.7, num_predict: 120 }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var text = (data.message && data.message.content) ? data.message.content.trim() : '';
      console.log('[ollamaModel] Reply:', text);
      return text || null;
    } catch (err) {
      console.warn('[ollamaModel] Generation error:', err);
      return null;
    }
  }

  // ── Public: UI callbacks ──────────────────────────────────────────────────

  function setOllamaEnabled(val) {
    _ollamaEnabled = !!val;
    try { localStorage.setItem(OLLAMA_ENABLED_KEY, _ollamaEnabled ? '1' : '0'); } catch (_) { /* ignore */ }
    var toggle = typeof document !== 'undefined' && document.getElementById('ollamaEnabledToggle');
    if (toggle && toggle.checked !== _ollamaEnabled) toggle.checked = _ollamaEnabled;
    if (_ollamaEnabled && _ollamaStatus === 'idle') {
      testOllamaConnection();
    }
  }

  function saveOllamaSettings() {
    var urlEl   = typeof document !== 'undefined' && document.getElementById('ollamaUrlInput');
    var modelEl = typeof document !== 'undefined' && document.getElementById('ollamaModelInput');

    if (urlEl   && urlEl.value.trim())   _ollamaUrl   = urlEl.value.trim();
    if (modelEl && modelEl.value.trim()) _ollamaModel = modelEl.value.trim();

    try {
      localStorage.setItem(OLLAMA_URL_KEY,   _ollamaUrl);
      localStorage.setItem(OLLAMA_MODEL_KEY, _ollamaModel);
    } catch (_) { /* ignore */ }

    _ollamaStatus = 'idle'; // force re-check
    testOllamaConnection();
  }

  // ── Expose public API ─────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.generateWithOllama   = generateWithOllama;
    window.setOllamaEnabled     = setOllamaEnabled;
    window.saveOllamaSettings   = saveOllamaSettings;
    window.testOllamaConnection = testOllamaConnection;
    window.isOllamaEnabled      = function () { return _ollamaEnabled; };
    window.getOllamaStatus      = function () { return _ollamaStatus; };
  }

  // ── Init: restore settings from localStorage ──────────────────────────────

  function _initOllama() {
    try {
      var storedUrl     = localStorage.getItem(OLLAMA_URL_KEY);
      var storedModel   = localStorage.getItem(OLLAMA_MODEL_KEY);
      var storedEnabled = localStorage.getItem(OLLAMA_ENABLED_KEY);
      if (storedUrl)   _ollamaUrl   = storedUrl;
      if (storedModel) _ollamaModel = storedModel;
      _ollamaEnabled = storedEnabled === '1';
    } catch (_) { /* ignore */ }

    var restoreUI = function () {
      var urlEl   = document.getElementById('ollamaUrlInput');
      var modelEl = document.getElementById('ollamaModelInput');
      var toggle  = document.getElementById('ollamaEnabledToggle');
      if (urlEl)   urlEl.value    = _ollamaUrl;
      if (modelEl) modelEl.value  = _ollamaModel;
      if (toggle)  toggle.checked = _ollamaEnabled;
      if (_ollamaEnabled) {
        testOllamaConnection();
      } else {
        setStatusEl('Nicht verbunden', '#aaa');
      }
    };

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreUI, { once: true });
      } else {
        restoreUI();
      }
    }
  }

  _initOllama();
})();

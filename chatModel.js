(function () {
  'use strict';

  // === Text-generation chat model (LLM) ===
  // Loads any HuggingFace text-generation model via Transformers.js and uses
  // it to produce autonomous replies inside generateSmartReply.
  // The emotion classification model (emotionModel.js) remains independent –
  // this module handles *generation*, not classification.

  var STORAGE_KEY    = 'egoChatModel';
  var ENABLED_KEY    = 'egoLLMEnabled';
  var MAX_TOKENS_KEY = 'egoLLMMaxTokens';
  var DEFAULT_TOKENS = 80;

  var chatGenerator = null;
  var _chatStatus   = 'idle';   // 'idle' | 'loading' | 'ready' | 'error'
  var _llmEnabled   = false;

  // ── UI helpers ────────────────────────────────────────────────────────────

  function setStatusEl(msg, color) {
    var el = typeof document !== 'undefined' && document.getElementById('chatModelStatusText');
    if (el) {
      el.textContent = msg;
      el.style.color = color || '';
    }
  }

  function setInputValue(id, value) {
    var el = typeof document !== 'undefined' && document.getElementById(id);
    if (el && !el.value.trim()) el.value = value;
  }

  // ── Model loading ─────────────────────────────────────────────────────────

  async function initChatModel(modelId) {
    var id = (typeof modelId === 'string' ? modelId.trim() : '');

    if (!id) {
      chatGenerator = null;
      _chatStatus   = 'idle';
      setStatusEl('Kein Modell geladen', '#aaa');
      return;
    }

    _chatStatus = 'loading';
    setStatusEl('Lade Modell…', '#aaa');

    // Bug fix: if Transformers.js hasn't finished loading yet, queue a retry
    // instead of immediately erroring.  This handles the case where the user
    // clicks "Modell laden" before the CDN import completes.
    if (typeof window === 'undefined' || !window.TransformersPipeline) {
      setStatusEl('Warte auf Transformers.js…', '#aaa');
      document.addEventListener('transformers-ready', function () {
        initChatModel(id);
      }, { once: true });
      return;
    }

    try {
      chatGenerator = await window.TransformersPipeline('text-generation', id, {
        // Show download progress so the user knows something is happening.
        progress_callback: function (data) {
          if (data && data.status === 'progress' && typeof data.progress === 'number') {
            setStatusEl('Lade… ' + Math.round(data.progress) + '%', '#aaa');
          } else if (data && data.status === 'initiate') {
            setStatusEl('Initialisiere…', '#aaa');
          }
        },
      });
      _chatStatus = 'ready';
      try { localStorage.setItem(STORAGE_KEY, id); } catch (_) { /* ignore */ }
      // Populate the input field so the loaded model name is visible.
      setInputValue('customChatModelId', id);
      setStatusEl('Bereit (' + id + ')', '#6f6');
      console.log('[chatModel] Loaded:', id);
    } catch (err) {
      chatGenerator = null;
      _chatStatus   = 'error';
      // Show the actual error message (truncated) so the user can debug.
      var hint = (err && err.message) ? err.message.slice(0, 80) : String(err).slice(0, 80);
      setStatusEl('Fehler: ' + hint, '#f66');
      console.warn('[chatModel] Failed to load "' + id + '":', err);
    }
  }

  // ── Prompt builder ────────────────────────────────────────────────────────

  function buildPrompt(userText, emotionContext) {
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

    var prompt = 'Du bist EgoMorph, ein emotionaler KI-Assistent.';
    if (emotionStr) prompt += ' Aktuelle Emotion: ' + emotionStr + '.';
    prompt += '\n';

    // Include recent conversation history from localStorage (last 3 turns).
    try {
      var hist = JSON.parse(localStorage.getItem('egoConversation') || '[]');
      if (Array.isArray(hist) && hist.length > 0) {
        var recent = hist.slice(-3);
        for (var i = 0; i < recent.length; i++) {
          if (recent[i].user)  prompt += 'Nutzer: '   + recent[i].user  + '\n';
          if (recent[i].reply) prompt += 'EgoMorph: ' + recent[i].reply + '\n';
        }
      }
    } catch (_) { /* ignore */ }

    prompt += 'Nutzer: ' + userText + '\nEgoMorph:';
    return prompt;
  }

  // Strip the prompt prefix and cut off at the next speaker marker.
  function extractReply(raw, prompt) {
    var text = typeof raw === 'string' ? raw : '';
    if (text.indexOf(prompt) === 0) text = text.slice(prompt.length);
    text = text.trim();
    var stop = text.search(/\nNutzer:|\nEgoMorph:/);
    if (stop > 0) text = text.slice(0, stop).trim();
    text = text.replace(/\s+/g, ' ').trim();
    if (text && !/[.!?…]$/.test(text)) text += '.';
    return text || null;
  }

  // ── Public: generate a reply ──────────────────────────────────────────────

  async function generateWithLLM(userText, emotionContext) {
    if (!chatGenerator || _chatStatus !== 'ready') return null;

    var maxTokens = DEFAULT_TOKENS;
    try {
      var stored = parseInt(localStorage.getItem(MAX_TOKENS_KEY) || '');
      if (!isNaN(stored) && stored > 0) maxTokens = Math.min(stored, 300);
    } catch (_) { /* ignore */ }

    var prompt = buildPrompt(userText, emotionContext);

    try {
      var output = await chatGenerator(prompt, {
        max_new_tokens:     maxTokens,
        temperature:        0.7,
        repetition_penalty: 1.3,
        do_sample:          true,
      });
      var raw = (output && output[0] && output[0].generated_text) || '';
      return extractReply(raw, prompt);
    } catch (err) {
      console.warn('[chatModel] Generation error:', err);
      return null;
    }
  }

  // ── Public: UI callbacks ──────────────────────────────────────────────────

  function reloadChatModel() {
    var input = typeof document !== 'undefined' && document.getElementById('customChatModelId');
    var id    = input ? input.value.trim() : '';
    initChatModel(id);
  }

  function setLLMEnabled(val) {
    _llmEnabled = !!val;
    try { localStorage.setItem(ENABLED_KEY, _llmEnabled ? '1' : '0'); } catch (_) { /* ignore */ }
    var toggle = typeof document !== 'undefined' && document.getElementById('llmEnabledToggle');
    if (toggle && toggle.checked !== _llmEnabled) toggle.checked = _llmEnabled;
  }

  function saveLLMMaxTokens(value) {
    var n = parseInt(value);
    if (!isNaN(n) && n > 0) {
      try { localStorage.setItem(MAX_TOKENS_KEY, String(Math.min(n, 300))); } catch (_) { /* ignore */ }
    }
  }

  // ── Global exposure ───────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.initChatModel      = initChatModel;
    window.generateWithLLM    = generateWithLLM;
    window.reloadChatModel    = reloadChatModel;
    window.setLLMEnabled      = setLLMEnabled;
    window.saveLLMMaxTokens   = saveLLMMaxTokens;
    window.getChatModelStatus = function () { return _chatStatus; };
    window.isLLMEnabled       = function () { return _llmEnabled; };
  }

  // ── Auto-start ────────────────────────────────────────────────────────────

  function _tryInitChat() {
    try { _llmEnabled = localStorage.getItem(ENABLED_KEY) === '1'; } catch (_) { /* ignore */ }

    var restoreUI = function () {
      var toggle = document.getElementById('llmEnabledToggle');
      if (toggle) toggle.checked = _llmEnabled;
      var maxInput = document.getElementById('llmMaxTokensInput');
      if (maxInput) {
        try {
          var stored = localStorage.getItem(MAX_TOKENS_KEY);
          if (stored) maxInput.value = stored;
        } catch (_) { /* ignore */ }
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', restoreUI, { once: true });
    } else {
      restoreUI();
    }

    var savedModel = '';
    try { savedModel = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { /* ignore */ }

    if (savedModel) {
      // Prefill the input field with the previously used model ID.
      var chatInput = document.getElementById('customChatModelId');
      if (chatInput && !chatInput.value.trim()) chatInput.value = savedModel;
      initChatModel(savedModel).catch(function (err) {
        console.error('[chatModel] Init error:', err);
      });
    } else if (_chatStatus === 'idle') {
      // Bug fix: only reset to "Kein Modell geladen" when the status is still
      // idle.  If the user clicked "Modell laden" before this event fired,
      // _chatStatus is already 'loading' or 'error' – don't overwrite it.
      setStatusEl('Kein Modell geladen', '#aaa');
    }
  }

  if (typeof window !== 'undefined') {
    if (window.TransformersPipeline) {
      _tryInitChat();
    } else {
      document.addEventListener('transformers-ready', _tryInitChat, { once: true });
    }
  }
})();

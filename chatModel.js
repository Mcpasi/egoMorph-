(function () {
  'use strict';

  // === Text-generation chat model (LLM) ===
  // Loads any HuggingFace text-generation model via Transformers.js and uses
  // it to produce autonomous replies inside generateSmartReply.
  // The emotion classification model (emotionModel.js) remains independent –
  // this module handles *generation*, not classification.

  var STORAGE_KEY     = 'egoChatModel';
  var ENABLED_KEY     = 'egoLLMEnabled';
  var MAX_TOKENS_KEY  = 'egoLLMMaxTokens';
  var DEFAULT_TOKENS  = 80;

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

    if (typeof window === 'undefined' || !window.TransformersPipeline) {
      _chatStatus = 'error';
      setStatusEl('Transformers.js nicht verfügbar', '#f66');
      console.warn('[chatModel] TransformersPipeline not found on window.');
      return;
    }

    try {
      chatGenerator = await window.TransformersPipeline('text-generation', id);
      _chatStatus   = 'ready';
      try { localStorage.setItem(STORAGE_KEY, id); } catch (_) { /* ignore */ }
      setStatusEl('Bereit (' + id + ')', '#6f6');
      console.log('[chatModel] Loaded:', id);
    } catch (err) {
      chatGenerator = null;
      _chatStatus   = 'error';
      setStatusEl('Fehler beim Laden', '#f66');
      console.warn('[chatModel] Failed to load "' + id + '":', err);
    }
  }

  // ── Prompt builder ────────────────────────────────────────────────────────

  function buildPrompt(userText, emotionContext) {
    // Determine dominant emotion for context.
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
    if (emotionStr) {
      prompt += ' Aktuelle Emotion: ' + emotionStr + '.';
    }
    prompt += '\n';

    // Include recent conversation history from localStorage (last 3 turns).
    try {
      var raw  = localStorage.getItem('egoConversation') || '[]';
      var hist = JSON.parse(raw);
      if (Array.isArray(hist) && hist.length > 0) {
        var recent = hist.slice(-3);
        for (var i = 0; i < recent.length; i++) {
          var turn = recent[i];
          if (turn.user)  { prompt += 'Nutzer: '   + turn.user  + '\n'; }
          if (turn.reply) { prompt += 'EgoMorph: ' + turn.reply + '\n'; }
        }
      }
    } catch (_) { /* ignore */ }

    prompt += 'Nutzer: ' + userText + '\nEgoMorph:';
    return prompt;
  }

  // Strip the prompt prefix and cut off at the next speaker marker.
  function extractReply(raw, prompt) {
    var text = typeof raw === 'string' ? raw : '';

    // Remove prompt prefix (the model echoes it back in generated_text).
    if (text.indexOf(prompt) === 0) {
      text = text.slice(prompt.length);
    }

    text = text.trim();

    // Stop at the next turn so we don't include hallucinated multi-turn output.
    var stop = text.search(/\nNutzer:|\nEgoMorph:/);
    if (stop > 0) {
      text = text.slice(0, stop).trim();
    }

    // Normalise whitespace and ensure the reply ends with punctuation.
    text = text.replace(/\s+/g, ' ').trim();
    if (text && !/[.!?…]$/.test(text)) {
      text += '.';
    }

    return text || null;
  }

  // ── Public: generate a reply ──────────────────────────────────────────────

  async function generateWithLLM(userText, emotionContext) {
    if (!chatGenerator || _chatStatus !== 'ready') return null;

    var maxTokens = DEFAULT_TOKENS;
    try {
      var stored = parseInt(localStorage.getItem(MAX_TOKENS_KEY) || '');
      if (!isNaN(stored) && stored > 0) {
        maxTokens = Math.min(stored, 300);
      }
    } catch (_) { /* ignore */ }

    var prompt = buildPrompt(userText, emotionContext);

    try {
      var output = await chatGenerator(prompt, {
        max_new_tokens:    maxTokens,
        temperature:       0.7,
        repetition_penalty: 1.3,
        do_sample:         true,
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
    // Keep the toggle checkbox in sync.
    var toggle = typeof document !== 'undefined' && document.getElementById('llmEnabledToggle');
    if (toggle && toggle.checked !== _llmEnabled) {
      toggle.checked = _llmEnabled;
    }
  }

  function saveLLMMaxTokens(value) {
    var n = parseInt(value);
    if (!isNaN(n) && n > 0) {
      try { localStorage.setItem(MAX_TOKENS_KEY, String(Math.min(n, 300))); } catch (_) { /* ignore */ }
    }
  }

  // ── Global exposure ───────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.initChatModel     = initChatModel;
    window.generateWithLLM   = generateWithLLM;
    window.reloadChatModel   = reloadChatModel;
    window.setLLMEnabled     = setLLMEnabled;
    window.saveLLMMaxTokens  = saveLLMMaxTokens;
    window.getChatModelStatus = function () { return _chatStatus; };
    window.isLLMEnabled       = function () { return _llmEnabled; };
  }

  // ── Auto-start ────────────────────────────────────────────────────────────

  function _tryInitChat() {
    try {
      _llmEnabled = localStorage.getItem(ENABLED_KEY) === '1';
    } catch (_) { /* ignore */ }

    // Restore toggle state in UI once the DOM is ready.
    var restoreToggle = function () {
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
      document.addEventListener('DOMContentLoaded', restoreToggle, { once: true });
    } else {
      restoreToggle();
    }

    var savedModel = '';
    try { savedModel = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { /* ignore */ }

    if (savedModel) {
      initChatModel(savedModel).catch(function (err) {
        console.error('[chatModel] Init error:', err);
      });
    } else {
      _chatStatus = 'idle';
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

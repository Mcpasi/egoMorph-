/**
 * resourceProfile.js – Ressourcen-Profil-Verwaltung für egoMorph
 *
 * Steuert vier Betriebsmodi:
 *   lite     – Kein ML, nur Keyword-Erkennung + Template-Antworten
 *   standard – Emotions-Modell (Transformers.js), aber kein LLM
 *   full     – Emotions-Modell + lokales LLM (wie bisher)
  *   api      – Externe API (OpenAI-kompatibel) für Emotion + Antworten
 *
 * Im Lite-Modus wird Transformers.js gar nicht geladen → minimaler
 * Speicher- und CPU-Verbrauch.
 */
 (function () {
  'use strict';
 
  var PROFILE_KEY = 'egoResourceProfile';
  var API_URL_KEY = 'egoApiUrl';
  var API_KEY_KEY = 'egoApiKey';
  var API_MODEL_KEY = 'egoApiModel';
  var VALID_PROFILES = ['lite', 'standard', 'full', 'api'];
  
  // ── State ───────────────────────────────────────────────────────────────
  var _profile = 'standard';
  var _apiUrl = '';
  var _apiKey = '';
  var _apiModel = '';
  
  // ── Helpers ─────────────────────────────────────────────────────────────
 
  function _load() {
    try {
      var p = localStorage.getItem(PROFILE_KEY) || 'standard';
      _profile = VALID_PROFILES.indexOf(p) !== -1 ? p : 'standard';
      _apiUrl = localStorage.getItem(API_URL_KEY) || '';
      _apiKey = localStorage.getItem(API_KEY_KEY) || '';
      _apiModel = localStorage.getItem(API_MODEL_KEY) || '';
    } catch (_) { /* ignore */ }
  }
 
  function _save() {
    try {
      localStorage.setItem(PROFILE_KEY, _profile);
      localStorage.setItem(API_URL_KEY, _apiUrl);
      localStorage.setItem(API_KEY_KEY, _apiKey);
      localStorage.setItem(API_MODEL_KEY, _apiModel);
    } catch (_) { /* ignore */ }
  }
  
    // ── Public API ──────────────────────────────────────────────────────────
 
  function getProfile() { return _profile; }
 
  function setProfile(p) {
    if (VALID_PROFILES.indexOf(p) === -1) return;
    _profile = p;
    _save();
    _updateUI();
    _applyProfile();
  }
  
  function getApiConfig() {
    return { url: _apiUrl, key: _apiKey, model: _apiModel };
  }
 
  function setApiConfig(url, key, model) {
    if (typeof url === 'string') _apiUrl = url.trim();
    if (typeof key === 'string') _apiKey = key.trim();
    if (typeof model === 'string') _apiModel = model.trim();
    _save();
  }
  
  function needsTransformers() {
    return _profile === 'standard' || _profile === 'full';
  }
 
  function needsLLM() {
    return _profile === 'full';
  }
 
  function usesApi() {
    return _profile === 'api';
  }
  
  function usesKeywordOnly() {
    return _profile === 'lite';
  }
  
    // ── Keyword-based emotion detection (Lite mode) ─────────────────────────
  // Uses existing word lists from the main app.  Provides a synchronous
  // fallback when no ML model is loaded.
  
  var KEYWORD_EMOTIONS = {
    freude: ['liebe', 'mag', 'schön', 'gut', 'danke', 'freue', 'glücklich',
             'super', 'toll', 'prima', 'cool', 'nett', 'perfekt', 'wunderbar',
             'genial', 'klasse', 'spitze', 'herrlich', 'fantastisch'],
    wut:    ['hass', 'hasse', 'wütend', 'sauer', 'idiot', 'scheiße', 'blöd',
             'zornig', 'verärgert', 'hässlich', 'schlimm', 'dumm', 'schlecht',
             'nervig', 'doof', 'beschissen'],
    traurigkeit: ['traurig', 'schade', 'verloren', 'allein', 'einsam', 'weine',
                  'depressiv', 'leiden', 'verzweifelt', 'enttäuscht', 'elend',
                  'trostlos', 'hoffnungslos', 'unglücklich'],
    angst:  ['unsicher', 'ängstlich', 'sorge', 'furcht', 'panik', 'gruselig',
             'heftig', 'stress', 'stressig', 'angst', 'bedrohlich'],
             ueberraschung: ['wow', 'überrascht', 'wirklich', 'unglaublich', 'echt',
                    'krass', 'wahnsinn', 'irre'],
    vertrauen: ['vertrauen', 'freund', 'freundin', 'kamerad', 'buddy',
                'sicher', 'geborgen', 'verlässlich']
  };
  
  function keywordEmotionDetect(text) {
    var lower = (text || '').toLowerCase();
    var scores = { freude: 0, wut: 0, traurigkeit: 0, angst: 0,
                   ueberraschung: 0, vertrauen: 0 };
    var total = 0;
 
    for (var emo in KEYWORD_EMOTIONS) {
      var words = KEYWORD_EMOTIONS[emo];
      for (var i = 0; i < words.length; i++) {
        if (lower.indexOf(words[i]) !== -1) {
          scores[emo] += 1;
          total += 1;
        }
      }
    }
    
    // Normalize to distribution for the three core emotions
    var result = { freude: 1 / 3, wut: 1 / 3, traurigkeit: 1 / 3 };
 
    if (total > 0) {
      // Map all six emotions down to the three core ones
      var joy = scores.freude + scores.ueberraschung * 0.5 + scores.vertrauen * 0.3;
      var anger = scores.wut + scores.angst * 0.3;
      var sadness = scores.traurigkeit + scores.angst * 0.5;
      var sum = joy + anger + sadness;
      if (sum > 0) {
        result.freude = joy / sum;
        result.wut = anger / sum;
        result.traurigkeit = sadness / sum;
      }
    }
    
    return result;
  }
  
    // ── External API calls ──────────────────────────────────────────────────
 
  /**
   * Call an OpenAI-compatible /v1/chat/completions endpoint.
   * Works with OpenAI, Ollama, LM Studio, llama.cpp server, etc.
   */
   async function apiChatCompletion(messages, maxTokens) {
    if (!_apiUrl) throw new Error('Keine API-URL konfiguriert');
    var url = _apiUrl.replace(/\/+$/, '');
    if (!/\/v1\//.test(url)) url += '/v1/chat/completions';
    
    var body = {
      model: _apiModel || 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: maxTokens || 150,
      temperature: 0.7
    };
    
    var headers = { 'Content-Type': 'application/json' };
    if (_apiKey) headers['Authorization'] = 'Bearer ' + _apiKey;
 
    var resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    
    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (_) {}
      throw new Error('API ' + resp.status + ': ' + errText.slice(0, 200));
    }
    
    var data = await resp.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content || '';
    }
    return '';
  }
  
  /**
   * Use the external API for emotion classification.
   * Asks the LLM to classify into freude/wut/traurigkeit and return JSON.
   */
   async function apiEmotionDetect(text) {
    var fallback = { freude: 1 / 3, wut: 1 / 3, traurigkeit: 1 / 3 };
    try {
      var messages = [
        {
          role: 'system',
          content: 'Du bist ein Emotionsklassifikator. Analysiere den Text und antworte NUR mit einem JSON-Objekt: {"freude": 0.0-1.0, "wut": 0.0-1.0, "traurigkeit": 0.0-1.0}. Die Werte müssen sich zu 1.0 summieren. Kein anderer Text.'
        },
        { role: 'user', content: text }
      ];
      var reply = await apiChatCompletion(messages, 60);
      // Extract JSON from reply
      var match = reply.match(/\{[^}]+\}/);
      if (match) {
        var parsed = JSON.parse(match[0]);
        if (typeof parsed.freude === 'number' && typeof parsed.wut === 'number' &&
            typeof parsed.traurigkeit === 'number') {
          var sum = parsed.freude + parsed.wut + parsed.traurigkeit;
          if (sum > 0) {
            return {
              freude: parsed.freude / sum,
              wut: parsed.wut / sum,
              traurigkeit: parsed.traurigkeit / sum
            };
          }
        }
      }
    } catch (err) {
      console.warn('[resourceProfile] API emotion detection failed:', err);
    }
    return fallback;
  }
    
  /**
   * Use the external API for text generation (chat reply).
   */
   async function apiGenerateReply(userText, emotionContext) {
    var emotionStr = '';
    if (emotionContext && typeof emotionContext === 'object') {
      var dominant = null;
      var maxVal = 0;
      for (var k in emotionContext) {
        if (typeof emotionContext[k] === 'number' && emotionContext[k] > maxVal) {
          dominant = k;
          maxVal = emotionContext[k];
        }
      }
      if (dominant) emotionStr = dominant;
    }
    
    var sysPrompt = 'Du bist EgoMorph, ein emotionaler KI-Assistent. Antworte empathisch und auf Deutsch. Halte Antworten kurz (1-3 Sätze).';
    if (emotionStr) sysPrompt += ' Aktuelle Emotion des Nutzers: ' + emotionStr + '.';
 
    var messages = [{ role: 'system', content: sysPrompt }];
    
    // Include recent conversation history
    try {
      var hist = JSON.parse(localStorage.getItem('egoConversation') || '[]');
      if (Array.isArray(hist)) {
        var recent = hist.slice(-3);
        for (var i = 0; i < recent.length; i++) {
          if (recent[i].user) messages.push({ role: 'user', content: recent[i].user });
          if (recent[i].reply) messages.push({ role: 'assistant', content: recent[i].reply });
        }
      }
    } catch (_) { /* ignore */ }
    
    messages.push({ role: 'user', content: userText });
 
    var maxTokens = 80;
    try {
      var stored = parseInt(localStorage.getItem('egoLLMMaxTokens') || '');
      if (!isNaN(stored) && stored > 0) maxTokens = Math.min(stored, 300);
    } catch (_) { /* ignore */ }
    
    var reply = await apiChatCompletion(messages, maxTokens);
    return reply ? reply.trim() : null;
  }
  
  // ── UI updates ──────────────────────────────────────────────────────────
 
  function _updateUI() {
    if (typeof document === 'undefined') return;
    
    // Update radio buttons
    var radios = document.querySelectorAll('input[name="resourceProfile"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === _profile;
    }
    
    // Show/hide sections based on profile
    var modelSettings = document.getElementById('modelSettings');
    var chatModelSettings = document.getElementById('chatModelSettings');
    var apiSettings = document.getElementById('apiSettings');
    
    if (modelSettings) {
      modelSettings.style.display = (_profile === 'lite' || _profile === 'api') ? 'none' : '';
    }
    if (chatModelSettings) {
      chatModelSettings.style.display = (_profile === 'full') ? '' : 'none';
    }
    if (apiSettings) {
      apiSettings.style.display = (_profile === 'api') ? '' : 'none';
    }
    
    // Populate API fields with saved values
    var urlInput = document.getElementById('egoApiUrlInput');
    var keyInput = document.getElementById('egoApiKeyInput');
    var modelInput = document.getElementById('egoApiModelInput');
    if (urlInput && _apiUrl && !urlInput.value) urlInput.value = _apiUrl;
    if (keyInput && _apiKey && !keyInput.value) keyInput.value = _apiKey;
    if (modelInput && _apiModel && !modelInput.value) modelInput.value = _apiModel;
  }
  
  // ── Apply profile on load ───────────────────────────────────────────────
  
  function _applyProfile() {
    // Dispatch event so other modules can react
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('ego-profile-change', {
        detail: { profile: _profile }
      }));
    }
  }
  
  // ── Initialization ──────────────────────────────────────────────────────
  
  _load();
 
  if (typeof window !== 'undefined') {
    window.egoProfile = {
      get:                getProfile,
      set:                setProfile,
      needsTransformers:  needsTransformers,
      needsLLM:           needsLLM,
      usesApi:            usesApi,
      usesKeywordOnly:    usesKeywordOnly,
      getApiConfig:       getApiConfig,
      setApiConfig:       setApiConfig,
      keywordEmotionDetect: keywordEmotionDetect,
      apiEmotionDetect:   apiEmotionDetect,
      apiGenerateReply:   apiGenerateReply,
      apiChatCompletion:  apiChatCompletion
    };
    
    // Update UI once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        _updateUI();
      }, { once: true });
    } else {
      _updateUI();
    }
  }
})();
    
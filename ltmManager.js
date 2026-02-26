(function () {
  'use strict';

  // ── Long-term memory manager ────────────────────────────────────────────
  // Stores, retrieves and scores persistent memories across sessions.
  // Uses word-level matching, automatic topic extraction (via compromise.js
  // when available), emotion tagging, deduplication and time-based decay.
  // No monkey-patching of localStorage – all writes are explicit.

  var LTM_KEY = 'egoLongTermMemory';
  var MAX_ENTRIES = 200;
  var MAX_TEXT_LEN = 280;
  var SIMILARITY_THRESHOLD = 0.6; // Jaccard similarity for dedup

  // ── Helpers ─────────────────────────────────────────────────────────────

  function normaliseTimestamp(ts) {
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    return 0;
  }

  function normaliseTopics(topics) {
    if (Array.isArray(topics)) return topics;
    if (topics == null) return [];
    return [topics];
  }

  /** Tokenise a string into lowercase words, stripping punctuation. */
  function tokenise(str) {
    var s = String(str == null ? '' : str).toLowerCase();
    var tokens = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    return tokens;
  }

  /** Jaccard similarity between two token arrays. */
  function jaccardSimilarity(a, b) {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    var setA = new Set(a);
    var setB = new Set(b);
    var intersection = 0;
    setA.forEach(function (t) { if (setB.has(t)) intersection++; });
    var union = new Set([].concat(a, b)).size;
    return union === 0 ? 0 : intersection / union;
  }

  /** Extract topics from text using compromise.js (if loaded). */
  function extractTopics(text) {
    if (typeof nlp !== 'function') return [];
    try {
      var doc = nlp(text);
      var nouns = doc.nouns().toText().split(/\s*,\s*/).filter(Boolean);
      // Deduplicate and limit
      var seen = {};
      var result = [];
      for (var i = 0; i < nouns.length; i++) {
        var n = nouns[i].toLowerCase().trim();
        if (n && !seen[n] && n.length > 1) {
          seen[n] = true;
          result.push(n);
        }
        if (result.length >= 5) break;
      }
      return result;
    } catch (e) {
      return [];
    }
  }

  // ── Entry normalisation ─────────────────────────────────────────────────

  function sanitiseEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { text: String(entry).slice(0, MAX_TEXT_LEN), topics: [], ts: 0, hits: 0, emotion: null };
    }
    if (typeof entry !== 'object') return null;
    var text = entry.text == null ? '' : String(entry.text).slice(0, MAX_TEXT_LEN);
    var hits = typeof entry.hits === 'number' && Number.isFinite(entry.hits) ? entry.hits : 0;
    return {
      text: text,
      topics: normaliseTopics(entry.topics),
      ts: normaliseTimestamp(entry.ts),
      hits: hits,
      emotion: entry.emotion || null
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  function loadLTM() {
    try {
      var raw = localStorage.getItem(LTM_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      var normalised = [];
      for (var i = 0; i < parsed.length; i++) {
        var sanitised = sanitiseEntry(parsed[i]);
        if (sanitised) normalised.push(sanitised);
      }
      return normalised;
    } catch (e) {
      return [];
    }
  }

  function saveLTM(arr) {
    if (!Array.isArray(arr)) return;
    try { localStorage.setItem(LTM_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  // ── Core API ────────────────────────────────────────────────────────────

  /**
   * Add a memory entry.  Detects duplicates by Jaccard similarity and
   * merges them (incrementing hits and refreshing the timestamp) instead
   * of creating a second entry.
   *
   * @param {Object} entry - { text, topics?, emotion? }
   *   text    – the user message to remember
   *   topics  – optional array of topic strings (auto-extracted if empty)
   *   emotion – optional dominant emotion string at time of storage
   */
  function addLongTermMemory(entry) {
    if (!entry || !entry.text) return;
    var text = String(entry.text).trim();
    if (!text) return;
    text = text.slice(0, MAX_TEXT_LEN);

    var now = Date.now();
    var ltm = loadLTM();

    // Auto-extract topics if none provided
    var topics = normaliseTopics(entry.topics);
    if (topics.length === 0) {
      topics = extractTopics(text);
    }

    var emotion = entry.emotion || null;

    // Deduplication: check if a sufficiently similar entry already exists.
    var newTokens = tokenise(text);
    var merged = false;
    for (var i = 0; i < ltm.length; i++) {
      var existingTokens = tokenise(ltm[i].text);
      if (jaccardSimilarity(newTokens, existingTokens) >= SIMILARITY_THRESHOLD) {
        // Merge: update timestamp, increment hits, add any new topics
        ltm[i].ts = now;
        ltm[i].hits = (ltm[i].hits || 0) + 1;
        if (emotion) ltm[i].emotion = emotion;
        // Merge topics
        var existingSet = {};
        var merged_topics = ltm[i].topics || [];
        for (var t = 0; t < merged_topics.length; t++) existingSet[merged_topics[t]] = true;
        for (var t2 = 0; t2 < topics.length; t2++) {
          if (!existingSet[topics[t2]]) merged_topics.push(topics[t2]);
        }
        ltm[i].topics = merged_topics;
        merged = true;
        break;
      }
    }

    if (!merged) {
      ltm.push({ text: text, topics: topics, ts: now, hits: 0, emotion: emotion });
    }

    // Sort: most hits first, then most recent
    ltm.sort(function (a, b) {
      var hitDelta = (b.hits || 0) - (a.hits || 0);
      if (hitDelta !== 0) return hitDelta;
      return normaliseTimestamp(b.ts) - normaliseTimestamp(a.ts);
    });

    // Trim to limit
    if (ltm.length > MAX_ENTRIES) ltm = ltm.slice(0, MAX_ENTRIES);
    saveLTM(ltm);
  }

  /**
   * Query the long-term memory.  Uses word-level matching with weighted
   * scoring that considers text overlap, topic overlap, recency and
   * access frequency.
   *
   * @param {string|*} query - the search string
   * @param {number}   k     - maximum results (default 3)
   * @returns {string[]} array of matching memory texts
   */
  function queryLongTermMemory(query, k) {
    if (k == null) k = 3;
    var ltm = loadLTM();
    var q = String(query == null ? '' : query).trim().toLowerCase();
    var qTokens = tokenise(q);

    for (var i = 0; i < ltm.length; i++) {
      var e = ltm[i];
      var txt = String(e.text == null ? '' : e.text).toLowerCase();
      var entryTokens = tokenise(txt);

      // Text match: count overlapping words normalised by query length
      var wordOverlap = 0;
      for (var w = 0; w < qTokens.length; w++) {
        if (entryTokens.indexOf(qTokens[w]) >= 0) wordOverlap++;
      }
      var textScore = qTokens.length > 0 ? wordOverlap / qTokens.length : 0;

      // Also check full-string includes for substring matches (backwards compat)
      var fullIncludes = txt.includes(q) ? 1 : 0;

      // Topic match: check if any topic contains the query or query tokens
      var topics = normaliseTopics(e.topics);
      var topicScore = 0;
      for (var t = 0; t < topics.length; t++) {
        var topicLower = String(topics[t]).toLowerCase();
        if (topicLower.includes(q)) { topicScore = 1; break; }
        for (var tw = 0; tw < qTokens.length; tw++) {
          if (topicLower.includes(qTokens[tw])) { topicScore = 0.5; break; }
        }
        if (topicScore > 0) break;
      }

      // Recency: exponential decay over days
      var ageDays = Math.max(0, (Date.now() - normaliseTimestamp(e.ts)) / (1000 * 60 * 60 * 24));
      var recencyBoost = 1 / (1 + ageDays);

      // Frequency
      var hitScore = Math.log10(Math.max(0, e.hits || 0) + 1);

      // Combined weighted score
      e._score = (textScore * 2) + (fullIncludes * 1.5) + (topicScore * 1.5) + (hitScore * 0.5) + (recencyBoost * 0.5);
    }

    ltm.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });

    var top = ltm.slice(0, k);

    // Increment hits for retrieved entries
    for (var j = 0; j < top.length; j++) {
      top[j].hits = (top[j].hits || 0) + 1;
      delete top[j]._score;
    }

    // Clean up _score from all entries
    for (var c = 0; c < ltm.length; c++) {
      if (ltm[c]._score != null) delete ltm[c]._score;
    }

    saveLTM(ltm);
    return top.map(function (e) { return e.text; });
  }

  /**
   * Get a summary of recent/important memories for use in prompts.
   *
   * @param {number} n - number of memories to include (default 5)
   * @returns {string} formatted memory summary
   */
  function getLTMSummary(n) {
    if (n == null) n = 5;
    var ltm = loadLTM();
    if (ltm.length === 0) return '';

    // Score by combined recency + frequency
    for (var i = 0; i < ltm.length; i++) {
      var ageDays = Math.max(0, (Date.now() - normaliseTimestamp(ltm[i].ts)) / (1000 * 60 * 60 * 24));
      var recency = 1 / (1 + ageDays);
      var freq = Math.log10(Math.max(0, ltm[i].hits || 0) + 1);
      ltm[i]._score = recency + freq;
    }
    ltm.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });

    var lines = [];
    var count = Math.min(n, ltm.length);
    for (var j = 0; j < count; j++) {
      var e = ltm[j];
      var line = '- ' + e.text;
      if (e.emotion) line += ' [' + e.emotion + ']';
      lines.push(line);
      delete e._score;
    }
    // Clean up
    for (var c = 0; c < ltm.length; c++) {
      if (ltm[c]._score != null) delete ltm[c]._score;
    }
    return lines.join('\n');
  }

  // ── Export / Import / Clear ─────────────────────────────────────────────

  function exportLongTermMemory() {
    var data = loadLTM();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'egomorph_ltm.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importLongTermMemory() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) return;
          var ltm = loadLTM();
          for (var i = 0; i < imported.length; i++) {
            var entry = sanitiseEntry(imported[i]);
            if (entry && entry.text) {
              // Use addLongTermMemory for dedup
              addLongTermMemory(entry);
            }
          }
        } catch (err) {
          console.warn('[ltmManager] Import error:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function clearLongTermMemory() {
    saveLTM([]);
  }

  /** Return number of stored memories. */
  function getLTMCount() {
    return loadLTM().length;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.addLongTermMemory     = addLongTermMemory;
    window.queryLongTermMemory   = queryLongTermMemory;
    window.getLTMSummary         = getLTMSummary;
    window.exportLongTermMemory  = exportLongTermMemory;
    window.importLongTermMemory  = importLongTermMemory;
    window.clearLongTermMemory   = clearLongTermMemory;
    window.getLTMCount           = getLTMCount;
  }

  // For testing (CommonJS)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      addLongTermMemory: addLongTermMemory,
      queryLongTermMemory: queryLongTermMemory,
      getLTMSummary: getLTMSummary,
      clearLongTermMemory: clearLongTermMemory,
      getLTMCount: getLTMCount
    };
  }
})();

(function() {
  // Lightweight long-term memory manager
  const LTM_KEY = 'egoLongTermMemory';

  function loadLTM() {
    try {
      const raw = localStorage.getItem(LTM_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(entry => entry && typeof entry === 'object');
    } catch (e) {
      return [];
    }
  }

  function saveLTM(arr) {
    if (!Array.isArray(arr)) return;
    try { localStorage.setItem(LTM_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function normaliseTimestamp(ts) {
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    return 0;
  }
  function addLongTermMemory(entry) {
    if (!entry || !entry.text) return;
    const now = Date.now();
    const ltm = loadLTM();
    ltm.push({ text: String(entry.text).slice(0, 280), topics: entry.topics || [], ts: now, hits: 0 });
    ltm.sort((a, b) => {
      const hitDelta = (b.hits || 0) - (a.hits || 0);
      if (hitDelta !== 0) return hitDelta;
      const tsA = normaliseTimestamp(a.ts);
      const tsB = normaliseTimestamp(b.ts);
      return tsB - tsA;
    });
    const MAX = 200;
    const trimmed = ltm.slice(0, MAX);
    saveLTM(trimmed);
  }

  function exportLongTermMemory() {
    const data = loadLTM();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'egomorph_ltm.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearLongTermMemory() {
    saveLTM([]);
  }

  function normaliseTopics(topics) {
    if (Array.isArray(topics)) return topics;
    if (topics == null) return [];
    return [topics];
  }
  function queryLongTermMemory(query, k = 3) {
    const ltm = loadLTM();
    const q = String(query == null ? '' : query).trim().toLowerCase();
    for (const e of ltm) {
      const txt = String(e.text == null ? '' : e.text).toLowerCase();
      const topicMatch = normaliseTopics(e.topics).some(t => String(t).toLowerCase().includes(q));
      const has = txt.includes(q) ? 1 : 0;
      const ageDays = Math.max(0, (Date.now() - (e.ts || 0)) / (1000 * 60 * 60 * 24));
      const recencyBoost = 1 / (1 + ageDays);
      const hitScore = Math.log10((Math.max(0, e.hits || 0)) + 1);
      const matchScore = has + (topicMatch ? 1 : 0);
      e._score = matchScore + hitScore + recencyBoost;
    }
    ltm.sort((a, b) => (b._score || 0) - (a._score || 0));
    const top = ltm.slice(0, k);
    for (const e of top) {
      e.hits = (e.hits || 0) + 1;
      delete e._score;
    }
    for (const e of ltm) {
      if (e._score != null) delete e._score;
    }
    saveLTM(ltm);
    return top.map(e => e.text);
  }

  // Hook into memory persistence spot to also capture LTM
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    try {
      if (key === 'egoMemory' || key === 'egoConversation' || key === 'egoMemoryTopics') {
        try {
          const conv = key === 'egoConversation' ? JSON.parse(value) : JSON.parse(localStorage.getItem('egoConversation') || '[]');
          const mem = key === 'egoMemory' ? JSON.parse(value) : JSON.parse(localStorage.getItem('egoMemory') || '[]');
          const topics = key === 'egoMemoryTopics' ? JSON.parse(value) : JSON.parse(localStorage.getItem('egoMemoryTopics') || '[]');
          if (Array.isArray(conv) && conv.length > 0) {
            for (let i = conv.length - 1; i >= 0; i--) {
              if (conv[i] && conv[i].user && String(conv[i].user).trim()) {
                addLongTermMemory({ text: conv[i].user, topics });
                break;
              }
            }
          } else if (Array.isArray(mem) && mem.length > 0) {
            addLongTermMemory({ text: mem[mem.length - 1], topics });
          }
        } catch (_) {}
      }
    } catch (_) {}
    return _setItem(key, value);
  };

  window.exportLongTermMemory = exportLongTermMemory;
  window.clearLongTermMemory = clearLongTermMemory;
  window.queryLongTermMemory = queryLongTermMemory;
})();

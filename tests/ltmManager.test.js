describe('ltmManager', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  let store;

  beforeEach(() => {
    jest.resetModules();
    store = {};

    global.window = global;
    global.localStorage = {
      store,
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
      },
      setItem(key, value) {
        this.store[key] = String(value);
      },
      removeItem(key) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      }
    };

    global.URL = {
      createObjectURL: () => 'blob:url',
      revokeObjectURL: () => {}
    };

    global.Blob = class {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    };

    global.document = {
      createElement: () => ({ click() {}, set href(v) {}, set download(v) {} })
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.window;
    delete global.localStorage;
    delete global.URL;
    delete global.Blob;
    delete global.document;
  });

  // ── queryLongTermMemory ──────────────────────────────────────────────

  test('prefers recent entries when boosting recency', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'alte erinnerung', ts: now - 10 * DAY_MS, topics: ['allgemein'], hits: 0 },
      { text: 'frische erinnerung', ts: now - 1 * DAY_MS, topics: ['allgemein'], hits: 0 }
    ]);

    require('../ltmManager');

    const result = global.queryLongTermMemory('erinnerung', 2);

    expect(result[0]).toBe('frische erinnerung');
    expect(result[1]).toBe('alte erinnerung');
  });

  test('matches topics when the query is a partial match', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'spreche ueber astronomie', ts: now, topics: ['astronomie'], hits: 0 }
    ]);

    require('../ltmManager');

    const result = global.queryLongTermMemory('astro', 1);

    expect(result).toEqual(['spreche ueber astronomie']);
  });

  test('ignores surrounding whitespace when matching queries', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'diskussion ueber physik', ts: now, topics: ['wissenschaft'], hits: 0 }
    ]);

    require('../ltmManager');

    const result = global.queryLongTermMemory('  physik  ', 1);

    expect(result).toEqual(['diskussion ueber physik']);
  });

  test('handles non-string queries and topic strings gracefully', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'zahlung mit rechnung', ts: now, topics: 'rechnung', hits: 0 }
    ]);

    require('../ltmManager');

    let result;
    expect(() => { result = global.queryLongTermMemory(123, 1); }).not.toThrow();
    expect(result).toEqual(['zahlung mit rechnung']);
  });

  test('upgrades legacy string entries into structured objects', () => {
    store.egoLongTermMemory = JSON.stringify(['alte notiz ueber katzen']);

    require('../ltmManager');

    const result = global.queryLongTermMemory('katzen', 1);
    expect(result).toEqual(['alte notiz ueber katzen']);

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed[0]).toMatchObject({ text: 'alte notiz ueber katzen', hits: 1 });
  });

  // ── addLongTermMemory ───────────────────────────────────────────────

  test('adds new entries with timestamp and emotion', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    require('../ltmManager');

    global.addLongTermMemory({ text: 'ich mag hunde', topics: ['tiere'], emotion: 'freude' });

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed.length).toBe(1);
    expect(parsed[0]).toMatchObject({
      text: 'ich mag hunde',
      topics: ['tiere'],
      emotion: 'freude',
      ts: now,
      hits: 0
    });
  });

  test('deduplicates similar entries by merging', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'ich mag hunde sehr', ts: now - DAY_MS, topics: ['tiere'], hits: 2, emotion: null }
    ]);

    require('../ltmManager');

    // Add a very similar message
    global.addLongTermMemory({ text: 'ich mag hunde', topics: ['haustiere'], emotion: 'freude' });

    const parsed = JSON.parse(store.egoLongTermMemory);
    // Should be merged into one entry, not two
    expect(parsed.length).toBe(1);
    expect(parsed[0].hits).toBe(3); // incremented
    expect(parsed[0].ts).toBe(now); // refreshed
    expect(parsed[0].emotion).toBe('freude'); // updated
    expect(parsed[0].topics).toContain('tiere');
    expect(parsed[0].topics).toContain('haustiere');
  });

  test('does not merge dissimilar entries', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'ich mag hunde', ts: now - DAY_MS, topics: [], hits: 0, emotion: null }
    ]);

    require('../ltmManager');

    global.addLongTermMemory({ text: 'das wetter ist schoen heute' });

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed.length).toBe(2);
  });

  test('sorts new entries ahead of legacy ones without timestamps', () => {
    store.egoLongTermMemory = JSON.stringify([
      { text: 'alte notiz', hits: 0 }
    ]);

    const now = 1_700_000_100_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    require('../ltmManager');

    global.addLongTermMemory({ text: 'frische notiz' });

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed[0].text).toBe('frische notiz');
    expect(parsed[1].text).toBe('alte notiz');
  });

  test('ignores entries with empty or missing text', () => {
    require('../ltmManager');

    global.addLongTermMemory({ text: '' });
    global.addLongTermMemory({ text: null });
    global.addLongTermMemory(null);

    expect(store.egoLongTermMemory).toBeUndefined();
  });

  test('respects the 200 entry limit', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    // Pre-fill with 200 entries
    const entries = [];
    for (let i = 0; i < 200; i++) {
      entries.push({ text: 'eintrag nummer ' + i, ts: now - i * DAY_MS, topics: [], hits: 0, emotion: null });
    }
    store.egoLongTermMemory = JSON.stringify(entries);

    require('../ltmManager');

    global.addLongTermMemory({ text: 'ganz neuer eintrag' });

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed.length).toBeLessThanOrEqual(200);
  });

  // ── clearLongTermMemory ─────────────────────────────────────────────

  test('clears all entries', () => {
    store.egoLongTermMemory = JSON.stringify([
      { text: 'etwas', ts: 0, topics: [], hits: 0, emotion: null }
    ]);

    require('../ltmManager');

    global.clearLongTermMemory();

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed).toEqual([]);
  });

  // ── getLTMSummary ───────────────────────────────────────────────────

  test('returns a formatted summary of top memories', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'ich liebe programmieren', ts: now, topics: [], hits: 5, emotion: 'freude' },
      { text: 'mein hund heisst rex', ts: now - DAY_MS, topics: ['tiere'], hits: 2, emotion: null }
    ]);

    require('../ltmManager');

    const summary = global.getLTMSummary(2);

    expect(summary).toContain('ich liebe programmieren');
    expect(summary).toContain('[freude]');
    expect(summary).toContain('mein hund heisst rex');
  });

  test('returns empty string when no memories exist', () => {
    require('../ltmManager');

    const summary = global.getLTMSummary(5);
    expect(summary).toBe('');
  });

  // ── getLTMCount ─────────────────────────────────────────────────────

  test('returns the number of stored memories', () => {
    store.egoLongTermMemory = JSON.stringify([
      { text: 'eins', ts: 0, topics: [], hits: 0, emotion: null },
      { text: 'zwei', ts: 0, topics: [], hits: 0, emotion: null }
    ]);

    require('../ltmManager');

    expect(global.getLTMCount()).toBe(2);
  });

  // ── corrupted data ──────────────────────────────────────────────────

  test('recovers gracefully from corrupted long-term memory storage', () => {
    store.egoLongTermMemory = 'null';

    require('../ltmManager');

    expect(() => {
      global.addLongTermMemory({ text: 'neue erinnerung' });
    }).not.toThrow();

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].text).toBe('neue erinnerung');
  });

  // ── word-level matching ─────────────────────────────────────────────

  test('matches on individual words, not just full-string includes', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    store.egoLongTermMemory = JSON.stringify([
      { text: 'wir haben ueber hunde gesprochen', ts: now, topics: [], hits: 0, emotion: null },
      { text: 'katzen sind auch toll', ts: now, topics: [], hits: 0, emotion: null }
    ]);

    require('../ltmManager');

    const result = global.queryLongTermMemory('hunde', 1);
    expect(result).toEqual(['wir haben ueber hunde gesprochen']);
  });

  // ── no monkey-patching of localStorage ──────────────────────────────

  test('does not monkey-patch localStorage.setItem', () => {
    const originalSetItem = global.localStorage.setItem;

    require('../ltmManager');

    // After loading, setItem should still be the original
    expect(global.localStorage.setItem).toBe(originalSetItem);
  });
});

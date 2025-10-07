describe('queryLongTermMemory', () => {
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
  test('recovers gracefully from corrupted long-term memory storage', () => {
    store.egoLongTermMemory = 'null';

    require('../ltmManager');

    expect(() => {
      global.localStorage.setItem('egoMemory', JSON.stringify(['neue erinnerung']));
    }).not.toThrow();

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].text).toBe('neue erinnerung');
  });

test('upgrades legacy string entries into structured objects', () => {
    store.egoLongTermMemory = JSON.stringify(['alte notiz ueber katzen']);

    require('../ltmManager');

    const result = global.queryLongTermMemory('katzen', 1);
    expect(result).toEqual(['alte notiz ueber katzen']);

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed[0]).toMatchObject({ text: 'alte notiz ueber katzen', hits: 1, topics: [] });
  });
  test('sorts new entries ahead of legacy ones without timestamps', () => {
    store.egoLongTermMemory = JSON.stringify([
      { text: 'alte notiz', hits: 0 }
    ]);

    const now = 1_700_000_100_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    require('../ltmManager');

    global.localStorage.setItem('egoMemory', JSON.stringify(['frische notiz']));

    const parsed = JSON.parse(store.egoLongTermMemory);
    expect(parsed[0].text).toBe('frische notiz');
    expect(parsed[1].text).toBe('alte notiz');
  });
});

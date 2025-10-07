describe('emotionModel global vocabulary exposure', () => {
  let originalConsole;

  beforeEach(() => {
    jest.resetModules();
    originalConsole = console;
    console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    global.window = global;
    const store = {};
    global.localStorage = {
      getItem: key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: key => { delete store[key]; }
    };
    const fakeTensor = { dispose: jest.fn() };
    const fakePred = { data: jest.fn().mockResolvedValue(new Float32Array([0.4, 0.3, 0.3])), dispose: jest.fn() };
    const fakeModel = {
      add: jest.fn(),
      compile: jest.fn(),
      fit: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      predict: jest.fn(() => fakePred)
    };
    global.tf = {
      loadLayersModel: jest.fn().mockRejectedValue(new Error('no model')),
      sequential: jest.fn(() => fakeModel),
      layers: { dense: jest.fn(() => ({})) },
      tensor2d: jest.fn(() => fakeTensor)
    };
  });

  afterEach(() => {
    console = originalConsole;
    delete global.tf;
    delete global.localStorage;
    delete global.window;
    delete global.emotionVocab;
    delete global.emotionVocabIndex;
  });

  test('exposes vocabulary and index on the global object', () => {
    require('../emotionModel');
    expect(Array.isArray(global.emotionVocab)).toBe(true);
    expect(global.emotionVocab.length).toBeGreaterThan(0);
    expect(typeof global.emotionVocabIndex).toBe('object');
    const firstWord = global.emotionVocab[0];
    expect(firstWord).toBeDefined();
    expect(global.emotionVocabIndex).toHaveProperty(firstWord);
  });
});

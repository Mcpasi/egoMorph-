// Tests for the Transformers.js-based emotion model (emotionModel.js).
// The file exposes its API on window/global and listens for the
// 'transformers-ready' event before loading a model.  Tests mock
// window.TransformersPipeline so no real network requests are made.

describe('emotionModel – Transformers.js implementation', () => {
  let originalConsole;

  function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
  }

  // Build a fake TransformersPipeline factory.
  // window.TransformersPipeline(task, modelId, opts) must resolve to a
  // *classifier function*, which in turn resolves to the label/score outputs.
  function makeFakePipeline(outputs) {
    const classifier = jest.fn().mockResolvedValue(outputs);
    return jest.fn().mockResolvedValue(classifier);
  }

  beforeEach(() => {
    jest.resetModules();
    originalConsole = console;
    console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() };

    // Minimal DOM / browser environment
    global.window = global;
    global.document = {
      addEventListener: jest.fn((evt, cb, opts) => {
        // Store the 'transformers-ready' listener so tests can fire it manually
        if (evt === 'transformers-ready') {
          global._transformersReadyListener = cb;
        }
      }),
      getElementById: jest.fn(() => null),
    };

    const store = {};
    global.localStorage = {
      getItem:    key        => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem:    (key, val) => { store[key] = String(val); },
      removeItem: key        => { delete store[key]; },
    };

    global._transformersReadyListener = null;
  });

  afterEach(() => {
    console = originalConsole;
    delete global.window;
    delete global.document;
    delete global.localStorage;
    delete global.TransformersPipeline;
    delete global.TransformersEnv;
    delete global.predictEmotionDistribution;
    delete global.createAndTrainEmotionModel;
    delete global.initEmotionModel;
    delete global.reloadEmotionModel;
    delete global.getEmotionModelStatus;
    delete global.emotionVocab;
    delete global.emotionVocabIndex;
    delete global._transformersReadyListener;
  });

  // ── Vocabulary shims ─────────────────────────────────────────────────────

  test('exposes empty vocabulary shims for backwards-compatibility', () => {
    require('../emotionModel');
    expect(Array.isArray(global.emotionVocab)).toBe(true);
    expect(typeof global.emotionVocabIndex).toBe('object');
  });

  // ── Public API surface ───────────────────────────────────────────────────

  test('exposes the expected functions on window', () => {
    require('../emotionModel');
    expect(typeof global.predictEmotionDistribution).toBe('function');
    expect(typeof global.createAndTrainEmotionModel).toBe('function');
    expect(typeof global.initEmotionModel).toBe('function');
    expect(typeof global.reloadEmotionModel).toBe('function');
    expect(typeof global.getEmotionModelStatus).toBe('function');
  });

  // ── Uniform fallback ─────────────────────────────────────────────────────

  test('returns uniform distribution when no classifier is loaded', async () => {
    require('../emotionModel');
    const dist = await global.predictEmotionDistribution('Ich bin glücklich');
    expect(dist).toEqual({ freude: 1 / 3, wut: 1 / 3, traurigkeit: 1 / 3 });
  });

  // ── Model loading via transformers-ready event ───────────────────────────

  test('loads the default model when TransformersPipeline is already available', async () => {
    const fakeOutputs = [
      { label: 'joy',     score: 0.8 },
      { label: 'sadness', score: 0.1 },
      { label: 'anger',   score: 0.1 },
    ];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);

    // TransformersPipeline is available before require – module calls _tryInit directly
    require('../emotionModel');
    await flushPromises();

    expect(global.TransformersPipeline).toHaveBeenCalledWith(
      'text-classification',
      'Xenova/bert-base-multilingual-uncased-sentiment'
    );
    expect(global.getEmotionModelStatus()).toBe('ready');
  });

  test('loads the default model after transformers-ready fires', async () => {
    const fakeOutputs = [
      { label: 'joy',     score: 0.8 },
      { label: 'sadness', score: 0.1 },
      { label: 'anger',   score: 0.1 },
    ];
    // TransformersPipeline is NOT yet set – module registers the event listener
    require('../emotionModel');

    // Now make it available and fire the event
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    expect(global._transformersReadyListener).toBeInstanceOf(Function);
    global._transformersReadyListener();
    await flushPromises();

    expect(global.TransformersPipeline).toHaveBeenCalledWith(
      'text-classification',
      'Xenova/bert-base-multilingual-uncased-sentiment'
    );
    expect(global.getEmotionModelStatus()).toBe('ready');
  });

  // ── Emotion mapping ──────────────────────────────────────────────────────

  test('maps joy-heavy output to high freude', async () => {
    const fakeOutputs = [
      { label: 'joy',     score: 0.9 },
      { label: 'sadness', score: 0.05 },
      { label: 'anger',   score: 0.05 },
    ];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    require('../emotionModel');
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Ich bin so glücklich!');
    expect(dist.freude).toBeGreaterThan(dist.wut);
    expect(dist.freude).toBeGreaterThan(dist.traurigkeit);
    // Values should sum to ~1
    expect(dist.freude + dist.wut + dist.traurigkeit).toBeCloseTo(1, 5);
  });

  test('maps anger-heavy output to high wut', async () => {
    const fakeOutputs = [
      { label: 'anger',   score: 0.85 },
      { label: 'joy',     score: 0.05 },
      { label: 'sadness', score: 0.10 },
    ];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    require('../emotionModel');
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Ich bin wütend!');
    expect(dist.wut).toBeGreaterThan(dist.freude);
    expect(dist.wut).toBeGreaterThan(dist.traurigkeit);
    expect(dist.freude + dist.wut + dist.traurigkeit).toBeCloseTo(1, 5);
  });

  test('maps sadness-heavy output to high traurigkeit', async () => {
    const fakeOutputs = [
      { label: 'sadness', score: 0.85 },
      { label: 'joy',     score: 0.05 },
      { label: 'anger',   score: 0.10 },
    ];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    require('../emotionModel');
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Ich bin so traurig.');
    expect(dist.traurigkeit).toBeGreaterThan(dist.freude);
    expect(dist.traurigkeit).toBeGreaterThan(dist.wut);
    expect(dist.freude + dist.wut + dist.traurigkeit).toBeCloseTo(1, 5);
  });

  // ── Nested output format ─────────────────────────────────────────────────

  test('handles nested array output format [[{label,score},...]]', async () => {
    const fakeOutputs = [[
      { label: 'joy',     score: 0.7 },
      { label: 'sadness', score: 0.3 },
    ]];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    require('../emotionModel');
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Test');
    expect(dist.freude).toBeGreaterThan(dist.traurigkeit);
    expect(dist.freude + dist.wut + dist.traurigkeit).toBeCloseTo(1, 5);
  });

  // ── Error resilience ─────────────────────────────────────────────────────

  test('returns uniform distribution when prediction throws', async () => {
    global.TransformersPipeline = jest.fn().mockResolvedValue(null);
    const throwingClassifier    = jest.fn().mockRejectedValue(new Error('inference error'));
    global.TransformersPipeline = jest.fn().mockResolvedValue(undefined);
    // Bypass pipeline factory to inject a throwing classifier directly
    global.TransformersPipeline = async () => throwingClassifier;

    require('../emotionModel');
    global._transformersReadyListener && global._transformersReadyListener();
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Test');
    expect(dist).toEqual({ freude: 1 / 3, wut: 1 / 3, traurigkeit: 1 / 3 });
  });

  test('sets status to error when model loading fails', async () => {
    global.TransformersPipeline = jest.fn().mockRejectedValue(new Error('network error'));
    require('../emotionModel');
    await flushPromises();

    expect(global.getEmotionModelStatus()).toBe('error');
  });

  // ── Star-rating label mapping ────────────────────────────────────────────

  test('maps 5-star sentiment to high freude', async () => {
    const fakeOutputs = [
      { label: '5 stars', score: 0.9 },
      { label: '1 star',  score: 0.1 },
    ];
    global.TransformersPipeline = makeFakePipeline(fakeOutputs);
    require('../emotionModel');
    await flushPromises();

    const dist = await global.predictEmotionDistribution('Fantastisch!');
    expect(dist.freude).toBeGreaterThan(dist.wut);
    expect(dist.freude).toBeGreaterThan(dist.traurigkeit);
  });

  // ── createAndTrainEmotionModel shim ─────────────────────────────────────

  test('createAndTrainEmotionModel resolves without throwing', async () => {
    global.TransformersPipeline = makeFakePipeline([{ label: 'joy', score: 1.0 }]);
    require('../emotionModel');
    await flushPromises();

    await expect(global.createAndTrainEmotionModel()).resolves.not.toThrow();
  });
});

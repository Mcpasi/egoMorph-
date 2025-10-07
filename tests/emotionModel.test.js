describe('emotionModel global vocabulary exposure', () => {
  let originalConsole;
let fakePred;

  function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
  }
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
    fakePred = { data: jest.fn().mockResolvedValue(new Float32Array([0.4, 0.3, 0.3])), dispose: jest.fn() };
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
      tensor2d: jest.fn(() => ({ dispose: jest.fn() }))
    };
  });

  afterEach(() => {
    console = originalConsole;
    delete global.tf;
    delete global.localStorage;
    delete global.window;
    delete global.emotionVocab;
    delete global.emotionVocabIndex;
    delete global.predictEmotionDistribution;
    delete global.createAndTrainEmotionModel;
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
test('disposes tensors created during training and prediction', async () => {
    const xsTensor = { dispose: jest.fn() };
    const ysTensor = { dispose: jest.fn() };
    const inputTensor = { dispose: jest.fn() };

    global.tf.tensor2d
      .mockReturnValueOnce(xsTensor)
      .mockReturnValueOnce(ysTensor)
      .mockReturnValue(inputTensor);

    require('../emotionModel');

    await flushPromises();

    expect(xsTensor.dispose).toHaveBeenCalledTimes(1);
    expect(ysTensor.dispose).toHaveBeenCalledTimes(1);

    fakePred.dispose.mockClear();

    await global.predictEmotionDistribution('Test text');

    expect(inputTensor.dispose).toHaveBeenCalledTimes(1);
    expect(fakePred.dispose).toHaveBeenCalledTimes(1);
});
});

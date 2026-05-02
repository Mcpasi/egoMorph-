  (function () {
    'use strict';
    
    var DEFAULT_MODEL = 'Xenova/bert-base-multilingual-uncased-sentiment';
    var STORAGE_KEY = 'egoCustomModel';
    
    var emotionClassifier = null;
    var _modelStatus = 'loading';
    
    var emotionVocab = [
      'hallo', 'freude', 'glücklich', 'danke', 'wütend', 'sauer',
      'traurig', 'allein', 'angst', 'panik', 'vertrauen', 'freund'
    ];
    var emotionVocabIndex = {};
    for (var vi = 0; vi < emotionVocab.length; vi++) {
      emotionVocabIndex[emotionVocab[vi]] = vi;
    }
    var legacyModel = null;
    if (typeof window !== 'undefined') {
      window.emotionVocab = emotionVocab;
      window.emotionVocabIndex = emotionVocabIndex;
    }
    
    var LABEL_MAP = {
      
      joy: {freude: 1.0, wut: 0.0, traurigkeit: 0.0},
      love: {freude: 0.8, wut: 0.0, traurigkeit: 0.0},
      anger: {freude: 0.0, wut: 1.0, traurigkeit: 0.1},
      sadness: {freude: 0.0, wut: 0.0, traurigkeit: 1.0},
      fear: {freude: 0.0, wut: 0.2, traurigkeit: 0.7},
      surprise: {freude: 0.5, wut: 0.0, traurigkeit: 0.1},
      disgust: {freude: 0.0, wut: 0.7, traurigkeit: 0.2},
      
      '1 star': {freude: 0.0, wut: 0.5, traurigkeit: 0.5},
      '2 stars': {freude: 0.1, wut: 0.3, traurigkeit: 0.5},
      '3 stars': {freude: 0.33, wut: 0.1, traurigkeit: 0.1},
      '4 stars': {freude: 0.7, wut: 0.0, traurigkeit: 0.0},
      '5 stars': {freude: 1.0, wut: 0.0, traurigkeit: 0.0},
      
      positive: {freude: 0.8, wut: 0.0, traurigkeit: 0.0},
      neutral: {freude: 0.33, wut: 0.1, traurigkeit: 0.1},
      negative: {freude: 0.0, wut: 0.4, traurigkeit: 0.5},
     
      label_0: {freude: 0.6, wut: 0.1, traurigkeit: 0.1},
      label_1: {freude: 0.1, wut: 0.6, traurigkeit: 0.1},
      label_3: {freude: 0.1, wut: 0.1, traurigkeit: 0.6},
  };

  var UNIFORM = {freude: 1/3, wut: 1/3, traurigkeit: 1/3};
  
  function setStatusEl(msg, color) {
    
    var el = typeof document !== 'undefined' && document.getElementById('modelStatusText');
    if (el) {
      el.textContent = msg;
      el.style.color = color || '';
    }
  }

 function mapOutputToEmotions(outputs) {
   var result = {freude: 0, wut: 0, traurigkeit: 0};
   var totalWeight = 0;
   
   for (var i = 0; i < outputs.length; i++) {
     var label = (outputs[i].label || '').toLowerCase();
     var score = outputs[i].score || 0;
     var mapping = LABEL_MAP[label];
     if (!mapping) continue;
     result.freude += mapping.freude * score;
     result.wut += mapping.wut * score;
     result.traurigkeit += mapping.traurigkeit * score;
     totalWeight += score;
    }
    if (totalWeight === 0) return Object.assign({}, UNIFORM);
    var sum = result.freude + result.wut + result.traurigkeit;
    if (sum > 0) {
      result.freude /= sum;
      result.wut /= sum;
      result.traurigkeit /= sum;
    } else {
      return Object.assign({}, UNIFORM);
    }
    return result;
  }
  async function initEmotionModel(modelId) {
    var id = (typeof modelId === 'string' ? modelId.trim() : '') || DEFAULT_MODEL;
    _modelStatus = 'loading';
    setStatusEl('Lade Modell...', '#aaa');
    
    if (typeof window === 'undefined' || !window.TransformersPipeline) {
      _modelStatus = 'error';
      setStatusEl('Transformers.js nicht verfügbar', '#af66');
      console.warn('[emotionModel] Transformers Pipeline not found on window');

      return;
    
    }
    
    try {
      emotionClassifier = await window.TransformersPipeline(
        'text-classification',
        id
      );
      _modelStatus = 'ready';
      try {localStorage.setItem(STORAGE_KEY, id);} catch (_) {/* ignore */}
      setStatusEl('Bereit (' + id + ')', '#6f6');
      console.log('[emotionModel] Loaded model:', id);
    } catch (err) {
      emotionClassifier = null;
      _modelStatus = 'error';
      // Check if the model looks like a text-generation model (gpt, llama, etc.)
      // and give a more helpful hint so the user uses the Chat-Modell slot instead.
      var genKeywords = /gpt|llama|bloom|falcon|mistral|qwen|phi|gemma|opt\b|bart|t5\b|flan|causal/i;
      if (genKeywords.test(id)) {
        setStatusEl('Generierungs-Modell → Chat-Modell-Slot nutzen', '#fa0');
        console.warn('[emotionModel] "' + id + '" appears to be a text-generation model. '
          + 'Use the Chat-Modell settings section for generation models.');
      } else {
        setStatusEl('Fehler beim Laden', '#f66');
        console.warn('[emotionModel] Failed to load model "' + id + '":', err);
      }
    }
  }
  async function predictEmotionDistribution(text) {
   if (legacyModel && typeof tf !== 'undefined' && tf.tensor2d) {
    var inputTensor = null;
    var prediction = null;
    try {
      inputTensor = tf.tensor2d([vectorizeForLegacyModel(text)]);
      prediction = legacyModel.predict(inputTensor);
      var data = await prediction.data();
      return {
        freude: roundScore(data[0]),
        wut: roundScore(data[1]),
        traurigkeit: roundScore(data[2])
      };
    } catch (err) {
      console.warn('[emotionModel] Legacy prediction error', err);
      return Object.assign({}, UNIFORM);
    } finally {
      if (inputTensor && typeof inputTensor.dispose === 'function') inputTensor.dispose();
      if (prediction && typeof prediction.dispose === 'function') prediction.dispose();
    }
   }
   if (!emotionClassifier) return Object.assign({}, UNIFORM);
    try {
     var raw = await emotionClassifier(text, {top_k: null});
     var outputs = Array.isArray(raw[0]) ? raw[0] : raw;
     return mapOutputToEmotions(outputs);
    } catch (err) {
      console.warn('[emotionModel] Prediction error', err);
      return Object.assign({}, UNIFORM);
      
    
  }
  
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

async function createAndTrainEmotionModel() {
  if (typeof window !== 'undefined' && window.tf && !window.TransformersPipeline) {
    return createAndTrainLegacyEmotionModel();
  }
  return initEmotionModel();
}

function vectorizeForLegacyModel(text) {
  var vector = new Array(emotionVocab.length).fill(0);
  var words = String(text || '').toLowerCase().split(/\s+/);
  for (var i = 0; i < words.length; i++) {
    var clean = words[i].replace(/[^\wäöüß]/g, '');
    var idx = emotionVocabIndex[clean];
    if (idx !== undefined) vector[idx] = 1;
  }
  return vector;
}

async function createAndTrainLegacyEmotionModel() {
  if (typeof tf === 'undefined' || !tf.sequential || !tf.tensor2d) {
    return null;
  }
  legacyModel = tf.sequential();
  if (legacyModel.add && tf.layers && tf.layers.dense) {
    legacyModel.add(tf.layers.dense({ inputShape: [emotionVocab.length], units: 8, activation: 'relu' }));
    legacyModel.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
  }
  if (legacyModel.compile) {
    legacyModel.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy' });
  }
  var samples = [
    ['hallo danke freude', [1, 0, 0]],
    ['wütend sauer', [0, 1, 0]],
    ['traurig allein', [0, 0, 1]]
  ];
  var xs = null;
  var ys = null;
  try {
    xs = tf.tensor2d(samples.map(function (sample) { return vectorizeForLegacyModel(sample[0]); }));
    ys = tf.tensor2d(samples.map(function (sample) { return sample[1]; }));
    if (legacyModel.fit) {
      await legacyModel.fit(xs, ys, { epochs: 1 });
    }
    return legacyModel;
  } finally {
    if (xs && typeof xs.dispose === 'function') xs.dispose();
    if (ys && typeof ys.dispose === 'function') ys.dispose();
  }
}

 function reloadEmotionModel() {
   var input = typeof document !== 'undefined' && document.getElementById('customModelId');
   var id = input ? input.value.trim() : '';
   initEmotionModel(id || DEFAULT_MODEL);
 } 
 
 if (typeof window !== 'undefined') {
   window.predictEmotionDistribution = predictEmotionDistribution;
   window.createAndTrainEmotionModel = createAndTrainEmotionModel;
   window.initEmotionModel = initEmotionModel;
   window.reloadEmotionModel = reloadEmotionModel;
   window.getEmotionModelStatus = function () {return _modelStatus;};
 }
 
 function _tryInit() {
   var profile = (window.egoProfile && window.egoProfile.get()) || 'standard';
   if (profile === 'lite' || profile === 'api') {
     _modelStatus = 'idle';
     setStatusEl('Profil: ' + profile + ' – kein ML-Modell nötig', '#aaa');
     console.log('[emotionModel] Skipped – profile is "' + profile + '"');
     return;
   }
   if (!window.TransformersPipeline && window.tf) {
     createAndTrainLegacyEmotionModel().catch(function (err) {
       console.warn('[emotionModel] Legacy model initialisation failed:', err);
     });
     return;
   }
   var saved = '';
   try {saved = localStorage.getItem(STORAGE_KEY) || '';} catch (_) {/* ignore */}
   initEmotionModel(saved).catch(function (err) {
     console.error('[emotionModel] Initialisation error:', err);
     
   });
   }
   
	   if (typeof window !== 'undefined') {
	     if (window.TransformersPipeline || window.tf) {
	       _tryInit();
	     } else if (typeof document !== 'undefined') {
	       document.addEventListener('transformers-ready', _tryInit, {once: true });
	     }
   }
   
 })();

  (function () {
    'use strict';
    
    var DEFAULT_MODEL = 'Xenova/distilroberta-base-emotion';
    var STORAGE_KEY = 'egoCustomModel';
    
    var emotionClassifier = null;
    var _modelStatus = 'loading';
    
    var emotionVocab = [];
    var emotionVocabIndex = {};
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
        id,
        {topk: null}
      );
      _modelStatus = 'ready';
      try {localStorage.setItem(STORAGE_KEY, id);} catch (_) {/* ignore */}
      setStatusEl('Bereit (' + id + ')', '#6f6');
      console.log('[emotionModel] Loaded model:', id);
    } catch (err) {
      emotionClassifier = null;
      _modelStatus = 'error';
      setStatusEl('Fehler beim Laden', '#f66');
      console.warn('[emotionModel] Failed to load model "'+ id + '":', err);
    }
  }
 async function predictEmotionDistribution(text) {
   if (!emotionClassifier) return Object.assign({}, UNIFORM);
    try {
     var raw = await emotionClassifier(text, {topk: null});
     var outputs = Array.isArray(raw[0]) ? raw[0] : raw;
     return mapOutputToEmotions(outputs);
    } catch (err) {
      console.warn('[emotionModel] Prediction error', err);
      return Object.assign({}, UNIFORM);
      
    
  }
  
}

async function createAndTrainEmotionModel() {
  return initEmotionModel();
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
   var saved = '';
   try {saved = localStorage.getItem(STORAGE_KEY) || '';} catch (_) {/* ignore */}
   initEmotionModel(saved).catch(function (err) {
     console.error('[emotionModel] Initialisation error:', err);
     
   });
   }
   
   if (typeof window !== 'undefined') {
     if (window.TransformersPipeline) {
       _tryInit();
     } else { 
       document.addEventListener('transformers-ready', _tryInit, {once: true });
     }
   }
   
 })();

(function(root, factory){
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.vectorizeEmotion = factory(root).vectorizeEmotion;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root){
  function vectorizeEmotion(text, vocab, vocabIndex) {
    const vocabulary = vocab || root.emotionVocab || [];
    const index = vocabIndex || root.emotionVocabIndex || {};
    const vec = new Array(vocabulary.length).fill(0);
    text.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).forEach(tok => {
      if (!tok) return;
      const idx = index[tok];
      if (idx !== undefined) vec[idx] = 1;
    });
    return vec;
  }
  return { vectorizeEmotion };
});

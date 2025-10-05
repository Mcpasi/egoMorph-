(function(root, factory){
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.vectorizeEmotion = factory(root).vectorizeEmotion;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root){
  function vectorizeEmotion(text, vocab, vocabIndex) {
    const useRootVocabulary = !Array.isArray(vocab);
    const vocabulary = useRootVocabulary ? (root.emotionVocab || []) : vocab;

    let index = (vocabIndex && typeof vocabIndex === 'object') ? vocabIndex : null;
    if (!index) {
      if (useRootVocabulary && root.emotionVocabIndex && typeof root.emotionVocabIndex === 'object') {
        index = root.emotionVocabIndex;
      } else {
        index = Object.create(null);
        vocabulary.forEach((word, i) => {
          if (typeof word === 'string') index[word] = i;
        });
      }
    }
    const vec = new Array(vocabulary.length).fill(0);
    const normalised = typeof text === 'string' ? text : text == null ? '' : String(text);
    normalised.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).forEach(tok => {
      if (!tok) return;
      const idx = index[tok];
      if (typeof idx === 'number' && idx >= 0 && idx < vec.length) vec[idx] = 1;
    });
    return vec;
  }
  return { vectorizeEmotion };
});

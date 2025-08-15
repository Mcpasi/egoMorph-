const { vectorizeEmotion } = require('../vectorizeEmotion');

describe('vectorizeEmotion', () => {
  const vocab = ['hallo', 'welt', 'ich', 'fuehle'];
  const vocabIndex = {};
  vocab.forEach((w, i) => { vocabIndex[w] = i; });

  test('marks known words in vector', () => {
    const vec = vectorizeEmotion('Hallo Welt!', vocab, vocabIndex);
    expect(vec).toEqual([1, 1, 0, 0]);
  });

  test('ignores unknown words', () => {
    const vec = vectorizeEmotion('Unbekanntes Wort', vocab, vocabIndex);
    expect(vec).toEqual([0, 0, 0, 0]);
  });
});

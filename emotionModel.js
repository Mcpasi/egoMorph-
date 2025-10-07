(function() {
  // === Emotion classification model ===
  // Defines a simple neural network to recognise three emotions based on
  // short German phrases. The model is trained on load and persisted to
  // local storage to avoid retraining on subsequent visits.
  let emotionModel = null;
  // expose placeholder so other scripts can reference before training
  window.emotionModel = emotionModel;
  const EMOTION_MODEL_STORAGE_KEY = 'emotion-model';
  const emotionClasses = ['freude', 'wut', 'traurigkeit'];
  // Example phrases for each emotion. The vocab and training set are built
  // automatically from these phrases.
  const emotionTrainingPhrases = {
    freude: [
        'Ich fühle mich heute glücklich.',
        'Das macht mich so fröhlich!',
        'Ich liebe diese Erfahrung.',
        'Das ist wirklich großartig.',
        'Ich bin so zufrieden und entspannt.',
        'Es ist ein wunderbarer Tag.',
        'Ich freue mich über deine Worte.',
        'Alles läuft perfekt heute.',
        'Ich empfinde pure Freude.',
        'Dieses Gefühl ist fantastisch.',
        'Ich könnte vor Freude tanzen.',
        'Heute ist ein wundervoller Tag.',
        'Mein Herz platzt vor Glück.',
        'Ich bin so begeistert von allem.',
        'Es läuft gerade alles wie am Schnürchen.',
        'Ich fühle mich lebendig und frei.',
        'Dein Lächeln macht meinen Tag.',
        'Ich liebe es, wie die Sonne scheint.',
        'Ich platze fast vor Freude.',
        'Das war die beste Nachricht des Tages.',
        'Ich schätze diese Momente so sehr.',
        'Ich bin stolz auf das, was ich erreicht habe.',
        'Es erfüllt mich mit Freude, dich zu sehen.',
        'Ich genieße jeden einzelnen Augenblick.',
        'Ich habe das Gefühl, dass alles möglich ist.',
        'Mir geht es rundum großartig.',
        'Ich lache und kann nicht aufhören.',
        'Diese Freude ist ansteckend.',
        'Es ist fantastisch, wie sich alles entwickelt.',
        'Ich fühle mich geborgen und glücklich.',
        'Ich bin dankbar für dieses schöne Leben.',
        'Heute gelingt mir einfach alles.',
        'Ich bin innerlich ganz ruhig und zufrieden.',
        'Das macht mir so viel Spaß.',
        'Ich könnte die ganze Welt umarmen.',
        'Ich fühle eine tiefe Zufriedenheit.',
        'Mir geht das Herz auf.',
        'Ich finde alles gerade wunderbar.',
        'Ich bin voller Energie und Freude.',
        'Ich lächle, ohne es zu merken.'
    ],
    wut: [
        'Ich bin sehr wütend.',
        'Das macht mich richtig sauer.',
        'Ich hasse was hier passiert.',
        'Es frustriert mich total.',
        'Ich bin wirklich verärgert.',
        'Diese Situation ist unerträglich.',
        'Ich könnte vor Wut platzen.',
        'Ich bin komplett außer mir.',
        'Mein Zorn ist groß.',
        'Ich bin so wütend auf dich.',
        'Ich könnte explodieren vor Ärger.',
        'Mir platzt gleich der Kragen.',
        'Das macht mich wahnsinnig wütend.',
        'Ich bin so verärgert, dass ich schreien könnte.',
        'Mein Blut kocht vor Zorn.',
        'Ich kann kaum glauben, wie wütend ich bin.',
        'Diese Ungerechtigkeit macht mich fertig.',
        'Ich fühle mich betrogen und sauer.',
        'Wie kann man nur so dreist sein?',
        'Meine Geduld ist am Ende.',
        'Ich könnte etwas kaputt schlagen.',
        'Lass mich bloß in Ruhe, sonst raste ich aus.',
        'Ich bin bis ins Mark verärgert.',
        'Ich sehe rot vor Wut.',
        'Diese Situation kotzt mich an.',
        'Ich habe die Nase voll von diesem Mist.',
        'Ich kann das nicht länger ertragen.',
        'Ich fühle mich missachtet und wütend.',
        'Es macht mich rasend, was passiert ist.',
        'Ich bin genervt und unglaublich sauer.',
        'Dieser Ärger frisst mich auf.',
        'Ich brodele innerlich vor Wut.',
        'Ich habe absolut keine Geduld mehr.',
        'Ich will einfach nur schreien.',
        'Ich bin angespannt und aufgebracht.',
        'Ich spüre, wie der Ärger in mir aufsteigt.',
        'Dieser Ärger nimmt kein Ende.',
        'Ich bin komplett wutentbrannt.',
        'Ich fühle mich respektlos behandelt.',
        'Das bringt mich auf die Palme.'
    ],
    traurigkeit: [
        'Ich fühle mich sehr traurig.',
        'Es macht mich so traurig.',
        'Ich bin voller Kummer.',
        'Ich fühle mich einsam.',
        'Dieses Ereignis bedrückt mich.',
        'Ich könnte weinen.',
        'Mein Herz ist schwer vor Traurigkeit.',
        'Ich bin hoffnungslos und traurig.',
        'Es ist ein trüber Tag.',
        'Ich bin deprimiert und niedergeschlagen.',
        'Ich fühle mich leer und ausgebrannt.',
        'Meine Stimmung ist am Boden.',
        'Ich kann nicht mehr und will nur weinen.',
        'Es fühlt sich alles so hoffnungslos an.',
        'Ich bin allein und verloren.',
        'Ich kann die Freude nicht finden.',
        'Mein Herz ist schwer wie Blei.',
        'Ich bin tief enttäuscht und traurig.',
        'Alles wirkt sinnlos und trist.',
        'Ich weiß nicht weiter und bin verzweifelt.',
        'Dieses Gefühl der Leere zerreißt mich.',
        'Ich wache traurig auf und gehe traurig schlafen.',
        'Ich fühle mich innerlich kalt und kaputt.',
        'Niemand versteht meinen Schmerz.',
        'Mein Leben fühlt sich wie ein endloses Tal an.',
        'Ich bin innerlich zerbrochen.',
        'Die Traurigkeit überwältigt mich.',
        'Jeder Schritt fällt mir schwer.',
        'Ich habe das Gefühl, zu versagen.',
        'Es fällt mir schwer, überhaupt zu lächeln.',
        'Ich sitze nur da und starre vor mich hin.',
        'Ich fühle mich isoliert und ungeliebt.',
        'Die Einsamkeit frisst mich auf.',
        'Ich finde keinen Trost.',
        'Ich möchte einfach nur verschwinden.',
        'Es ist, als läge ein Schatten auf mir.',
        'Jeder Tag ist eine Herausforderung.',
        'Ich habe die Hoffnung verloren.',
        'Ich fühle mich wie in einem Loch.',
        'Alles scheint grau und bedeutungslos.'
    ]
  };

  // Build the vocabulary for emotion classification.
  let emotionVocab = [];
  let emotionVocabIndex = {};
  const globalTarget = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);

  function exposeVocabulary() {
    if (!globalTarget) return;
    globalTarget.emotionVocab = emotionVocab;
    globalTarget.emotionVocabIndex = emotionVocabIndex;
  }
  (function buildEmotionVocab() {
    const set = new Set();
    for (const cls in emotionTrainingPhrases) {
      emotionTrainingPhrases[cls].forEach(sentence => {
        sentence.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).forEach(tok => {
          if (tok) set.add(tok);
        });
      });
    }
    emotionVocab = Array.from(set);
    emotionVocabIndex = {};
    emotionVocab.forEach((w, i) => { emotionVocabIndex[w] = i; });
    exposeVocabulary();
  })();

  // Convert a sentence into a binary vector over the emotion vocabulary.
  function vectorizeEmotion(sentence) {
    const vec = new Array(emotionVocab.length).fill(0);
    sentence.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).forEach(tok => {
      if (tok && emotionVocabIndex.hasOwnProperty(tok)) {
        vec[emotionVocabIndex[tok]] = 1;
      }
    });
    return vec;
  }

  // Build the training dataset for the emotion model.
  const emotionTrainX = [];
  const emotionTrainY = [];
  (function buildEmotionTrainingSet() {
    emotionClasses.forEach((cls, clsIdx) => {
      const phrases = emotionTrainingPhrases[cls] || [];
      phrases.forEach(sent => {
        emotionTrainX.push(vectorizeEmotion(sent));
        const label = new Array(emotionClasses.length).fill(0);
        label[clsIdx] = 1;
        emotionTrainY.push(label);
      });
    });
  })();

  // Create and train the emotion model. Called immediately on load.
  async function createAndTrainEmotionModel() {
    try {
      emotionModel = await tf.loadLayersModel('localstorage://' + EMOTION_MODEL_STORAGE_KEY);
      window.emotionModel = emotionModel;
      console.log('Loaded existing emotion model from local storage');
      return;
    } catch (err) {
      console.log('No stored emotion model found, training a new one');
    }
    if (emotionTrainX.length === 0) return;
    const xs = tf.tensor2d(emotionTrainX);
    const ys = tf.tensor2d(emotionTrainY);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [emotionVocab.length] }));
    model.add(tf.layers.dense({ units: emotionClasses.length, activation: 'softmax' }));
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    await model.fit(xs, ys, { epochs: 40, batchSize: 8, shuffle: true });
    emotionModel = model;
    window.emotionModel = emotionModel;
    try {
      await model.save('localstorage://' + EMOTION_MODEL_STORAGE_KEY);
      console.log('Emotion model saved to local storage');
    } catch (saveErr) {
      console.warn('Failed to save emotion model', saveErr);
    }
  }

  createAndTrainEmotionModel().catch(err => console.error('Emotion model training failed', err));

  // Predict emotion distribution for a given text. Returns an object with
  // class names as keys and probabilities as values. If the model is
  // unavailable, returns uniform probabilities.
  async function predictEmotionDistribution(text) {
    if (!emotionModel) {
      const num = emotionClasses.length;
      const uniform = {};
      emotionClasses.forEach(cls => { uniform[cls] = 1 / num; });
      return uniform;
    }
    const vec = vectorizeEmotion(text);
    const input = tf.tensor2d([vec]);
    const pred = emotionModel.predict(input);
    const arr = await pred.data();
    const result = {};
    for (let i = 0; i < emotionClasses.length; i++) {
      result[emotionClasses[i]] = arr[i];
    }
    return result;
  }

  window.predictEmotionDistribution = predictEmotionDistribution;
  window.createAndTrainEmotionModel = createAndTrainEmotionModel;
})();

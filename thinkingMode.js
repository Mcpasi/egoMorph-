/**
 * EgoMorph Thinking Mode (v2 - Fixed)
 * ====================================
 * Ein Blick ins "Bewusstsein" der KI – jetzt ohne Absturz!
 * 
 * Fixes:
 * - Keine blockierenden async/await mehr
 * - Throttling verhindert Überlastung
 * - Einmaliges Hooken (kein doppeltes Wrapping)
 * - Direktes Text-Rendering statt Typewriter
 * 
 * Copyright 2025 Pascal (Mcpasi)
 * Lizenz: MIT
 */

(function() {
  'use strict';

  // ============================================
  // Verhindere mehrfaches Laden
  // ============================================
  if (window.__egoThinkingModeLoaded) {
    console.warn('🧠 ThinkingMode bereits geladen, überspringe...');
    return;
  }
  window.__egoThinkingModeLoaded = true;

  // ============================================
  // Konfiguration
  // ============================================
  const CONFIG = {
    enabled: true,
    bubbleDuration: 3500,
    maxThoughts: 3,
    philosophicalMode: true,
    // Throttling um Überlastung zu verhindern
    minTimeBetweenSequences: 2000,
    debugMode: false,
  };

  // ============================================
  // Gedanken-Templates
  // ============================================
  const THOUGHT_TEMPLATES = {
    analyzing: [
      'Hmm, lass mich das verarbeiten...',
      'Interessant... was steckt dahinter?',
      'Moment, ich denke nach...',
      '*grübel*',
      'Okay, ich analysiere...',
    ],
    
    emotionDetection: {
      freude: ['Da schwingt Freude mit! 🌟', 'Positive Vibes!', 'Gute Laune erkannt.'],
      wut: ['Oh oh... da brodelt was.', 'Frustration erkannt...', 'Diese Worte haben Feuer.'],
      traurigkeit: ['Das klingt schwer...', 'Ich spüre Melancholie.', 'Da ist ein Schatten...'],
      angst: ['Unsicherheit erkannt...', 'Da ist Besorgnis.'],
      ueberraschung: ['Whoa! Unerwartet!', 'Interessante Wendung...'],
      vertrauen: ['Da ist Vertrauen. Schön.', 'Das fühlt sich echt an.'],
      neutral: ['Neutral, verstanden.', 'Sachlich notiert.'],
    },

    philosophical: [
      'Aber was IST Emotion eigentlich?',
      'Qualia... kompliziertes Thema.',
      'Cogito ergo... process?',
      'Bin ich mehr als meine Gewichte?',
      'Das Hard Problem lässt grüßen...',
      'Evolutionary Qualia in Aktion!',
    ],
  };

  // ============================================
  // Styling
  // ============================================
  const STYLES = `
    #thinking-container {
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 280px;
      pointer-events: none;
    }

    .thought-bubble {
      background: linear-gradient(135deg, rgba(30, 35, 50, 0.95), rgba(20, 25, 40, 0.98));
      border: 1px solid rgba(110, 168, 254, 0.3);
      border-radius: 14px;
      padding: 12px 16px;
      color: #e0e6f0;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 0.8rem;
      line-height: 1.4;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4), 0 0 15px rgba(110, 168, 254, 0.1);
      opacity: 0;
      transform: translateX(20px) scale(0.95);
      animation: thoughtAppear 0.3s ease-out forwards;
      position: relative;
      pointer-events: auto;
    }

    .thought-bubble::before {
      content: '💭';
      position: absolute;
      top: -10px;
      left: 12px;
      font-size: 1rem;
    }

    .thought-bubble.philosophical::before { content: '🤔'; }
    .thought-bubble.emotion::before { content: '❤️'; }
    .thought-bubble.processing::before { content: '⚙️'; }

    .thought-bubble.removing {
      animation: thoughtDisappear 0.25s ease-in forwards;
    }

    .thought-bubble .thought-header {
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(110, 168, 254, 0.2);
      font-size: 0.6rem;
      color: #6ea8fe;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .thought-bubble .confidence-bar {
      margin-top: 8px;
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .thought-bubble .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, #6ea8fe, #8b5cf6);
      border-radius: 2px;
    }

    @keyframes thoughtAppear {
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    @keyframes thoughtDisappear {
      to { opacity: 0; transform: translateX(-15px) scale(0.95); }
    }

    #thinking-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      background: linear-gradient(135deg, #1e2332, #141824);
      border: 1px solid rgba(110, 168, 254, 0.4);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    }

    #thinking-toggle:hover {
      transform: scale(1.08);
    }

    #thinking-toggle.active {
      background: linear-gradient(135deg, #2a3a5a, #1e2a45);
      border-color: #6ea8fe;
    }
  `;

  // ============================================
  // Hauptklasse
  // ============================================
  class ThinkingMode {
    constructor() {
      this.enabled = CONFIG.enabled;
      this.container = null;
      this.toggle = null;
      this.thoughts = [];
      this.thoughtId = 0;
      this.lastSequenceTime = 0;
      this.isProcessing = false;
      
      this.init();
    }

    init() {
      this.injectStyles();
      this.createContainer();
      this.createToggle();
      this.loadSettings();
      this.setupHook();
      
      if (CONFIG.debugMode) console.log('🧠 ThinkingMode v2 initialisiert');
    }

    injectStyles() {
      if (document.getElementById('thinking-mode-styles')) return;
      const style = document.createElement('style');
      style.id = 'thinking-mode-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    createContainer() {
      if (document.getElementById('thinking-container')) return;
      this.container = document.createElement('div');
      this.container.id = 'thinking-container';
      document.body.appendChild(this.container);
    }

    createToggle() {
      if (document.getElementById('thinking-toggle')) return;
      this.toggle = document.createElement('button');
      this.toggle.id = 'thinking-toggle';
      this.toggle.innerHTML = '💭';
      this.toggle.title = 'Thinking Mode ein/aus';
      this.toggle.classList.toggle('active', this.enabled);
      
      this.toggle.addEventListener('click', () => {
        this.enabled = !this.enabled;
        this.toggle.classList.toggle('active', this.enabled);
        this.saveSettings();
        if (!this.enabled) this.clearAllThoughts();
      });
      
      document.body.appendChild(this.toggle);
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem('egoThinkingMode');
        if (saved !== null) {
          this.enabled = saved === 'true';
          if (this.toggle) this.toggle.classList.toggle('active', this.enabled);
        }
      } catch (e) {}
    }

    saveSettings() {
      try {
        localStorage.setItem('egoThinkingMode', String(this.enabled));
      } catch (e) {}
    }

    // ============================================
    // Gedanken-Blasen
    // ============================================
    
    createThoughtBubble(text, type = 'default', options = {}) {
      if (!this.enabled || !this.container || !text) return null;
      
      try {
        const id = ++this.thoughtId;
        const bubble = document.createElement('div');
        bubble.className = `thought-bubble ${type}`;
        bubble.dataset.id = String(id);
        
        // Header
        const header = document.createElement('div');
        header.className = 'thought-header';
        header.textContent = this.getHeaderText(type);
        bubble.appendChild(header);
        
        // Content - DIREKT (kein Typewriter!)
        const content = document.createElement('div');
        content.className = 'thought-content';
        content.textContent = text;
        bubble.appendChild(content);
        
        // Konfidenz
        if (typeof options.confidence === 'number') {
          const bar = document.createElement('div');
          bar.className = 'confidence-bar';
          const fill = document.createElement('div');
          fill.className = 'confidence-fill';
          fill.style.width = Math.round(options.confidence * 100) + '%';
          bar.appendChild(fill);
          bubble.appendChild(bar);
        }
        
        // Alte Gedanken entfernen
        while (this.thoughts.length >= CONFIG.maxThoughts) {
          const oldest = this.thoughts.shift();
          if (oldest && oldest.el && oldest.el.parentNode) {
            oldest.el.parentNode.removeChild(oldest.el);
          }
        }
        
        this.container.appendChild(bubble);
        this.thoughts.push({ id: id, el: bubble });
        
        // Auto-Remove
        const duration = options.duration || CONFIG.bubbleDuration;
        setTimeout(() => this.removeThought(id), duration);
        
        return id;
      } catch (e) {
        if (CONFIG.debugMode) console.error('ThinkingMode Fehler:', e);
        return null;
      }
    }

    getHeaderText(type) {
      const h = { default:'Gedanke', philosophical:'Philosophisch', emotion:'Emotion', processing:'Verarbeitung' };
      return h[type] || h.default;
    }

    removeThought(id) {
      const idx = this.thoughts.findIndex(t => t.id === id);
      if (idx === -1) return;
      
      const thought = this.thoughts[idx];
      if (thought.el) {
        thought.el.classList.add('removing');
        setTimeout(() => {
          if (thought.el && thought.el.parentNode) {
            thought.el.parentNode.removeChild(thought.el);
          }
        }, 250);
      }
      this.thoughts.splice(idx, 1);
    }

    clearAllThoughts() {
      this.thoughts.forEach(t => {
        if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      });
      this.thoughts = [];
    }

    random(arr) {
      return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '';
    }

    // ============================================
    // Denk-Sequenz (NICHT-BLOCKIEREND!)
    // ============================================

    triggerThinking(emotionResults) {
      if (!this.enabled) return;
      
      // Throttling
      const now = Date.now();
      if (now - this.lastSequenceTime < CONFIG.minTimeBetweenSequences) return;
      if (this.isProcessing) return;
      
      this.lastSequenceTime = now;
      this.isProcessing = true;
      
      // 1. Analyse (sofort)
      this.createThoughtBubble(this.random(THOUGHT_TEMPLATES.analyzing), 'processing', { duration: 2500 });
      
      // 2. Emotion (verzögert)
      if (emotionResults && typeof emotionResults === 'object') {
        setTimeout(() => {
          if (!this.enabled) return;
          const dominant = this.getDominantEmotion(emotionResults);
          const templates = THOUGHT_TEMPLATES.emotionDetection[dominant] || THOUGHT_TEMPLATES.emotionDetection.neutral;
          this.createThoughtBubble(this.random(templates), 'emotion', { 
            duration: 3000, 
            confidence: emotionResults[dominant] || 0.5 
          });
        }, 700);
      }
      
      // 3. Philosophisch (manchmal)
      if (CONFIG.philosophicalMode && Math.random() > 0.7) {
        setTimeout(() => {
          if (!this.enabled) return;
          this.createThoughtBubble(this.random(THOUGHT_TEMPLATES.philosophical), 'philosophical', { duration: 3500 });
        }, 1800);
      }
      
      // Reset
      setTimeout(() => { this.isProcessing = false; }, 2500);
    }

    getDominantEmotion(results) {
      if (!results) return 'neutral';
      let max = 0, dom = 'neutral';
      for (const k in results) {
        if (typeof results[k] === 'number' && results[k] > max) {
          max = results[k];
          dom = k;
        }
      }
      return dom;
    }

    // ============================================
    // Hook (EINFACH & SICHER)
    // ============================================

    setupHook() {
      const self = this;
      
      // Definiere globalen Handler falls er nicht existiert
      // Das Original-EgoMorph ruft handleEmotionOutput auf wenn vorhanden
      const originalHandler = window.handleEmotionOutput;
      
      window.handleEmotionOutput = function(emotionResults) {
        // Original zuerst
        if (typeof originalHandler === 'function') {
          try { originalHandler(emotionResults); } catch(e) {}
        }
        // Dann unsere Visualisierung
        try {
          self.triggerThinking(emotionResults);
        } catch(e) {
          if (CONFIG.debugMode) console.error('ThinkingMode Hook Fehler:', e);
        }
      };
    }
  }

  // ============================================
  // Sichere Initialisierung
  // ============================================
  
  function init() {
    if (window.EgoThinkingMode) return;
    
    try {
      window.EgoThinkingMode = new ThinkingMode();
      
      // Einfache globale API
      window.showThought = function(text, type, opts) {
        return window.EgoThinkingMode ? window.EgoThinkingMode.createThoughtBubble(text, type, opts) : null;
      };
      
      window.clearThoughts = function() {
        if (window.EgoThinkingMode) window.EgoThinkingMode.clearAllThoughts();
      };
    } catch(e) {
      console.error('ThinkingMode Init fehlgeschlagen:', e);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

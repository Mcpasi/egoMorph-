/*
 * EgoMorph appearance settings
 *
 * This script handles the user interface elements that allow the
 * shape of the EgoMorph avatar and the colour of its pupils to be
 * customised.  It runs after the main page content has loaded and
 * interacts with the DOM to update styles.  User selections are
 * persisted via localStorage so that preferences survive page
 * reloads.  No other application logic is modified here.
 */

(() => {
  /**
   * Initialise appearance settings once the DOM is ready.  This
   * function queries the relevant elements, sets up event handlers
   * and applies any persisted values from localStorage.  It is called
   * immediately if the document has already loaded or is registered
   * as a DOMContentLoaded callback if the page is still loading.
   */
  function initAppearanceSettings() {
    const shapeSelect = document.getElementById('shapeSelect');
    const colourSelect = document.getElementById('pupilColorSelect');
    const entity = document.getElementById('entity');
    const applyBtn = document.getElementById('applyAppearanceBtn');
    // Abort if required elements are missing
    if (!shapeSelect || !colourSelect || !entity) return;

    // Helpers to apply styles
    function applyShape(shape) {
      entity.style.clipPath = '';
      entity.style.borderRadius = '';
      switch (shape) {
        case 'square':
          entity.style.borderRadius = '0';
          break;
        case 'triangle':
          entity.style.borderRadius = '0';
          entity.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
          break;
        case 'circle':
        default:
          entity.style.borderRadius = '50%';
          break;
      }
    }
    function applyPupilColour(colour) {
      document.documentElement.style.setProperty('--pupil-color', colour);
    }
    // Change events apply immediately and persist
    shapeSelect.addEventListener('change', () => {
      const val = shapeSelect.value;
      applyShape(val);
      try { localStorage.setItem('egoMorphShape', val); } catch (err) {}
    });
    colourSelect.addEventListener('change', () => {
      const val = colourSelect.value;
      applyPupilColour(val);
      try { localStorage.setItem('egoMorphPupilColour', val); } catch (err) {}
    });
    // Apply button explicitly applies and persists selections
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const shapeVal = shapeSelect.value;
        const colourVal = colourSelect.value;
        applyShape(shapeVal);
        applyPupilColour(colourVal);
        try {
          localStorage.setItem('egoMorphShape', shapeVal);
          localStorage.setItem('egoMorphPupilColour', colourVal);
        } catch (err) {}
      });
    }
    // Restore stored values
    try {
      const storedShape = localStorage.getItem('egoMorphShape');
      if (storedShape) {
        shapeSelect.value = storedShape;
        applyShape(storedShape);
      }
    } catch (err) {}
    try {
      const storedColour = localStorage.getItem('egoMorphPupilColour');
      if (storedColour) {
        colourSelect.value = storedColour;
        applyPupilColour(storedColour);
      }
    } catch (err) {}
  }
  // Expose an explicit function on the global scope so that the
  // appearance can be updated via inline onclick handlers.  This
  // function mirrors the apply button’s behaviour.  If called before
  // initialisation, it will perform a no‑op.
  window.applyAppearanceSettings = function() {
    const shapeSel = document.getElementById('shapeSelect');
    const colourSel = document.getElementById('pupilColorSelect');
    const ent = document.getElementById('entity');
    if (!shapeSel || !colourSel || !ent) return;
    const shapeVal = shapeSel.value;
    const colourVal = colourSel.value;
    // Apply shape
    ent.style.clipPath = '';
    ent.style.borderRadius = '';
    switch (shapeVal) {
      case 'square':
        ent.style.borderRadius = '0';
        break;
      case 'triangle':
        ent.style.borderRadius = '0';
        ent.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        break;
      case 'circle':
      default:
        ent.style.borderRadius = '50%';
        break;
    }
    // Apply colour
    document.documentElement.style.setProperty('--pupil-color', colourVal);
    try {
      localStorage.setItem('egoMorphShape', shapeVal);
      localStorage.setItem('egoMorphPupilColour', colourVal);
    } catch (err) {}
  };
  // Execute initialisation immediately.  The script tag is loaded
  // with the "defer" attribute, so the DOM will have been parsed
  // by the time this code runs and the required elements are
  // available.  If elements are missing for any reason, the
  // init function will safely abort.
  initAppearanceSettings();
})();


(function() {
    // 1. Konfiguration
    const CONFIG = {
        title: "EGOMORPH",
        version: "v0.0.8.0-Alpha",
        description: "Initialisiere Systemkerne...",
        duration: 7000 // Dauer in Millisekunden (4 Sekunden)
    };


    const splashHTML = `
        <div class="ego-morph-container">
            <div class="ego-shape"></div>
        </div>
        <h1 class="ego-title">${CONFIG.title}</h1>
        <div class="ego-version">${CONFIG.version}</div>
        <p class="ego-desc">${CONFIG.description}</p>
        <div class="ego-loader">
            <div class="ego-progress"></div>
        </div>
    `;

    // 3. Das Container-Element erzeugen
    const overlay = document.createElement('div');
    overlay.id = 'egomorph-overlay';
    overlay.innerHTML = splashHTML;


    document.body.prepend(overlay);
    
    // Damit man während des Ladens nicht scrollen kann
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';


    window.addEventListener('load', () => {
        
        setTimeout(() => {
            // Ausblenden starten
            overlay.classList.add('ego-hidden');
            
            // Scrollen wieder erlauben
            document.body.style.overflow = originalOverflow;

            // Nach der CSS Transition (0.8s) das Element komplett löschen
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 800);

        }, CONFIG.duration);
    });

})();

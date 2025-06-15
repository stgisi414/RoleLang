console.log('Importing modules...');

try {
    var api = await import('./api.js');
    console.log('API module loaded');
    var ui = await import('./ui.js');
    console.log('UI module loaded');
    var lesson = await import('./lesson.js');
    console.log('Lesson module loaded');
    var state = await import('./state.js');
    console.log('State module loaded');
} catch (error) {
    console.error('Failed to import modules:', error);
    alert('Failed to load application modules. Please check the console for details.');
}

console.log('main.js loaded');

// --- DOM Elements (global to main.js) ---
let elements = {};

// --- State Persistence Functions (Moved from state.js) ---
function saveState() {
    const appState = {
        lessonPlan: state.lessonPlan,
        currentTurnIndex: state.currentTurnIndex,
        currentScreen: state.lessonPlan ? 'lesson' : 'landing',
        selectedLanguage: elements.languageSelect?.value,
        topicInput: elements.topicInput?.value,
        nativeLang: state.nativeLang,
        lessonsVisible: !elements.lessonsContainer?.classList.contains('hidden'),
        audioSpeed: elements.audioSpeedSelect ? elements.audioSpeedSelect.value : '1',
        lastSaved: Date.now()
    };

    try {
        localStorage.setItem(state.STATE_KEY, JSON.stringify(appState));
    } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
    }
}

function loadState() {
    try {
        const savedState = localStorage.getItem(state.STATE_KEY);
        if (!savedState) return null;

        const parsedState = JSON.parse(savedState);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (parsedState.lastSaved < sevenDaysAgo) {
            localStorage.removeItem(state.STATE_KEY);
            return null;
        }
        return parsedState;
    } catch (error) {
        console.warn('Failed to load state from localStorage:', error);
        localStorage.removeItem(state.STATE_KEY);
        return null;
    }
}

function clearState() {
    localStorage.removeItem(state.STATE_KEY);
    if (ui) {
        ui.hideReviewModeBanner();
    }
}

async function restoreState(savedState) {
    if (savedState.selectedLanguage && elements.languageSelect) elements.languageSelect.value = savedState.selectedLanguage;
    if (savedState.topicInput && elements.topicInput) elements.topicInput.value = savedState.topicInput;
    if (savedState.lessonsVisible && ui) ui.toggleLessonsVisibility(true);
    if (savedState.audioSpeed && elements.audioSpeedSelect) elements.audioSpeedSelect.value = savedState.audioSpeed;

    if (savedState.lessonPlan && savedState.currentScreen === 'lesson') {
        state.setLessonPlan(savedState.lessonPlan);
        state.setCurrentTurnIndex(savedState.currentTurnIndex);

        if (!state.lessonPlan.dialogue || state.lessonPlan.dialogue.length === 0) {
            clearState();
            return;
        }

        if (state.recognition && lesson) {
            state.recognition.lang = lesson.getLangCode(savedState.selectedLanguage);
        }

        elements.landingScreen?.classList.add('hidden');
        elements.lessonScreen?.classList.remove('hidden');

        if (ui) {
            await ui.restoreConversation(state.lessonPlan);
            ui.displayLessonTitleAndContext(state.lessonPlan);

            if (state.lessonPlan.illustration_url) {
                ui.restoreIllustration(state.lessonPlan.illustration_url);
            } else if (state.lessonPlan.illustration_prompt && lesson) {
                lesson.fetchAndDisplayIllustration(state.lessonPlan.illustration_prompt);
            }
        }

        const isCompleted = state.currentTurnIndex >= state.lessonPlan.dialogue.length;
        if (isCompleted) {
            if (elements.micStatus) elements.micStatus.textContent = ui.translateText('lessonComplete');
            if (elements.micBtn) elements.micBtn.disabled = true;
            state.lessonPlan.isCompleted = true;
            if (ui) ui.showReviewModeUI(savedState.selectedLanguage, state.lessonPlan);
        } else {
            state.lessonPlan.isCompleted = false;
            if (lesson) lesson.advanceTurn(state.currentTurnIndex);
        }
        
        if (ui) ui.stopTopicRotations();
    }
}


async function initializeApp() {
    console.log('Initializing app...');
    
    // Prevent duplicate initialization
    if (document.getElementById('app-container')?.dataset.initialized) {
        console.log('App already initialized, skipping...');
        return;
    }
    
    // Populate DOM elements object
    elements = {
        landingScreen: document.getElementById('landing-screen'),
        lessonScreen: document.getElementById('lesson-screen'),
        startLessonBtn: document.getElementById('start-lesson-btn'),
        languageSelect: document.getElementById('language-select'),
        topicInput: document.getElementById('topic-input'),
        illustrationContainer: document.getElementById('illustration-container'),
        illustrationImg: document.getElementById('lesson-illustration'),
        illustrationPlaceholder: document.getElementById('illustration-placeholder'),
        imageLoader: document.getElementById('image-loader'),
        conversationContainer: document.getElementById('conversation-container'),
        micBtn: document.getElementById('mic-btn'),
        micStatus: document.getElementById('mic-status'),
        loadingSpinner: document.getElementById('loading-spinner'),
        audioSpeedSelect: document.getElementById('audio-speed'),
        resetLessonBtn: document.getElementById('reset-lesson-btn'),
        modal: document.getElementById('explanation-modal'),
        modalBody: document.getElementById('modal-body'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        tutorialBtn: document.getElementById('tutorial-btn'),
        tutorialModal: document.getElementById('tutorial-modal'),
        closeTutorialBtn: document.getElementById('close-tutorial-btn'),
        startTutorialLessonBtn: document.getElementById('start-tutorial-lesson-btn'),
        nativeLangBtn: document.getElementById('native-lang-btn'),
        nativeLangDropdown: document.getElementById('native-lang-dropdown'),
        nativeFlagEl: document.getElementById('native-flag'),
        nativeLangTextEl: document.getElementById('native-lang-text'),
        toggleLessonsBtn: document.getElementById('toggle-lessons-btn'),
        lessonsContainer: document.getElementById('lessons-container'),
        difficultyTab: document.getElementById('difficulty-tab'),
        situationsTab: document.getElementById('situations-tab'),
        difficultyContent: document.getElementById('difficulty-content'),
        situationsContent: document.getElementById('situations-content'),
        historyContainer: document.getElementById('history-container'),
        toggleHistoryBtn: document.getElementById('toggle-history-btn'),
        historyLessonsContainer: document.getElementById('history-lessons-container'),
        startLessonOverlay: document.getElementById('start-lesson-overlay'),
        confirmStartLessonBtn: document.getElementById('confirm-start-lesson-btn'),
        appContainer: document.getElementById('app-container'),
        // --- ADD THESE MISSING ELEMENTS ---
        lessonTitleContainer: document.getElementById('lesson-title-container'),
        lessonTitle: document.getElementById('lesson-title'),
        backgroundContextContainer: document.getElementById('background-context-container'),
        backgroundContext: document.getElementById('background-context')
    };

    if (!api || !ui || !lesson || !state) {
        console.error('One or more modules failed to load');
        return;
    }

    // Initialize modules
    ui.init(elements, state.getTranslations, state.getNativeLang, saveState);
    lesson.init(elements, state, api, ui);

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.lang = 'en-US';
        recognitionInstance.interimResults = false;
        recognitionInstance.maxAlternatives = 1;

        recognitionInstance.onstart = () => {
            state.setIsRecognizing(true);
            elements.micBtn?.classList.add('bg-green-600');
            elements.micBtn?.classList.remove('bg-red-600');
            if (elements.micStatus) elements.micStatus.textContent = ui.translateText('listening');
        };

        recognitionInstance.onend = () => {
            state.setIsRecognizing(false);
            elements.micBtn?.classList.remove('bg-green-600');
            elements.micBtn?.classList.add('bg-red-600');
        };

        recognitionInstance.onerror = (event) => {
            console.error("Speech recognition error:", event.error, "for language:", recognitionInstance.lang);
            const currentLanguage = elements.languageSelect?.value;
            if (event.error === 'language-not-supported' && elements.micStatus) {
                elements.micStatus.innerHTML = `Speech recognition for <strong>${currentLanguage}</strong> is not supported by your browser.`;
                if (elements.micBtn) elements.micBtn.disabled = true;
            } else if (elements.micStatus) {
                elements.micStatus.textContent = `An error occurred: ${event.error}.`;
            }
        };

        recognitionInstance.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            if (elements.micStatus) elements.micStatus.textContent = `${ui.translateText('youSaid')} "${spokenText}"`;
            lesson.verifyUserSpeech(spokenText);
        };

        // Set the recognition instance in the state module
        state.setRecognition(recognitionInstance);
    } else {
        if (elements.micStatus) elements.micStatus.textContent = ui.translateText('speechNotSupported');
        if (elements.micBtn) elements.micBtn.disabled = true;
    }

    // --- Event Listeners ---
    elements.startLessonBtn?.addEventListener('click', () => {
		// FIX: Call clearState() here before initializing a new lesson.
		clearState(); 
		lesson.initializeLesson();
	});
    elements.micBtn?.addEventListener('click', () => lesson.toggleSpeechRecognition());
    elements.toggleLessonsBtn?.addEventListener('click', () => ui.toggleLessonsVisibility());
    elements.toggleHistoryBtn?.addEventListener('click', () => ui.toggleHistoryVisibility());
    elements.difficultyTab?.addEventListener('click', () => ui.switchTab('difficulty'));
    elements.situationsTab?.addEventListener('click', () => ui.switchTab('situations'));
    elements.resetLessonBtn?.addEventListener('click', () => lesson.resetLesson());
    elements.confirmStartLessonBtn?.addEventListener('click', () => lesson.confirmStartLesson());
    document.addEventListener('click', (event) => {
        // For lesson topic buttons
        if (event.target.classList.contains('lesson-btn')) {
            const topic = event.target.getAttribute('data-topic');
            if (elements.topicInput) elements.topicInput.value = topic;
            saveState();
            event.target.style.transform = 'scale(0.95)';
            setTimeout(() => { event.target.style.transform = ''; }, 150);
        }
        // For native language selection
        if (event.target.closest('.native-lang-option')) {
            const option = event.target.closest('.native-lang-option');
            const langCode = option.getAttribute('data-lang');
            const flag = option.getAttribute('data-flag');
            const name = option.textContent.trim();
            ui.setNativeLanguage(langCode, flag, name);
            elements.nativeLangDropdown?.classList.add('hidden');
        }
    });

    // Save state on input changes
    const debouncedSave = lesson.debounce(saveState, 500);
    elements.languageSelect?.addEventListener('change', saveState);
    elements.topicInput?.addEventListener('input', debouncedSave);
    elements.audioSpeedSelect?.addEventListener('change', saveState);

    // Modal listeners
    elements.closeModalBtn?.addEventListener('click', () => elements.modal?.classList.add('hidden'));
    elements.modal?.addEventListener('click', (e) => { 
        if (e.target === elements.modal) elements.modal.classList.add('hidden'); 
    });
    elements.tutorialBtn?.addEventListener('click', () => ui.showTutorial());
    elements.closeTutorialBtn?.addEventListener('click', () => elements.tutorialModal?.classList.add('hidden'));
    elements.startTutorialLessonBtn?.addEventListener('click', () => {
        elements.tutorialModal?.classList.add('hidden');
        if (elements.topicInput) elements.topicInput.value = ui.translateText('beginnerExample');
    });

    // Dropdown listeners
    elements.nativeLangBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.nativeLangDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!elements.nativeLangBtn?.contains(e.target) && !elements.nativeLangDropdown?.contains(e.target)) {
            elements.nativeLangDropdown?.classList.add('hidden');
        }
    });

    // --- Initialization ---
    ui.initializeNativeLanguage();
    ui.updateTranslations();
    const savedState = loadState();
    if (savedState) {
        await restoreState(savedState);
    } else {
        ui.startTopicRotations();
    }
    
    // Mark app as initialized
    if (elements.appContainer) {
        elements.appContainer.dataset.initialized = 'true';
    }
}

// Initialize when DOM is ready with multiple fallback methods
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    console.log('DOM already ready, initializing immediately...');
    initializeApp();
}

// Fallback timeout in case DOMContentLoaded doesn't fire
setTimeout(() => {
    if (!document.getElementById('app-container')?.dataset.initialized) {
        console.log('Fallback initialization...');
        initializeApp();
    }
}, 1000);
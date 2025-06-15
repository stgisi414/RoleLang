console.log('Importing modules...');

// Ensure translations are available globally
if (!window.translations) {
    console.error('Translations not loaded! Make sure translations.js is loaded before main.js');
}

try {
    var api = await import('./api.js');
    console.log('API module loaded');
    var ui = await import('./ui.js');
    console.log('UI module loaded');
    var lesson = await import('./lesson.js');
    console.log('Lesson module loaded');
    var state = await import('./state.js');
    console.log('State module loaded');
    
    // Expose state globally for cross-module access
    window.state = state;
} catch (error) {
    console.error('Failed to import modules:', error);
    alert('Failed to load application modules. Please check the console for details.');
}

console.log('main.js loaded');

// --- DOM Elements (global to main.js) ---
let elements = {};

// --- State Persistence Functions ---
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
        console.log('State saved successfully:', appState);
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
            console.log("Saved state is older than 7 days, clearing.");
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
    // Restore native language first if saved
    if (savedState.nativeLang) {
        state.setNativeLang(savedState.nativeLang);
        state.setCurrentTranslations(window.translations[savedState.nativeLang] || window.translations.en);
    }

    if (savedState.selectedLanguage && elements.languageSelect) elements.languageSelect.value = savedState.selectedLanguage;
    if (savedState.topicInput && elements.topicInput) elements.topicInput.value = savedState.topicInput;
    if (savedState.lessonsVisible && ui) ui.toggleLessonsVisibility(true);
    if (savedState.audioSpeed && elements.audioSpeedSelect) elements.audioSpeedSelect.value = savedState.audioSpeed;

    if (savedState.lessonPlan && savedState.currentScreen === 'lesson') {
        
        // --- START OF FIX ---
        // Pre-process the lesson plan to add the 'sentences' array to user turns.
        // This ensures the UI can render correctly from a saved state.
        if (lesson) {
            savedState.lessonPlan = await lesson.preprocessLessonPlan(savedState.lessonPlan);
        }
        // --- END OF FIX ---

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
            ui.addBackToLandingButton();

            if (state.lessonPlan.illustration_url) {
                ui.restoreIllustration(state.lessonPlan.illustration_url);
            } else if (state.lessonPlan.illustration_prompt && lesson) {
                // This call is intentionally not awaited to allow the UI to be interactive
                // while the image loads in the background.
                lesson.fetchAndDisplayIllustration(state.lessonPlan.illustration_prompt);
            }
        }

        const isCompleted = state.currentTurnIndex >= state.lessonPlan.dialogue.length;
        if (isCompleted) {
            if (elements.micStatus) elements.micStatus.innerHTML = `🎉 ${ui.translateText('lessonComplete')}`;
            if (elements.micBtn) elements.micBtn.disabled = true;
            state.lessonPlan.isCompleted = true;
            if (ui) ui.showReviewModeUI(savedState.selectedLanguage);
        } else {
            state.lessonPlan.isCompleted = false;
            if (lesson) lesson.advanceTurn(state.currentTurnIndex);
        }
        
        if (ui) ui.stopTopicRotations();
    }
}

async function initializeApp() {
    console.log('Initializing app...');
    
    if (document.getElementById('app-container')?.dataset.initialized) {
        return;
    }
    
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
        lessonTitleContainer: document.getElementById('lesson-title-container'),
        lessonTitle: document.getElementById('lesson-title'),
        backgroundContextContainer: document.getElementById('background-context-container'),
        backgroundContext: document.getElementById('background-context')
    };

    if (!api || !ui || !lesson || !state) {
        console.error('One or more modules failed to load');
        return;
    }

    lesson.init(elements, state, api, ui, saveState);
	ui.init(elements, state.getTranslations, () => state.nativeLang, saveState, goBackToLanding);

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
            if (ui) ui.updateMicStatus('listening');
        };

        recognitionInstance.onend = () => {
            state.setIsRecognizing(false);
            elements.micBtn?.classList.remove('bg-green-600');
            elements.micBtn?.classList.add('bg-red-600');
        };

        recognitionInstance.onerror = (event) => {
            console.error("Speech recognition error:", event.error, "for language:", recognitionInstance.lang);
             if (ui) ui.updateMicStatus('speechNotSupported');
        };

        recognitionInstance.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            if (ui) ui.updateMicStatusHTML(`${ui.translateText('youSaid')} "${spokenText}"`);
            if (lesson) lesson.verifyUserSpeech(spokenText);
        };

        state.setRecognition(recognitionInstance);
    } else {
        if (ui) ui.updateMicStatus('speechNotSupported');
        if (elements.micBtn) elements.micBtn.disabled = true;
    }

    // --- Event Listeners ---
    elements.startLessonBtn?.addEventListener('click', () => {
		lesson.initializeLesson();
	});
    elements.micBtn?.addEventListener('click', () => lesson.toggleSpeechRecognition());
    elements.toggleLessonsBtn?.addEventListener('click', () => ui.toggleLessonsVisibility());
    elements.toggleHistoryBtn?.addEventListener('click', ui.toggleHistoryVisibility);
    elements.difficultyTab?.addEventListener('click', () => ui.switchTab('difficulty'));
    elements.situationsTab?.addEventListener('click', () => ui.switchTab('situations'));
    elements.resetLessonBtn?.addEventListener('click', () => lesson.resetLesson());
    elements.confirmStartLessonBtn?.addEventListener('click', () => lesson.confirmStartLesson());
    
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('lesson-btn')) {
            if (elements.topicInput) elements.topicInput.value = event.target.getAttribute('data-topic');
            saveState();
        }
        if (event.target.closest('.native-lang-option')) {
            const option = event.target.closest('.native-lang-option');
            const langCode = option.getAttribute('data-lang');
            const flag = option.getAttribute('data-flag');
            const name = option.textContent.trim();
            
            // Update state
            state.setNativeLang(langCode);
            state.setCurrentTranslations(window.translations[langCode] || window.translations.en);
            
            // Update UI
            ui.setNativeLanguage(langCode, flag, name);
            elements.nativeLangDropdown?.classList.add('hidden');
            
            // Save state
            saveState();
        }
    });

    const debouncedSave = lesson.debounce(saveState, 500);
    elements.languageSelect?.addEventListener('change', saveState);
    elements.topicInput?.addEventListener('input', debouncedSave);
    elements.audioSpeedSelect?.addEventListener('change', saveState);

    elements.closeModalBtn?.addEventListener('click', () => elements.modal?.classList.add('hidden'));
    elements.tutorialBtn?.addEventListener('click', () => ui.showTutorial());
    elements.closeTutorialBtn?.addEventListener('click', () => elements.tutorialModal?.classList.add('hidden'));
    elements.startTutorialLessonBtn?.addEventListener('click', () => {
        elements.tutorialModal?.classList.add('hidden');
        if (elements.topicInput) elements.topicInput.value = ui.translateText('beginnerExample');
    });

    elements.nativeLangBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.nativeLangDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!elements.nativeLangBtn?.contains(e.target) && !elements.nativeLangDropdown?.contains(e.target)) {
            elements.nativeLangDropdown?.classList.add('hidden');
        }
    });
	
	elements.conversationContainer?.addEventListener('click', (event) => {
        const lineElement = event.target.closest('.dialogue-line');
        if (!lineElement || event.target.closest('.explanation-link')) return;

        const turnIndex = parseInt(lineElement.id.split('-')[1], 10);
        const turn = state.lessonPlan?.dialogue[turnIndex];
        if (turn) lesson.playLineAudioDebounced(turn.line.display, turn.party);
    });
	
	elements.historyLessonsContainer?.addEventListener('click', (event) => {
        const card = event.target.closest('.history-card');
        if (!card) return;
        const lessonId = card.dataset.lessonId;
        const history = ui.getLessonHistory(); 
        const lessonRecord = history.find(record => record.id === lessonId);
        if (lessonRecord) {
            lesson.reviewLesson(lessonRecord);
        }
    });

    elements.lessonScreen?.addEventListener('click', (event) => {
        if (event.target.closest('#vocab-quiz-btn')) {
            const language = elements.languageSelect?.value;
            if (lesson.startVocabularyQuiz) {
                lesson.startVocabularyQuiz(language);
            }
        }
    });

    // --- Initialization ---
    // Ensure translations are properly initialized
    if (window.translations) {
        state.setCurrentTranslations(window.translations.en);
        ui.initializeNativeLanguage();
        ui.updateTranslations();
    } else {
        console.error('Translations not available, UI will not be properly translated');
    }
    
    const savedState = loadState();
    if (savedState) {
        await restoreState(savedState);
    } else {
        ui.startTopicRotations();
    }
    
    if (elements.appContainer) {
        elements.appContainer.dataset.initialized = 'true';
    }
}

function goBackToLanding() {
    clearState();
    state.setLessonPlan(null);
    state.setCurrentTurnIndex(0);

    ui.showLandingScreen();
    ui.startTopicRotations();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

setTimeout(() => {
    if (!document.getElementById('app-container')?.dataset.initialized) {
        initializeApp();
    }
}, 1000);
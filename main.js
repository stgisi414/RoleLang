console.log('Importing modules...');

// Ensure translations are available globally
if (!window.translations) {
    console.error('Translations not loaded! Make sure translations.js is loaded before main.js');
}

let api, ui, lesson, state;

try {
    console.log('Importing modules...');
    api = await import('./api.js');
    console.log('API module loaded:', !!api);
    ui = await import('./ui.js');
    console.log('UI module loaded:', !!ui);
    lesson = await import('./lesson.js');
    console.log('Lesson module loaded:', !!lesson);
    state = await import('./state.js');
    console.log('State module loaded:', !!state);
    console.log('All modules loaded successfully');
} catch (error) {
    console.error('Failed to load modules:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);

    document.body.innerHTML = `
            <div class="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div class="text-center p-8 max-w-2xl">
                    <h1 class="text-2xl font-bold mb-4">Failed to Load Application</h1>
                    <div class="bg-red-900/50 border border-red-500 rounded p-4 mb-4 text-left">
                        <p class="font-bold">Error Details:</p>
                        <p class="text-sm mt-2">Name: ${error.name}</p>
                        <p class="text-sm">Message: ${error.message}</p>
                        <pre class="text-xs mt-2 overflow-auto max-h-32">${error.stack}</pre>
                    </div>
                    <button onclick="window.location.reload()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                        Reload Page
                    </button>
                </div>
            </div>
        `;
    throw error; // Re-throw to prevent further execution
}

console.log('main.js loaded');

// --- DOM Elements (global to main.js) ---
let elements = {};

// --- State Persistence Functions ---
let isRestoring = false;

function saveState() {
    // Don't save state while we're restoring it
    if (isRestoring) {
        console.log('Skipping saveState during restoration');
        return;
    }

    const selectedLang = elements.languageSelect?.value;
    const appState = {
        lessonPlan: state.lessonPlan,
        currentTurnIndex: state.currentTurnIndex,
        currentScreen: state.lessonPlan ? 'lesson' : 'landing',
        selectedLanguage: selectedLang,
        topicInput: elements.topicInput?.value,
        nativeLang: state.nativeLang,
        lessonsVisible: !elements.lessonsContainer?.classList.contains('hidden'),
        audioSpeed: elements.audioSpeedSelect ? elements.audioSpeedSelect.value : '1',
        lastSaved: Date.now()
    };

    try {
        localStorage.setItem(state.STATE_KEY, JSON.stringify(appState));
        console.log('State saved successfully. Target language:', selectedLang);
        console.log('Full saved state:', appState);
        // Verify it was actually saved
        const verification = localStorage.getItem(state.STATE_KEY);
        if (verification) {
            const parsed = JSON.parse(verification);
            console.log('Verification - stored target language:', parsed.selectedLanguage);
        }
    } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
    }
}

function loadState() {
    try {
        const savedState = localStorage.getItem(state.STATE_KEY);
        console.log('Raw localStorage data:', savedState);
        if (!savedState) return null;

        const parsedState = JSON.parse(savedState);
        console.log('Parsed state from localStorage:', parsedState);
        console.log('Target language from localStorage:', parsedState.selectedLanguage);

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
    isRestoring = true; // Prevent saveState from being called during restoration

    // Restore target language FIRST before anything else
        if (savedState.selectedLanguage && elements.languageSelect) {
            console.log('BEFORE restoration - languageSelect value:', elements.languageSelect.value);
            elements.languageSelect.value = savedState.selectedLanguage;
            console.log('AFTER restoration - languageSelect value:', elements.languageSelect.value);

            // Watch for changes
            setTimeout(() => {
                console.log('After 100ms - languageSelect value:', elements.languageSelect.value);
            }, 100);
            setTimeout(() => {
                console.log('After 500ms - languageSelect value:', elements.languageSelect.value);
            }, 500);
            setTimeout(() => {
                console.log('After 1000ms - languageSelect value:', elements.languageSelect.value);
            }, 1000);
        }

        // Set the value directly
        elements.languageSelect.value = savedState.selectedLanguage;
        console.log('Target language select value after restoration:', elements.languageSelect.value);

        // If the direct assignment didn't work, try finding and setting the option
        if (elements.languageSelect.value !== savedState.selectedLanguage) {
            const targetOption = Array.from(elements.languageSelect.options).find(option => option.value === savedState.selectedLanguage);
            if (targetOption) {
                targetOption.selected = true;
                elements.languageSelect.value = savedState.selectedLanguage;
                console.log('Target language restored via option selection:', elements.languageSelect.value);
            } else {
                console.error('Target language option not found:', savedState.selectedLanguage);
            }
        }

        // Verify the final state
        console.log('Final target language value:', elements.languageSelect.value);

    // Restore native language (UI language) if saved
    if (savedState.nativeLang) {
        state.setNativeLang(savedState.nativeLang);
        state.setCurrentTranslations(window.translations[savedState.nativeLang] || window.translations.en);
        // Update UI language display - this will get the correct flag/name from initializeNativeLanguage
        if (ui) {
            // Don't override with hardcoded values, let the stored data be used
            ui.initializeNativeLanguage();
        }
    }
    if (savedState.topicInput && elements.topicInput) {
        elements.topicInput.value = savedState.topicInput;
    }
    if (savedState.lessonsVisible && ui) {
        ui.toggleLessonsVisibility(true);
    }
    if (savedState.audioSpeed && elements.audioSpeedSelect) {
        elements.audioSpeedSelect.value = savedState.audioSpeed;
    }

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

    isRestoring = false; // Allow saveState to work normally again
}

async function initializeApp() {
    console.log('Initializing app...');

    if (document.getElementById('app-container')?.dataset.initialized) {
        return;
    }

    // Set flag IMMEDIATELY to prevent any saveState calls during initialization
    isRestoring = true;

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
    ui.init(
        elements,
        state.getTranslations,
        () => state.nativeLang,
        saveState,
        goBackToLanding,
        state.setNativeLang, // Pass the setNativeLang function
        state.setCurrentTranslations // Pass the setCurrentTranslations function
    );

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
	function setupEventListeners() {
		if (elements.startLessonBtn) {
			elements.startLessonBtn.addEventListener('click', () => {
				console.log('Start lesson button clicked');
				lesson.initializeLesson();
			});
		}
		if (elements.micBtn) {
			elements.micBtn.addEventListener('click', () => {
				console.log('Mic button clicked');
				lesson.toggleSpeechRecognition();
			});
		}
		if (elements.toggleLessonsBtn) {
			elements.toggleLessonsBtn.addEventListener('click', () => {
				console.log('Toggle lessons button clicked');
				ui.toggleLessonsVisibility();
			});
		}
		if (elements.toggleHistoryBtn) {
			elements.toggleHistoryBtn.addEventListener('click', () => {
				console.log('Toggle history button clicked');
				ui.toggleHistoryVisibility();
			});
		}
		if (elements.difficultyTab) {
			elements.difficultyTab.addEventListener('click', () => {
				console.log('Difficulty tab clicked');
				ui.switchTab('difficulty');
			});
		}
		if (elements.situationsTab) {
			elements.situationsTab.addEventListener('click', () => {
				console.log('Situations tab clicked');
				ui.switchTab('situations');
			});
		}
		if (elements.resetLessonBtn) {
			elements.resetLessonBtn.addEventListener('click', () => {
				console.log('Reset lesson button clicked');
				lesson.resetLesson();
			});
		}
		if (elements.confirmStartLessonBtn) {
			elements.confirmStartLessonBtn.addEventListener('click', () => {
				console.log('Confirm start lesson button clicked');
				lesson.confirmStartLesson();
			});
		}

		document.addEventListener('click', (event) => {
			if (event.target.classList.contains('lesson-btn')) {
				if (elements.topicInput) {
					elements.topicInput.value = event.target.getAttribute('data-topic');
					saveState();
				}
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
				if (ui) {
					ui.setNativeLanguage(langCode, flag, name);
				}
				elements.nativeLangDropdown?.classList.add('hidden');

				// Save state
				saveState();
			}
		});

		const debouncedSave = lesson.debounce(saveState, 500);
		elements.languageSelect?.addEventListener('change', (event) => {
			console.log('Target language changed to:', event.target.value);
			// Force immediate save with a small delay to ensure the value is captured
			setTimeout(() => {
				console.log('Saving state with target language:', elements.languageSelect.value);
				saveState();
			}, 50);
		});
		elements.topicInput?.addEventListener('input', debouncedSave);
		elements.audioSpeedSelect?.addEventListener('change', saveState);

		// Ensure modal is hidden on page load
		elements.modal?.classList.add('hidden');
		
		elements.closeModalBtn?.addEventListener('click', () => {
			try {
				// Stop YouTube video if playing
				if (elements.modal?._closeHandler) {
					elements.modal._closeHandler();
				}
				elements.modal?.classList.add('hidden');
			} catch (error) {
				console.error('Error closing modal:', error);
				elements.modal?.classList.add('hidden');
			}
		});
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
			try {
				if (!elements.nativeLangBtn?.contains(e.target) && !elements.nativeLangDropdown?.contains(e.target)) {
					elements.nativeLangDropdown?.classList.add('hidden');
				}
				
				// Close modal when clicking outside and stop video
				if (e.target === elements.modal && !elements.modal?.classList.contains('hidden')) {
					if (elements.modal?._closeHandler) {
						elements.modal._closeHandler();
					}
					elements.modal?.classList.add('hidden');
				}
			} catch (error) {
				console.error('Error in document click handler:', error);
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
	}

    // --- Initialization ---
    // Ensure translations are properly initialized
    if (window.translations) {
        state.setCurrentTranslations(window.translations.en);
        ui.updateTranslations();
    } else {
        console.error('Translations not available, UI will not be properly translated');
    }

    const savedState = loadState();
    if (savedState) {
        await restoreState(savedState);
        isRestoring = false; // Clear the flag after successful restoration
    } else {
        ui.startTopicRotations();
        isRestoring = false; // Clear the flag even if no saved state
    }

    // Initialize native language AFTER all modules are connected and state is restored
    // Use setTimeout to ensure the DOM is fully ready and state is properly set
    setTimeout(() => {
        ui.initializeNativeLanguage();
        console.log('Native language initialization completed');
    }, 200);

    // NOW add event listeners after restoration is complete
    setupEventListeners();

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
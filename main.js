
import * as api from './api.js';
import * as ui from './ui.js';
import * as lesson from './lesson.js';
import * as state from './state.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const elements = {
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
        appContainer: document.getElementById('app-container')
    };

    // Initialize modules
    state.init(elements, ui, lesson);
    ui.init(elements, state.getTranslations, state.getNativeLang, ui.setNativeLanguage, state.save);
    lesson.init(elements, state, api, ui);

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = false;
        state.recognition.lang = 'en-US';
        state.recognition.interimResults = false;
        state.recognition.maxAlternatives = 1;

        state.recognition.onstart = () => {
            state.isRecognizing = true;
            elements.micBtn?.classList.add('bg-green-600');
            elements.micBtn?.classList.remove('bg-red-600');
            if (elements.micStatus) elements.micStatus.textContent = ui.translateText('listening');
        };

        state.recognition.onend = () => {
            state.isRecognizing = false;
            elements.micBtn?.classList.remove('bg-green-600');
            elements.micBtn?.classList.add('bg-red-600');
        };

        state.recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error, "for language:", state.recognition.lang);
            const currentLanguage = elements.languageSelect?.value;
            if (event.error === 'language-not-supported' && elements.micStatus) {
                elements.micStatus.innerHTML = `Speech recognition for <strong>${currentLanguage}</strong> is not supported by your browser.`;
                if (elements.micBtn) elements.micBtn.disabled = true;
            } else if (elements.micStatus) {
                elements.micStatus.textContent = `An error occurred: ${event.error}.`;
            }
        };

        state.recognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            if (elements.micStatus) elements.micStatus.textContent = `${ui.translateText('youSaid')} "${spokenText}"`;
            lesson.verifyUserSpeech(spokenText);
        };
    } else {
        if (elements.micStatus) elements.micStatus.textContent = ui.translateText('speechNotSupported');
        if (elements.micBtn) elements.micBtn.disabled = true;
    }

    // --- Event Listeners ---
    elements.startLessonBtn?.addEventListener('click', () => lesson.initializeLesson());
    elements.micBtn?.addEventListener('click', () => lesson.toggleSpeechRecognition());
    elements.toggleLessonsBtn?.addEventListener('click', () => ui.toggleLessonsVisibility());
    elements.toggleHistoryBtn?.addEventListener('click', () => ui.toggleHistoryVisibility());
    elements.difficultyTab?.addEventListener('click', () => ui.switchTab('difficulty'));
    elements.situationsTab?.addEventListener('click', () => ui.switchTab('situations'));
    elements.resetLessonBtn?.addEventListener('click', () => lesson.resetLesson());
    elements.confirmStartLessonBtn?.addEventListener('click', () => lesson.confirmStartLesson());</old_str>

    document.addEventListener('click', (event) => {
        // For lesson topic buttons
        if (event.target.classList.contains('lesson-btn')) {
            const topic = event.target.getAttribute('data-topic');
            if (elements.topicInput) elements.topicInput.value = topic;
            state.save();
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
    const debouncedSave = lesson.debounce(state.save, 500);
    elements.languageSelect?.addEventListener('change', state.save);
    elements.topicInput?.addEventListener('input', debouncedSave);
    elements.audioSpeedSelect?.addEventListener('change', state.save);

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
    const savedState = state.load();
    if (savedState) {
        await state.restore(savedState);
    } else {
        ui.startTopicRotations();
    }
});

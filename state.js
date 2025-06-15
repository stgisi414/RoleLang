
// --- State Management ---
export const STATE_KEY = 'rolelang_app_state';
export const LESSON_HISTORY_KEY = 'rolelang_lesson_history';
export const MAX_LESSON_HISTORY = 100;

// State variables
export let lessonPlan = null;
export let currentTurnIndex = 0;
export let isRecognizing = false;
export let recognition = null;
export let nativeLang = 'en';
export let currentTranslations = {}; // Will be populated from translations.js
export let preFetchedFirstAudioBlob = null;
export const audioPlayer = new Audio();
export let audioController = new AbortController();

// DOM elements and modules
let domElements = {};
let uiModule;
let lessonModule;

export function init(elements, ui, lesson) {
    domElements = elements;
    uiModule = ui;
    lessonModule = lesson;
    
    // Initialize translations with default English
    currentTranslations = window.translations?.en || {};
}

export function setLessonPlan(plan) {
    lessonPlan = plan;
}

export function setCurrentTurnIndex(index) {
    currentTurnIndex = index;
}

export function setNativeLang(lang) {
    nativeLang = lang;
}

export function setCurrentTranslations(translations) {
    currentTranslations = translations;
}

export function getTranslations() {
    return currentTranslations;
}

export function getNativeLang() {
    return nativeLang;
}

export function save() {
    const state = {
        lessonPlan: lessonPlan,
        currentTurnIndex: currentTurnIndex,
        currentScreen: lessonPlan ? 'lesson' : 'landing',
        selectedLanguage: domElements.languageSelect?.value,
        topicInput: domElements.topicInput?.value,
        nativeLang: nativeLang,
        lessonsVisible: !domElements.lessonsContainer?.classList.contains('hidden'),
        audioSpeed: domElements.audioSpeedSelect ? domElements.audioSpeedSelect.value : '1',
        lastSaved: Date.now()
    };

    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
    }
}

export function load() {
    try {
        const savedState = localStorage.getItem(STATE_KEY);
        if (!savedState) return null;

        const state = JSON.parse(savedState);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (state.lastSaved < sevenDaysAgo) {
            localStorage.removeItem(STATE_KEY);
            return null;
        }
        return state;
    } catch (error) {
        console.warn('Failed to load state from localStorage:', error);
        localStorage.removeItem(STATE_KEY);
        return null;
    }
}

export function clear() {
    localStorage.removeItem(STATE_KEY);
    if (uiModule) {
        uiModule.hideReviewModeBanner();
    }
}

export async function restore(state) {
    if (state.selectedLanguage && domElements.languageSelect) domElements.languageSelect.value = state.selectedLanguage;
    if (state.topicInput && domElements.topicInput) domElements.topicInput.value = state.topicInput;
    if (state.lessonsVisible && uiModule) uiModule.toggleLessonsVisibility(true);
    if (state.audioSpeed && domElements.audioSpeedSelect) domElements.audioSpeedSelect.value = state.audioSpeed;

    if (state.lessonPlan && state.currentScreen === 'lesson') {
        lessonPlan = state.lessonPlan;
        currentTurnIndex = state.currentTurnIndex;

        if (!lessonPlan.dialogue || lessonPlan.dialogue.length === 0) {
            clear();
            return;
        }

        if (recognition && lessonModule) {
            recognition.lang = lessonModule.getLangCode(state.selectedLanguage);
        }

        domElements.landingScreen?.classList.add('hidden');
        domElements.lessonScreen?.classList.remove('hidden');

        if (uiModule) {
            await uiModule.restoreConversation(lessonPlan);
            uiModule.displayLessonTitleAndContext(lessonPlan);

            if (lessonPlan.illustration_url) {
                uiModule.restoreIllustration(lessonPlan.illustration_url);
            } else if (lessonPlan.illustration_prompt && lessonModule) {
                lessonModule.fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
            }
        }

        const isCompleted = currentTurnIndex >= lessonPlan.dialogue.length;
        if (isCompleted) {
            if (domElements.micStatus) domElements.micStatus.textContent = uiModule?.translateText('lessonComplete') || 'Lesson Complete!';
            if (domElements.micBtn) domElements.micBtn.disabled = true;
            lessonPlan.isCompleted = true;
            if (uiModule) uiModule.showReviewModeUI(state.selectedLanguage, lessonPlan);
        } else {
            lessonPlan.isCompleted = false;
            if (lessonModule) lessonModule.advanceTurn(currentTurnIndex);
        }
        
        if (uiModule) uiModule.stopTopicRotations();
    }
}

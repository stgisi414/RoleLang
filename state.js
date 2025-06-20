// --- Constants ---
export const STATE_KEY = 'rolelang_app_state';
export const LESSON_HISTORY_KEY = 'rolelang_lesson_history';
export const MAX_LESSON_HISTORY = 100;

// --- State Variables ---
export let lessonPlan = null;
export let currentTurnIndex = 0;
export let isRecognizing = false;
export let recognition = null;
export let nativeLang = 'en';
export let currentTranslations = (typeof window !== 'undefined' && window.translations) ? window.translations.en : {};
export let preFetchedFirstAudioBlob = null;
export const audioPlayer = new Audio();
export let audioController = new AbortController();

// --- Setters ---

/**
 * Aborts the current AbortController and creates a new one.
 * This is the correct way to manage the controller from other modules.
 */
export function resetAudioController() {
    // Abort the current controller if it exists and hasn't been aborted yet.
    if (audioController && !audioController.signal.aborted) {
        audioController.abort();
    }
    // Create and assign a new AbortController.
    audioController = new AbortController();
}

export function setRecognition(instance) {
    recognition = instance;
}

export function setIsRecognizing(value) {
    isRecognizing = value;
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

/**
 * Sets the pre-fetched audio blob in the state.
 * @param {Blob|null} blob The audio blob or null.
 */
export function setPreFetchedFirstAudioBlob(blob) {
    preFetchedFirstAudioBlob = blob;
}


// --- Getters ---
export function getTranslations() {
    return currentTranslations;
}

export function getNativeLang() {
    return nativeLang;
}
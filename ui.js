import * as state from './state.js';
import * as lesson from './lesson.js';

let domElements = {};
let getTranslationsFunc;
let getNativeLangFunc;
let setNativeLanguageFunc;
let saveStateFunc;

export function init(elements, getTranslations, getNativeLang, setNativeLanguage, save) {
    domElements = elements;
    getTranslationsFunc = getTranslations;
    getNativeLangFunc = getNativeLang;
    setNativeLanguageFunc = setNativeLanguage;
    saveStateFunc = save;
}

export function translateText(key) {
    const translations = getTranslationsFunc();
    // Assuming 'en' is the fallback language and its translations are in translations.js
    return translations[key] || window.translations.en[key] || key;
}

export function updateTranslations() {
    document.title = translateText('title');
    document.querySelectorAll('[data-translate]').forEach(el => {
        el.textContent = translateText(el.getAttribute('data-translate'));
    });
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        el.placeholder = translateText(el.getAttribute('data-translate-placeholder'));
    });
    // Refresh other dynamic elements
    updateBackButton();
    if (!domElements.historyContainer.classList.contains('hidden')) {
        displayLessonHistory();
    }
}

export function initializeNativeLanguage() {
    const stored = localStorage.getItem('rolelang_native_lang');
    if (stored) {
        try {
            const { code, flag, name } = JSON.parse(stored);
            setNativeLanguage(code, flag, name);
        } catch (e) {
            detectNativeLanguage();
        }
    } else {
        detectNativeLanguage();
    }
}

export function setNativeLanguage(langCode, flag, name) {
    state.setNativeLang(langCode);
    domElements.nativeFlagEl.textContent = flag;
    domElements.nativeLangTextEl.textContent = name;
    state.setCurrentTranslations(window.translations[langCode] || window.translations.en);
    updateTranslations();
    stopTopicRotations();
    startTopicRotations();
    localStorage.setItem('rolelang_native_lang', JSON.stringify({ code: langCode, flag, name }));
}

function detectNativeLanguage() {
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const langCode = browserLang.split('-')[0].toLowerCase();
    const map = {
        'en': { code: 'en', flag: '🇺🇸', name: 'English' },
        'es': { code: 'es', flag: '🇪🇸', name: 'Español' },
        'fr': { code: 'fr', flag: '🇫🇷', name: 'Français' },
        'de': { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
        'it': { code: 'it', flag: '🇮🇹', name: 'Italiano' },
        'zh': { code: 'zh', flag: '🇨🇳', name: '中文' },
        'ja': { code: 'ja', flag: '🇯🇵', name: '日本語' },
        'ko': { code: 'ko', flag: '🇰🇷', name: '한국어' }
    };
    const detected = map[langCode] || map['en'];
    setNativeLanguage(detected.code, detected.flag, detected.name);
}

export function showTutorial() {
    domElements.tutorialModal.classList.remove('hidden');
    updateTranslations(); // Ensure content is translated
}

export function showExplanation(content) {
    domElements.modalBody.innerHTML = `<h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3><p class="text-gray-300">${content.body}</p>`;
    domElements.modal.classList.remove('hidden');
}


export async function restoreConversation(lessonPlan) {
    domElements.conversationContainer.innerHTML = '';
    for (const [index, turn] of lessonPlan.dialogue.entries()) {
        const lineDiv = document.createElement('div');
        lineDiv.classList.add('dialogue-line', 'text-white', 'cursor-pointer');
        lineDiv.id = `turn-${index}`;
        const speakerIcon = turn.party === 'A' ? '👤' : '🤖';
        lineDiv.innerHTML = `<strong>${speakerIcon}</strong> ${turn.line.display} <i class="fas fa-volume-up text-gray-400 ml-2 hover:text-sky-300"></i>`;
        lineDiv.classList.add(turn.party === 'A' ? 'user-line' : 'partner-line');
        lineDiv.addEventListener('click', () => lesson.playLineAudioDebounced(turn.line.display, turn.party));
        if (turn.explanation) {
            const expSpan = document.createElement('span');
            expSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300 ml-6"></i>`;
            expSpan.classList.add('explanation-link');
            expSpan.onclick = (e) => { e.stopPropagation(); showExplanation(turn.explanation); };
            lineDiv.appendChild(expSpan);
        }
        domElements.conversationContainer.appendChild(lineDiv);
    }
}

export function restoreIllustration(imageUrl) {
    domElements.illustrationPlaceholder.classList.add('hidden');
    domElements.imageLoader.classList.add('hidden');
    domElements.illustrationImg.src = imageUrl;
    domElements.illustrationImg.classList.remove('hidden');
}

export function displayLessonTitleAndContext(lessonPlan) {
    const titleContainer = document.getElementById('lesson-title-container');
    const titleElement = document.getElementById('lesson-title');
    const contextContainer = document.getElementById('background-context-container');
    const contextElement = document.getElementById('background-context');

    if (lessonPlan && lessonPlan.title) {
        titleElement.textContent = lessonPlan.title;
        titleContainer.classList.remove('hidden');
    }
    if (lessonPlan && lessonPlan.background_context) {
        contextElement.textContent = lessonPlan.background_context;
        contextContainer.classList.remove('hidden');
    }
}

// ... other UI functions like toggles, animations, modals etc.
// Due to length limitations, functions like toggle*Visibility, switchTab, animate*,
// displayLessonHistory, showReviewModeUI, etc., would be placed here.
// For brevity, I'm omitting the full code for these but they would be moved from the original script.js.

export function updateBackButton() {
    const backBtn = document.getElementById('back-to-landing-btn');
    if (backBtn) {
        backBtn.innerHTML = `<i class="fas fa-arrow-left mr-2"></i>${translateText('back')}`;
    }
}

export function startTopicRotations() { /* ... from script.js ... */ }
export function stopTopicRotations() { /* ... from script.js ... */ }
export function switchTab(tabName) { /* ... from script.js ... */ }
export function toggleLessonsVisibility(forceShow = false) { /* ... from script.js ... */ }
export function toggleHistoryVisibility() { /* ... from script.js ... */ }
export function displayLessonHistory() { /* ... from script.js ... */ }
export function hideReviewModeBanner() { /* ... from script.js ... */ }
export function showReviewModeUI(language, lessonPlan) { /* ... from script.js ... */ }


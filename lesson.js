
import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let domElements = {};
let stateRef = {};
let apiRef = {};
let uiRef = {};

export function init(elements, stateModule, apiModule, uiModule) {
    domElements = elements;
    stateRef = stateModule;
    apiRef = apiModule;
    uiRef = uiModule;
}

export function getLangCode(languageValue) {
    const langValueToCode = {
        'English': 'en-US', 'Spanish': 'es-ES', 'French': 'fr-FR',
        'German': 'de-DE', 'Italian': 'it-IT', 'Japanese': 'ja-JP',
        'Chinese': 'zh-CN', 'Korean': 'ko-KR'
    };
    return langValueToCode[languageValue] || 'en-US';
}

function getVoiceConfig(language, party = 'A') {
    const voiceConfigs = {
        'English': { voice_id_a: "pNInz6obpgDQGcFmaJgB", voice_id_b: "21m00Tcm4TlvDq8ikWAM", language_code: "en" },
        'Spanish': { voice_id_a: "XrExE9yKIg1WjnnlVkGX", voice_id_b: "VR6AewLTigWG4xSOukaG", language_code: "es" },
        'French': { voice_id_a: "ThT5KcBeYPX3keUQqHPh", voice_id_b: "XB0fDUnXU5powFXDhCwa", language_code: "fr" },
        'German': { voice_id_a: "pNInz6obpgDQGcFmaJgB", voice_id_b: "21m00Tcm4TlvDq8ikWAM", language_code: "de" },
        'Italian': { voice_id_a: "XB0fDUnXU5powFXDhCwa", voice_id_b: "jsCqWAovK2LkecY7zXl4", language_code: "it" },
        'Japanese': { voice_id_a: "jBpfuIE2acCO8z3wKNLl", voice_id_b: "Xb7hH8MSUJpSbSDYk0k2", language_code: "ja" },
        'Chinese': { voice_id_a: "2EiwWnXFnvU5JabPnv8n", voice_id_b: "yoZ06aMxZJJ28mfd3POQ", language_code: "zh" },
        'Korean': { voice_id_a: "bVMeCyTHy58xNoL34h3p", voice_id_b: "Xb7hH8MSUJpSbSDYk0k2", language_code: "ko" }
    };
    const config = voiceConfigs[language] || voiceConfigs['English'];
    return {
        voice_id: party === 'A' ? config.voice_id_a : config.voice_id_b,
        language_code: config.language_code
    };
}

export async function initializeLesson() {
    if (!domElements.languageSelect || !domElements.topicInput) return;
    
    const language = domElements.languageSelect.value;
    const topic = domElements.topicInput.value;
    if (!topic) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }

    stateRef.clear();
    if (domElements.loadingSpinner) domElements.loadingSpinner.classList.remove('hidden');

    const prompt = createGeminiPrompt(language, topic, stateRef.getNativeLang());
    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'pro' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const plan = JSON.parse(jsonString);
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
        uiRef.stopTopicRotations();
        if (domElements.landingScreen) domElements.landingScreen.classList.add('hidden');
        if (domElements.lessonScreen) domElements.lessonScreen.classList.remove('hidden');

        startConversation();
        fetchAndDisplayIllustration(plan.illustration_prompt);
        stateRef.save();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
    }
}

export function startConversation() {
    stateRef.setCurrentTurnIndex(0);
    uiRef.restoreConversation(stateRef.lessonPlan);
    uiRef.displayLessonTitleAndContext(stateRef.lessonPlan);
    advanceTurn(0);
}

export async function advanceTurn(newTurnIndex) {
    stateRef.setCurrentTurnIndex(newTurnIndex);
    stateRef.save();

    const { lessonPlan, currentTurnIndex } = stateRef;
    if (currentTurnIndex >= lessonPlan.dialogue.length) {
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        return;
    }

    // Additional turn logic would go here
    console.log(`Advanced to turn ${newTurnIndex}`);
}

export async function fetchAndDisplayIllustration(prompt) {
    if (!domElements.illustrationPlaceholder || !domElements.imageLoader) return;
    
    domElements.illustrationPlaceholder.classList.add('hidden');
    domElements.imageLoader.classList.remove('hidden');
    try {
        const result = await apiRef.generateImage(`${prompt}, digital art`);
        if (result.imageUrl) {
            if (stateRef.lessonPlan) {
                stateRef.lessonPlan.illustration_url = result.imageUrl;
                stateRef.save();
            }
            if (domElements.illustrationImg) {
                domElements.illustrationImg.src = result.imageUrl;
                domElements.illustrationImg.onload = () => {
                    domElements.imageLoader.classList.add('hidden');
                    domElements.illustrationImg.classList.remove('hidden');
                };
            }
        }
    } catch (error) {
        console.error("Failed to fetch illustration:", error);
    }
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function createGeminiPrompt(language, topic, nativeLangName) {
    const randomNames = window.getRandomNames ? window.getRandomNames(language, 5) : [];
    const nameExamples = randomNames.map(name => `"${name[0]} ${name[1]}"`).join(', ');

    return `
    You are a language tutor...
    The user wants to learn: **${language}**
    The user's native language is: **${nativeLangName}**
    The user-provided topic for the roleplay is: **"${topic}"**
    ...
    Here are some good examples for ${language}: ${nameExamples}.
    ...
    Now, generate the complete JSON lesson plan.`;
}

export function toggleSpeechRecognition() {
    if (!stateRef.recognition) return;
    
    if (stateRef.isRecognizing) {
        stateRef.recognition.stop();
    } else {
        try {
            const selectedLanguage = domElements.languageSelect?.value || 'English';
            const langCode = getLangCode(selectedLanguage);
            stateRef.recognition.lang = langCode;
            stateRef.recognition.start();
        } catch (error) {
            console.error('Speech recognition failed to start:', error);
            if (domElements.micStatus) {
                domElements.micStatus.textContent = 'Speech recognition is not supported for this language in your browser.';
            }
        }
    }
}

export function verifyUserSpeech(spokenText) {
    console.log('Verifying speech:', spokenText);
    // Speech verification logic would go here
}

export function resetLesson() {
    if (!stateRef.lessonPlan) return;
    
    stateRef.setCurrentTurnIndex(0);
    
    document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
    
    if (domElements.micBtn) {
        domElements.micBtn.disabled = false;
        domElements.micBtn.classList.remove('bg-green-600');
        domElements.micBtn.classList.add('bg-red-600');
    }
    
    if (domElements.micStatus) {
        domElements.micStatus.textContent = uiRef.translateText('micStatus');
    }
    
    if (stateRef.isRecognizing && stateRef.recognition) {
        stateRef.recognition.stop();
    }
    
    const existingReviewIndicator = domElements.lessonScreen?.querySelector('.review-mode-indicator');
    if (existingReviewIndicator) {
        existingReviewIndicator.remove();
    }
    
    advanceTurn(0);
}

export function confirmStartLesson() {
    console.log('Confirming lesson start');
    // Implementation for lesson start confirmation
}

export function playLineAudioDebounced(text, party) {
    console.log('Playing audio:', text, party);
    // Implementation for debounced audio playback
}

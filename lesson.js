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
        // ... other languages
    };
    const config = voiceConfigs[language] || voiceConfigs['English'];
    return {
        voice_id: party === 'A' ? config.voice_id_a : config.voice_id_b,
        language_code: config.language_code
    };
}


export async function initializeLesson() {
    const language = domElements.languageSelect.value;
    const topic = domElements.topicInput.value;
    if (!topic) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }

    stateRef.clear();
    domElements.loadingSpinner.classList.remove('hidden');

    const prompt = createGeminiPrompt(language, topic, stateRef.getNativeLang());
    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'pro' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const plan = JSON.parse(jsonString);
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        domElements.loadingSpinner.classList.add('hidden');
        uiRef.stopTopicRotations();
        domElements.landingScreen.classList.add('hidden');
        domElements.lessonScreen.classList.remove('hidden');

        startConversation();
        fetchAndDisplayIllustration(plan.illustration_prompt);
        stateRef.save();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        domElements.loadingSpinner.classList.add('hidden');
    }
}

export function startConversation() {
    stateRef.setCurrentTurnIndex(0);
    uiRef.restoreConversation(stateRef.lessonPlan);
    uiRef.displayLessonTitleAndContext(stateRef.lessonPlan);
    // Add back button logic here or in UI module
    advanceTurn(0);
}

export async function advanceTurn(newTurnIndex) {
    stateRef.setCurrentTurnIndex(newTurnIndex);
    stateRef.save();

    const { lessonPlan, currentTurnIndex } = stateRef;
    if (currentTurnIndex >= lessonPlan.dialogue.length) {
        // Handle lesson completion
        domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        domElements.micBtn.disabled = true;
        // ... save history, show review UI, etc.
        return;
    }

    // ... logic to play audio for the current turn and enable mic
    // This part would be moved from the original script.js
}


export async function fetchAndDisplayIllustration(prompt) {
    domElements.illustrationPlaceholder.classList.add('hidden');
    domElements.imageLoader.classList.remove('hidden');
    try {
        const result = await apiRef.generateImage(`${prompt}, digital art`);
        if (result.imageUrl) {
            if (stateRef.lessonPlan) {
                stateRef.lessonPlan.illustration_url = result.imageUrl;
                stateRef.save();
            }
            domElements.illustrationImg.src = result.imageUrl;
            domElements.illustrationImg.onload = () => {
                domElements.imageLoader.classList.add('hidden');
                domElements.illustrationImg.classList.remove('hidden');
            };
        }
    } catch (error) {
        console.error("Failed to fetch illustration:", error);
        // show fallback
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
    // ... logic from script.js to create the prompt
    // This would use getRandomNames from names.js (which should be a regular script include)
    const randomNames = window.getRandomNames(language, 5);
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

// ... other lesson logic functions like verifyUserSpeech, resetLesson, etc.
export function toggleSpeechRecognition() { /* ... from script.js ... */ }
export function verifyUserSpeech(spokenText) { /* ... from script.js ... */ }
export function resetLesson() { /* ... from script.js ... */ }
export function confirmStartLesson() { /* ... from script.js ... */ }
export function playLineAudioDebounced(text, party) { /* ... from script.js ... */ }

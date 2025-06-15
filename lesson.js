import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let domElements = {};
let stateRef = {};
let apiRef = {};
let uiRef = {};
let saveStateRef;

// Speech recognition and audio state
let currentSentences = [];
let currentSentenceIndex = 0;
let speechAttempts = 0;
let audioDebounceTimer = null;

// --- Helper Functions ---

function removeParentheses(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * THIS IS THE CORRECT, FULL-FEATURED SENTENCE SPLITTER FROM old/script.js
 * It uses a detailed prompt and includes fallback logic.
 */
async function splitIntoSentences(text) {
    const currentLanguage = domElements.languageSelect.value;
    const cleanText = text.trim();

    // 1. Handle very short texts immediately
    const words = cleanText.split(/\s+/);
    if (words.length <= 5) {
        return [cleanText];
    }

    // 2. For longer texts, use the detailed Gemini prompt
    const prompt = `
You are an expert linguist specializing in splitting text for language learners to practice speaking. Your task is to split the following text into natural, speakable chunks that are easier to practice.

**Instructions:**
1.  **Break into Practice Chunks:** Always try to break longer texts into 2-4 shorter, meaningful chunks that learners can practice separately.
2.  **Natural Boundaries:** Split at natural sentence boundaries, conjunctions, or logical pauses.
3.  **Preserve Meaning:** Each chunk should be complete and meaningful on its own.
4.  **Language-Specific Rules:**
    - For Korean: Split at sentence endings (다, 요, 까, etc.) and conjunctions
    - For Japanese: Split at sentence endings (だ, です, ます, etc.) and particles
    - For Chinese: Split at punctuation and natural phrase boundaries
    - For European languages: Split at periods, commas with conjunctions, and clause boundaries
5.  **Output Format:** Your response MUST be a valid JSON array of strings.
6.  **Minimum Splits:** If the text is longer than 8 words, try to split it into at least 2 chunks.

**Language:** ${currentLanguage}
**Text to Split:** "${cleanText}"

**Example for Korean:**
Input: "잘 모르겠어. 큰 번화장아. 장단점이 있는 것 같아."
Output: ["잘 모르겠어.", "큰 번화장아.", "장단점이 있는 것 같아."]

Now, provide the JSON array for the given text:
`;

    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'lite' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const sentences = JSON.parse(jsonString);

        if (Array.isArray(sentences) && sentences.every(s => typeof s === 'string' && s.trim().length > 0)) {
            if (sentences.length === 1 && words.length > 8) {
                return tryFallbackSplit(cleanText, currentLanguage);
            }
            return sentences;
        } else {
            return tryFallbackSplit(cleanText, currentLanguage);
        }
    } catch (error) {
        console.error("Gemini sentence splitting failed, using fallback split.", error);
        return tryFallbackSplit(cleanText, currentLanguage);
    }
}

function tryFallbackSplit(text, language) {
    const words = text.split(/\s+/);
    if (words.length <= 5) return [text];

    let splitPattern;
    switch (language) {
        case 'Korean': splitPattern = /([다요까]\s*)/; break;
        case 'Japanese': splitPattern = /(です|ます|だ|である)\s*/; break;
        case 'Chinese': splitPattern = /([。！？]\s*)/; break;
        default: splitPattern = /([.!?]\s+)/;
    }
    const parts = text.split(splitPattern).filter(part => part && part.trim().length > 0);
    const sentences = [];
    let currentSentence = '';
    for (let i = 0; i < parts.length; i++) {
        currentSentence += parts[i];
        if (splitPattern.test(parts[i]) || i === parts.length - 1) {
            if (currentSentence.trim()) sentences.push(currentSentence.trim());
            currentSentence = '';
        }
    }
    if (sentences.length <= 1 && words.length > 8) {
        const midPoint = Math.ceil(words.length / 2);
        return [words.slice(0, midPoint).join(' '), words.slice(midPoint).join(' ')];
    }
    return sentences.length > 0 ? sentences : [text];
}


function saveLessonToHistory(lessonPlan, selectedLanguage, originalTopic) {
    try {
        let history = uiRef.getLessonHistory();
        const lessonId = lessonPlan.id;
        const existingLessonIndex = history.findIndex(record => record.id === lessonId);
        const completedAt = new Date().toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        if (existingLessonIndex > -1) {
            const [existingRecord] = history.splice(existingLessonIndex, 1);
            existingRecord.completedAt = completedAt;
            history.unshift(existingRecord);
        } else {
            const newLessonRecord = {
                id: lessonId,
                timestamp: new Date().toISOString(),
                language: selectedLanguage,
                topic: originalTopic,
                scenario: lessonPlan.scenario,
                completedAt: completedAt,
                lessonPlan: lessonPlan,
                languageTopicKey: `${selectedLanguage}-${originalTopic}`
            };
            history.unshift(newLessonRecord);
        }

        if (history.length > state.MAX_LESSON_HISTORY) {
            history.splice(state.MAX_LESSON_HISTORY);
        }
        localStorage.setItem(state.LESSON_HISTORY_KEY, JSON.stringify(history));

        if (domElements.historyContainer && !domElements.historyContainer.classList.contains('hidden')) {
            uiRef.displayLessonHistory();
        }
    } catch (error) {
        console.warn('Failed to save lesson to history:', error);
    }
}


// --- Core Module Functions ---

export function init(elements, stateModule, apiModule, uiModule, saveFunc) {
    domElements = elements;
    stateRef = stateModule;
    apiRef = apiModule;
    uiRef = uiModule;
    saveStateRef = saveFunc;
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
        voice_id: party.toUpperCase() === 'A' ? config.voice_id_a : config.voice_id_b,
        language_code: config.language_code
    };
}

function createGeminiPrompt(language, topic, nativeLangName) {
    const randomNames = getRandomNames(language, 5);
    const nameExamples = randomNames.map(name => `"${name[0]} ${name[1]}"`).join(', ');
    const isEnglish = language === 'English';
    const translationInstruction = isEnglish
        ? "The 'display' text should not contain any parenthetical translations."
        : `The 'display' text MUST include a brief, parenthetical ${nativeLangName} translation. Example: "Bonjour (Hello)".`;
    let lineObjectStructure = `
        - "display": The line of dialogue in ${language}. ${translationInstruction}
        - "clean_text": The line of dialogue in ${language} WITHOUT any parenthetical translations. THIS IS FOR SPEECH RECOGNITION.`;
    if (language === 'Japanese') {
        lineObjectStructure += `
        - "hiragana": A pure hiragana version of "clean_text".`;
    }
    return `
You are a language tutor creating a lesson for a web application. Your task is to generate a single, complete, structured lesson plan in JSON format. Do not output any text or explanation outside of the single JSON object.

The user wants to learn: **${language}**
The user's native language is: **${nativeLangName}**
The user-provided topic for the roleplay is: **"${topic}"**

Follow these steps precisely:

1.  **JSON STRUCTURE:** The entire generated output must be only the JSON object with keys: "title", "background_context", "scenario", "language", "illustration_prompt", "dialogue".
2.  **DIALOGUE PARTY:** Dialogue objects must have a "party" key with "a" (the user) or "b" (the partner).
3.  **LINE OBJECT:** The "line" object must contain: ${lineObjectStructure}
4.  **NAMES:** Use realistic, culturally-appropriate names for characters. Examples for ${language}: ${nameExamples}. DO NOT use placeholders like "[USER NAME]".
5.  **LANGUAGE:** All explanations and titles must be in the user's native language (${nativeLangName}).
6.  **ILLUSTRATION PROMPT:** This must be a brief, descriptive text in English.

Now, generate the complete JSON lesson plan.`;
}

function getRandomNames(language, count = 5) {
    const namesByLanguage = window.characterNames;
    const lang = (namesByLanguage && namesByLanguage[language]) ? language : 'English';
    const langNames = namesByLanguage[lang];
    const allNames = [...langNames.female, ...langNames.male];
    const shuffled = [...allNames].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export async function initializeLesson() {
    if (!domElements.languageSelect || !domElements.topicInput) return;
    
    const language = domElements.languageSelect.value;
    const topic = domElements.topicInput.value;
    if (!topic) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }
    
    domElements.loadingSpinner?.classList.remove('hidden');
    domElements.conversationContainer.innerHTML = '';
    domElements.illustrationImg?.classList.add('hidden');
    domElements.illustrationPlaceholder?.classList.remove('hidden');
    domElements.imageLoader?.classList.add('hidden');

    const prompt = createGeminiPrompt(language, topic, stateRef.nativeLang);
    
    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'pro' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const plan = JSON.parse(jsonString);
        
        if (!plan.id) plan.id = `lesson-${language}-${Date.now()}`;
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        domElements.loadingSpinner?.classList.add('hidden');
        uiRef.stopTopicRotations();
        domElements.landingScreen?.classList.add('hidden');
        domElements.lessonScreen?.classList.remove('hidden');

        await startConversation();
        
        const overlayButton = document.getElementById('confirm-start-lesson-btn');
        if (overlayButton) {
            overlayButton.disabled = true;
            document.getElementById('start-lesson-overlay')?.classList.remove('hidden');
        }

        const illustrationPromise = fetchAndDisplayIllustration(plan.illustration_prompt);
        const audioPromise = prefetchFirstAudio(plan.dialogue[0]);

        await Promise.all([illustrationPromise, audioPromise]);
        
        if (overlayButton) overlayButton.disabled = false;
        
        if (saveStateRef) saveStateRef();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        domElements.loadingSpinner?.classList.add('hidden');
        domElements.landingScreen?.classList.remove('hidden');
        domElements.lessonScreen?.classList.add('hidden');
    }
}

/**
 * THIS IS THE CORRECTED FUNCTION.
 * It pre-processes the entire dialogue, splitting user lines into sentences
 * BEFORE the UI module tries to render anything.
 */
export async function startConversation() {
    stateRef.setCurrentTurnIndex(0);

    if (stateRef.lessonPlan && stateRef.lessonPlan.dialogue) {
        for (const turn of stateRef.lessonPlan.dialogue) {
            if (turn.party && turn.party.toUpperCase() === 'A' && (!turn.sentences || turn.sentences.length === 0)) {
                const cleanText = removeParentheses(turn.line.display);
                turn.sentences = await splitIntoSentences(cleanText);
            }
        }
    }
    
    await uiRef.restoreConversation(stateRef.lessonPlan);
    uiRef.displayLessonTitleAndContext(stateRef.lessonPlan);
    uiRef.addBackToLandingButton();
}

export async function advanceTurn(newTurnIndex) {
    stateRef.setCurrentTurnIndex(newTurnIndex);
    if (saveStateRef) saveStateRef();

    const { lessonPlan, currentTurnIndex: cti } = stateRef;
    if (!lessonPlan || !lessonPlan.dialogue || cti >= lessonPlan.dialogue.length) {
        domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        domElements.micBtn.disabled = true;
        if (lessonPlan) {
            lessonPlan.isCompleted = true;
            saveLessonToHistory(lessonPlan, domElements.languageSelect.value, domElements.topicInput.value);
            uiRef.showReviewModeUI(domElements.languageSelect.value);
        }
        return;
    }

    const currentTurnData = lessonPlan.dialogue[cti];
    document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
    
    const currentLineEl = document.getElementById(`turn-${cti}`);
    if (currentLineEl) {
        currentLineEl.classList.add('active');
        currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (currentTurnData.party && currentTurnData.party.toUpperCase() === 'A') {
        const cleanText = removeParentheses(currentTurnData.line.display);
        currentSentences = currentTurnData.sentences; // Use pre-processed sentences
        currentSentenceIndex = 0;
        domElements.micBtn.disabled = true;
        domElements.micStatus.textContent = uiRef.translateText('listenFirst');
        
        try {
            const audioBlob = await fetchPartnerAudio(cleanText, 'A');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            audio.onended = () => { URL.revokeObjectURL(audioUrl); enableUserMicForSentence(); };
            audio.onerror = () => { URL.revokeObjectURL(audioUrl); enableUserMicForSentence(); };
        } catch (error) {
            enableUserMicForSentence();
        }
    } else { 
        domElements.micBtn.disabled = true;
        domElements.micStatus.textContent = uiRef.translateText('partnerSpeaking');
        try {
            const cleanText = removeParentheses(currentTurnData.line.display);
            const audioBlob = await fetchPartnerAudio(cleanText, 'B');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                domElements.micStatus.textContent = uiRef.translateText('audioFinished');
                setTimeout(() => advanceTurn(cti + 1), 500);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                setTimeout(() => advanceTurn(cti + 1), 500);
            };
        } catch (error) {
            domElements.micStatus.textContent = uiRef.translateText('audioUnavailable');
            setTimeout(() => advanceTurn(cti + 1), 1500);
        }
    }
}

function enableUserMicForSentence() {
    domElements.micBtn.disabled = false;
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
    
    if (currentSentences && currentSentences.length > 1) {
        const currentSentenceEl = document.getElementById(`turn-${stateRef.currentTurnIndex}-sentence-${currentSentenceIndex}`);
        if (currentSentenceEl) currentSentenceEl.classList.add('active-sentence');
        const displaySentence = currentSentenceEl ? currentSentenceEl.textContent : currentSentences[currentSentenceIndex];
        const recordSentenceText = uiRef.translateText('recordSentence');
        domElements.micStatus.innerHTML = `<strong>${recordSentenceText} ${currentSentenceIndex + 1}/${currentSentences.length}:</strong><br><span style="color: #38bdf8; font-weight: bold; text-decoration: underline;">"${displaySentence}"</span>`;
    } else {
        const singleSentenceEl = document.getElementById(`turn-${stateRef.currentTurnIndex}-sentence-0`);
        if (singleSentenceEl) singleSentenceEl.classList.add('active-sentence');
        const yourTurnText = uiRef.translateText('yourTurn');
        const lookForHighlightedText = uiRef.translateText('lookForHighlighted');
        domElements.micStatus.innerHTML = `<strong>${yourTurnText}</strong><br><span style="color: #38bdf8; font-style: italic;">${lookForHighlightedText}</span>`;
    }
}

export function confirmStartLesson() {
    domElements.startLessonOverlay?.classList.add('hidden');
    if (stateRef.preFetchedFirstAudioBlob) {
        const firstTurn = stateRef.lessonPlan.dialogue[0];
        const audioUrl = URL.createObjectURL(stateRef.preFetchedFirstAudioBlob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = parseFloat(domElements.audioSpeedSelect.value);
        audio.play().catch(e => console.error("error playing pre-fetched audio:", e));
        
        const firstLineEl = document.getElementById('turn-0');
        if (firstLineEl) {
            firstLineEl.classList.add('active');
            firstLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        audio.addEventListener('ended', async () => {
            URL.revokeObjectURL(audioUrl);
            if (firstTurn.party && firstTurn.party.toUpperCase() === 'A') {
                const cleanText = removeParentheses(firstTurn.line.display);
                currentSentences = await splitIntoSentences(cleanText);
                currentSentenceIndex = 0;
                enableUserMicForSentence();
            } else {
                advanceTurn(1);
            }
        });
    } else {
        advanceTurn(0);
    }
}

export async function fetchAndDisplayIllustration(prompt) {
    return new Promise(async (resolve) => {
        try {
            domElements.illustrationPlaceholder?.classList.add('hidden');
            domElements.imageLoader?.classList.remove('hidden');

            const result = await apiRef.generateImage(`${prompt}, digital art, minimalist, educational illustration`, {
                imageSize: 'square_hd',
                numInferenceSteps: 50,
                guidanceScale: 10
            });

            if (result.imageUrl) {
                if (stateRef.lessonPlan) {
                    stateRef.lessonPlan.illustration_url = result.imageUrl;
                    if (saveStateRef) saveStateRef();
                }
                
                if (domElements.illustrationImg) {
                    domElements.illustrationImg.src = result.imageUrl;
                    domElements.illustrationImg.onload = () => {
                        domElements.imageLoader?.classList.add('hidden');
                        domElements.illustrationImg?.classList.remove('hidden');
                        resolve();
                    };
                    domElements.illustrationImg.onerror = () => {
                        showFallbackIllustration();
                        resolve();
                    };
                } else {
                     showFallbackIllustration();
                     resolve();
                }
            } else {
                throw new Error("No image URL returned from API.");
            }
        } catch (error) {
            console.error("Failed to fetch illustration:", error);
            showFallbackIllustration();
            resolve();
        }
    });
}

function showFallbackIllustration() {
    domElements.imageLoader?.classList.add('hidden');
    if (domElements.illustrationPlaceholder) {
        domElements.illustrationPlaceholder.innerHTML = `
            <div class="text-center text-gray-400">
                <i class="fas fa-comments text-6xl mb-4"></i>
                <p class="text-lg">${uiRef.translateText('roleplayScenario')}</p>
                <p class="text-sm mt-2">${uiRef.translateText('imageUnavailable')}</p>
            </div>
        `;
        domElements.illustrationPlaceholder.classList.remove('hidden');
    }
}

async function prefetchFirstAudio(firstTurn) {
    return new Promise(async (resolve) => {
        if (!firstTurn) {
            stateRef.setPreFetchedFirstAudioBlob(null);
            return resolve();
        }
        try {
            const blob = await fetchPartnerAudio(removeParentheses(firstTurn.line.display), firstTurn.party);
            stateRef.setPreFetchedFirstAudioBlob(blob);
            resolve();
        } catch (error) {
            stateRef.setPreFetchedFirstAudioBlob(null);
            resolve();
        }
    });
}

async function fetchPartnerAudio(text, party = 'B') {
    const currentLanguage = domElements.languageSelect?.value || 'English';
    const voiceConfig = getVoiceConfig(currentLanguage, party);
    return await apiRef.fetchPartnerAudio(text, voiceConfig);
}

export function toggleSpeechRecognition() {
    if (!stateRef.recognition) return;
    if (stateRef.isRecognizing) {
        stateRef.recognition.stop();
    } else {
        try {
            const selectedLanguage = domElements.languageSelect?.value || 'English';
            stateRef.recognition.lang = getLangCode(selectedLanguage);
            stateRef.recognition.start();
        } catch (error) {
            console.error('speech recognition failed to start:', error);
            if (domElements.micStatus) {
                domElements.micStatus.textContent = 'Speech recognition is not supported for this language in your browser.';
            }
        }
    }
}

export async function verifyUserSpeech(spokenText) {
    try {
        speechAttempts++;
        const currentLanguage = domElements.languageSelect.value;
        const currentTurnData = stateRef.lessonPlan.dialogue[stateRef.currentTurnIndex];
        let requiredText = (currentSentences.length > 1) ? currentSentences[currentSentenceIndex] : currentTurnData.line.clean_text;

        const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;:"'`´''""。！？]/g, '').replace(/\s+/g, ' ');
        const normalizedSpoken = normalize(spokenText);
        const normalizedRequired = normalize(requiredText);

        const similarity = levenshteinDistance(normalizedSpoken, normalizedRequired);
        const maxLength = Math.max(normalizedSpoken.length, normalizedRequired.length);
        const similarityScore = maxLength === 0 ? 1 : 1 - (similarity / maxLength);

        if (similarityScore >= 0.75) {
            handleCorrectSpeech();
        } else {
            handleIncorrectSpeech(similarityScore, normalizedRequired, normalizedSpoken);
        }
    } catch (error) {
        console.error("Critical error in verifyUserSpeech:", error);
        domElements.micStatus.textContent = 'A critical error occurred. Please reset the lesson.';
        domElements.micBtn.disabled = true;
    }
}

function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i++) { matrix[0][i] = i; }
    for (let j = 0; j <= str2.length; j++) { matrix[j][0] = j; }
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j - 1][i] + 1, matrix[j][i - 1] + 1, matrix[j - 1][i - 1] + cost);
        }
    }
    return matrix[str2.length][str1.length];
}

function handleCorrectSpeech() {
    speechAttempts = 0;
    if (currentSentences.length > 1 && (currentSentenceIndex < currentSentences.length - 1)) {
        currentSentenceIndex++;
        domElements.micStatus.textContent = uiRef.translateText('sentenceCorrect');
        setTimeout(() => enableUserMicForSentence(), 1500);
    } else {
        domElements.micStatus.textContent = (currentSentences.length > 1) ? uiRef.translateText('allSentencesCorrect') : uiRef.translateText('correct');
        const currentLineEl = document.getElementById(`turn-${stateRef.currentTurnIndex}`);
        if (currentLineEl) currentLineEl.style.borderColor = '#4ade80';
        domElements.micBtn.disabled = true;
        setTimeout(() => advanceTurn(stateRef.currentTurnIndex + 1), 2000);
    }
}

function handleIncorrectSpeech(similarity, required, spoken) {
    const sentenceInfo = currentSentences.length > 1 ? ` (Sentence ${currentSentenceIndex + 1}/${currentSentences.length})` : '';
    domElements.micStatus.textContent = `${uiRef.translateText('tryAgain')} (${(similarity * 100).toFixed(0)}% match)${sentenceInfo}`;
    const currentLineEl = document.getElementById(`turn-${stateRef.currentTurnIndex}`);
    if (currentLineEl) {
        currentLineEl.classList.remove('active');
        void currentLineEl.offsetWidth;
        currentLineEl.classList.add('active');
        currentLineEl.style.borderColor = '#f87171';
    }
    setTimeout(() => {
        if (currentSentences.length > 1) {
            enableUserMicForSentence();
        } else {
            domElements.micStatus.textContent = uiRef.translateText('tryAgainStatus');
        }
        if (currentLineEl) currentLineEl.style.borderColor = '';
    }, 4000);
}

export function resetLesson() {
    if (!stateRef.lessonPlan) return;
    stateRef.audioPlayer?.pause();
    stateRef.audioPlayer.src = "";
    stateRef.setCurrentTurnIndex(0);
    document.querySelectorAll('.dialogue-line.active, .sentence-span.active-sentence').forEach(el => {
        el.classList.remove('active', 'active-sentence');
        el.style.borderColor = '';
    });
    domElements.micBtn.disabled = false;
    domElements.micBtn.classList.remove('bg-green-600');
    domElements.micBtn.classList.add('bg-red-600');
    domElements.micStatus.textContent = uiRef.translateText('micStatus');
    stateRef.recognition?.stop();
    uiRef.hideReviewModeBanner?.();
    advanceTurn(0);
}

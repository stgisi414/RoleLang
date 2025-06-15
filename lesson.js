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


// --- Helper Functions (Unique to Lesson Logic) ---

function removeParentheses(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

async function splitIntoSentences(text) {
    const currentLanguage = domElements.languageSelect.value;
    const cleanText = text.trim();

    const words = cleanText.split(/\s+/);
    if (words.length <= 5) {
        return [cleanText];
    }

    const prompt = `
You are an expert linguist. Split the following text into natural, speakable chunks for a language learner.
- Break long texts into 2-4 shorter, meaningful chunks.
- Split at natural sentence boundaries or logical pauses.
- Your response MUST be a valid JSON array of strings.
Language: ${currentLanguage}
Text to Split: "${cleanText}"
Provide the JSON array.`;

    try {
        const data = await apiRef.callGeminiAPI(prompt);
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

function createGeminiPrompt(language, topic, nativeLang) {
    const randomNames = window.getRandomNames(language, 5);
    const nameExamples = randomNames.map(name => `"${name[0]} ${name[1]}"`).join(', ');
    const isEnglish = language === 'English';
    
    const nativeLangName = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'
    }[nativeLang] || 'English';

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

**JSON STRUCTURE REQUIREMENTS:**
1.  **Top-Level Keys:** "title", "background_context", "scenario", "language", "illustration_prompt", "dialogue".
2.  **Title:** A catchy title for the lesson in ${nativeLangName}.
3.  **Background Context:** A brief paragraph in ${nativeLangName} explaining the context.
4.  **Dialogue Object:** Each object in the "dialogue" array must contain "party" ('A' or 'B'), "line" (an object), and optional "explanation" (with "title" and "body" in ${nativeLangName}).
5.  **Line Object:** The "line" object must contain these fields: ${lineObjectStructure}.
6.  **Translation Language:** All parenthetical translations must be in ${nativeLangName}.
7.  **Character Names:** Use realistic, culturally-appropriate names for ${language}. Examples: ${nameExamples}.
8.  **NO PLACEHOLDERS:** Do not use placeholders like "[USER NAME]".
9.  **Illustration Prompt:** A brief, descriptive prompt in English for an illustration (style: highly detailed, anime-like, stylish, no text).

Now, generate the complete JSON lesson plan.`;
}

// --- Core Exported Functions ---

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


export async function initializeLesson() {
    if (!domElements.languageSelect || !domElements.topicInput) return;
    
    const language = domElements.languageSelect.value;
    const topic = domElements.topicInput.value;
    if (!topic) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }
    
    uiRef.showLoadingSpinner(); 
    const prompt = createGeminiPrompt(language, topic, stateRef.nativeLang);
    
    try {
        const data = await apiRef.callGeminiAPI(prompt); 
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const plan = JSON.parse(jsonString);
        
        if (!plan.id) plan.id = `lesson-${language}-${Date.now()}`;
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        uiRef.hideLoadingSpinner();
        uiRef.showLessonScreen();

        await startConversation();
        
        uiRef.showStartOverlay();
        uiRef.disableStartButton(true);

        const illustrationPromise = fetchAndDisplayIllustration(plan.illustration_prompt);
        const audioPromise = prefetchFirstAudio(plan.dialogue[0]);

        await Promise.all([illustrationPromise, audioPromise]);
        
        uiRef.disableStartButton(false);
        
        if (saveStateRef) saveStateRef();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        uiRef.hideLoadingSpinner();
        uiRef.showLandingScreen();
    }
}

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
        uiRef.showLessonComplete();
        if (lessonPlan) {
            lessonPlan.isCompleted = true;
            saveLessonToHistory(lessonPlan, domElements.languageSelect.value, domElements.topicInput.value);
            uiRef.showReviewModeUI(domElements.languageSelect.value);
        }
        return;
    }

    const currentTurnData = lessonPlan.dialogue[cti];
    uiRef.highlightActiveLine(cti);

    if (currentTurnData.party && currentTurnData.party.toUpperCase() === 'A') {
        const cleanText = removeParentheses(currentTurnData.line.display);
        currentSentences = currentTurnData.sentences; 
        currentSentenceIndex = 0;
        uiRef.updateMicStatus('listenFirst', true);
        
        try {
            const audioBlob = await apiRef.fetchPartnerAudio(cleanText, getVoiceConfig(domElements.languageSelect.value, 'A'));
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
        uiRef.updateMicStatus('partnerSpeaking', true);
        try {
            const cleanText = removeParentheses(currentTurnData.line.display);
            const audioBlob = await apiRef.fetchPartnerAudio(cleanText, getVoiceConfig(domElements.languageSelect.value, 'B'));
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                uiRef.updateMicStatus('audioFinished');
                setTimeout(() => advanceTurn(cti + 1), 500);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                setTimeout(() => advanceTurn(cti + 1), 500);
            };
        } catch (error) {
            uiRef.updateMicStatus('audioUnavailable');
            setTimeout(() => advanceTurn(cti + 1), 1500);
        }
    }
}

function enableUserMicForSentence() {
    uiRef.enableMicButton(true);
    uiRef.highlightActiveSentence(stateRef.currentTurnIndex, currentSentenceIndex);
    
    if (currentSentences && currentSentences.length > 1) {
        const displaySentence = currentSentences[currentSentenceIndex];
        uiRef.updateMicStatusForSentence(currentSentenceIndex + 1, currentSentences.length, displaySentence);
    } else {
        uiRef.updateMicStatus('yourTurn');
    }
}

export function confirmStartLesson() {
    uiRef.hideStartOverlay();

    if (stateRef.preFetchedFirstAudioBlob) {
        const firstTurn = stateRef.lessonPlan.dialogue[0];
        const audioUrl = URL.createObjectURL(stateRef.preFetchedFirstAudioBlob);
        
        stateRef.audioPlayer.src = audioUrl;
        stateRef.audioPlayer.playbackRate = parseFloat(domElements.audioSpeedSelect.value);
        
        stateRef.audioPlayer.play().catch(e => console.error("Error playing pre-fetched audio:", e));

        uiRef.highlightActiveLine(0);

        stateRef.audioPlayer.addEventListener('ended', async () => {
            URL.revokeObjectURL(audioUrl);

            if (firstTurn.party && firstTurn.party.toUpperCase() === 'A') {
                const cleanText = removeParentheses(firstTurn.line.display);
                currentSentences = await splitIntoSentences(cleanText);
                currentSentenceIndex = 0;
                enableUserMicForSentence();
            } else {
                advanceTurn(1);
            }
        }, { once: true });
    } else {
        advanceTurn(0);
    }
}

async function fetchAndDisplayIllustration(prompt) {
    try {
        uiRef.showImageLoader();
        const result = await apiRef.generateImage(`${prompt}, digital art, minimalist, educational illustration`);
        if (result.imageUrl) {
            if (stateRef.lessonPlan) {
                stateRef.lessonPlan.illustration_url = result.imageUrl;
                if (saveStateRef) saveStateRef();
            }
            await uiRef.restoreIllustration(result.imageUrl); 
        } else {
            throw new Error("No image URL returned from API.");
        }
    } catch (error) {
        console.error("Failed to fetch illustration:", error);
        uiRef.showFallbackIllustration();
    }
}

async function prefetchFirstAudio(firstTurn) {
    if (!firstTurn) {
        stateRef.setPreFetchedFirstAudioBlob(null);
        return;
    }
    try {
        const blob = await apiRef.fetchPartnerAudio(removeParentheses(firstTurn.line.display), getVoiceConfig(domElements.languageSelect.value, firstTurn.party));
        stateRef.setPreFetchedFirstAudioBlob(blob);
    } catch (error) {
        stateRef.setPreFetchedFirstAudioBlob(null);
    }
}

export function toggleSpeechRecognition() {
    if (!stateRef.recognition) return;
    if (stateRef.isRecognizing) {
        stateRef.recognition.stop();
    } else {
        try {
            const langCode = getLangCode(domElements.languageSelect.value);
            stateRef.recognition.lang = langCode;
            console.log(`Speech recognition language set to: ${langCode}`);
            stateRef.recognition.start();
        } catch (error) {
            console.error('Speech recognition failed to start:', error);
            uiRef.updateMicStatus('speechNotSupported');
        }
    }
}

export async function verifyUserSpeech(spokenText) {
    try {
        speechAttempts++;
        const currentLanguage = domElements.languageSelect.value;
        const currentTurnData = stateRef.lessonPlan.dialogue[stateRef.currentTurnIndex];

        if (['Japanese', 'Korean', 'Chinese'].includes(currentLanguage)) {
            uiRef.updateMicStatus('verifyingWithAI');
            const nativeLangName = {'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'}[stateRef.nativeLang] || 'English';
            let expectedLine = (currentSentences.length > 1) ? currentSentences[currentSentenceIndex] : currentTurnData.line.clean_text;
            const verificationPrompt = `You are a language evaluation tool... Expected: "${expectedLine}" Spoken: "${spokenText}" Provide the JSON response.`;
            const data = await apiRef.callGeminiAPI(verificationPrompt);
            const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const result = JSON.parse(jsonString);
            if (result.is_match) {
                handleCorrectSpeech();
            } else {
                handleIncorrectSpeech(0, expectedLine, spokenText, result.feedback);
            }
        } else {
            let requiredText = (currentSentences.length > 1) ? currentSentences[currentSentenceIndex] : currentTurnData.line.clean_text;
            const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;:"'`´''""。！？]/g, '').replace(/\s+/g, ' ');
            const normalizedSpoken = normalize(spokenText);
            const normalizedRequired = normalize(requiredText);
            const distance = levenshteinDistance(normalizedSpoken, normalizedRequired);
            const maxLength = Math.max(normalizedSpoken.length, normalizedRequired.length);
            const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);
            if (similarity >= 0.75) {
                handleCorrectSpeech();
            } else {
                handleIncorrectSpeech(similarity, normalizedRequired, normalizedSpoken);
            }
        }
    } catch (error) {
        console.error("Critical error in verifyUserSpeech:", error);
        uiRef.updateMicStatus('criticalError');
        uiRef.enableMicButton(false);
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
        uiRef.updateMicStatus('sentenceCorrect');
        setTimeout(() => enableUserMicForSentence(), 1500);
    } else {
        const statusKey = (currentSentences.length > 1) ? 'allSentencesCorrect' : 'correct';
        uiRef.updateMicStatus(statusKey);
        uiRef.flashLineBorder(stateRef.currentTurnIndex, 'correct');
        uiRef.enableMicButton(false);
        setTimeout(() => advanceTurn(stateRef.currentTurnIndex + 1), 2000);
    }
}

function handleIncorrectSpeech(similarity, required, spoken, apiFeedback = null) {
    const currentLanguage = domElements.languageSelect.value;
    const isAsianLang = ['Japanese', 'Korean', 'Chinese'].includes(currentLanguage);
    let feedbackText;

    if (isAsianLang) {
        feedbackText = apiFeedback || uiRef.translateText('tryAgain');
    } else {
        const sentenceInfo = currentSentences.length > 1 ? ` (Sentence ${currentSentenceIndex + 1}/${currentSentences.length})` : '';
        feedbackText = `${uiRef.translateText('tryAgain')} (${(similarity * 100).toFixed(0)}% match)${sentenceInfo}`;
    }
    
    uiRef.updateMicStatusHTML(feedbackText);
    
    if (currentLanguage === 'Chinese' && speechAttempts >= 3 && isAsianLang) {
        uiRef.showSkipButton(handleCorrectSpeech);
    }

    uiRef.flashLineBorder(stateRef.currentTurnIndex, 'incorrect');
    setTimeout(() => {
        if (currentSentences.length > 1) {
            enableUserMicForSentence();
        } else {
            uiRef.updateMicStatus('tryAgainStatus');
        }
    }, 4000);
}


export async function startVocabularyQuiz(language) {
    const quizModal = document.createElement('div');
    quizModal.id = 'vocab-quiz-modal';
    quizModal.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
    quizModal.innerHTML = `<div class="bg-gray-800 rounded-xl p-6 text-center glassmorphism"><div class="loader mx-auto mb-4"></div><p class="text-white">Generating quiz...</p></div>`;
    document.body.appendChild(quizModal);

    try {
        const dialogueText = stateRef.lessonPlan.dialogue.map(turn => turn.line.display).join('\n');
        const nativeLangName = {'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'}[stateRef.nativeLang] || 'English';

        const prompt = `
        You are a quiz generation tool for a language learner.
        The user is learning ${language} and their native language is ${nativeLangName}.
        From the following dialogue, extract 5 key vocabulary words/phrases.
        For each word/phrase, provide:
        1. The original "word".
        2. The correct "translation" in ${nativeLangName}.
        3. A "context" sentence from the dialogue where the word was used.
        4. An array of three plausible but incorrect "wrongAnswers" in ${nativeLangName}.

        Your response MUST be a valid JSON array of objects with the keys: "word", "translation", "context", "wrongAnswers".

        Dialogue:
        ---
        ${dialogueText}
        ---

        Provide ONLY the JSON array.`;

        const data = await apiRef.callGeminiAPI(prompt);
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const vocabulary = JSON.parse(jsonString);

        if (!vocabulary || vocabulary.length === 0) {
            throw new Error("AI did not return any vocabulary.");
        }

        createVocabularyQuizModal(vocabulary, language);

    } catch (error) {
        console.error("Failed to generate vocabulary quiz:", error);
        quizModal.innerHTML = `
            <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full glassmorphism text-center">
                <h3 class="text-xl font-bold text-red-400 mb-4">Error</h3>
                <p class="text-gray-300 mb-6">Could not generate a vocabulary quiz for this lesson.</p>
                <button id="close-quiz-error-btn" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">Close</button>
            </div>
        `;
        document.getElementById('close-quiz-error-btn').onclick = () => quizModal.remove();
    }
}


function createVocabularyQuizModal(vocabulary, language) {
    const quizModal = document.getElementById('vocab-quiz-modal');
    const shuffledVocab = [...vocabulary].sort(() => 0.5 - Math.random());
    let currentQuestion = 0;
    let score = 0;

    function updateQuizContent() {
        if (currentQuestion >= shuffledVocab.length) {
            const percentage = Math.round((score / shuffledVocab.length) * 100);
            quizModal.innerHTML = `
            <div class="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto glassmorphism text-center">
                <h3 class="text-2xl font-bold text-purple-300 mb-4">${ui.translateText('quizComplete')}</h3>
                <div class="text-6xl mb-4">${percentage >= 80 ? '🎉' : '📚'}</div>
                <p class="text-xl text-white mb-4">${ui.translateText('yourScore')}: ${score}/${shuffledVocab.length} (${percentage}%)</p>
                <div class="flex space-x-4 justify-center">
                    <button id="retry-quiz-btn" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">Retry Quiz</button>
                    <button id="close-quiz-btn" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">Close</button>
                </div>
            </div>`;
            document.getElementById('retry-quiz-btn').onclick = () => createVocabularyQuizModal(vocabulary, language);
            document.getElementById('close-quiz-btn').onclick = () => quizModal.remove();
            return;
        }

        const currentVocab = shuffledVocab[currentQuestion];
        const correctAnswer = currentVocab.translation;
        const allOptions = [correctAnswer, ...currentVocab.wrongAnswers].sort(() => 0.5 - Math.random());

        quizModal.innerHTML = `
            <div class="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto glassmorphism relative">
                 <button id="close-quiz-btn" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
                <div class="text-center mb-6">
                    <h3 class="text-xl font-bold text-purple-300 mb-2">${ui.translateText('vocabularyQuiz')}</h3>
                    <p class="text-gray-300 text-sm mb-2">${ui.translateText('whatDoesThisMean')}</p>
                    <div class="text-3xl font-bold text-white mb-2">${currentVocab.word}</div>
                    <div class="text-sm text-gray-400 italic">"${currentVocab.context}"</div>
                </div>
                <div class="grid grid-cols-1 gap-3 mb-6">
                    ${allOptions.map((option, index) => `<button class="quiz-option w-full p-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-left" data-answer="${option}">${String.fromCharCode(65 + index)}. ${option}</button>`).join('')}
                </div>
            </div>`;

        quizModal.querySelectorAll('.quiz-option').forEach(option => {
            option.onclick = () => {
                const isCorrect = option.dataset.answer === correctAnswer;
                option.classList.add(isCorrect ? 'bg-green-600' : 'bg-red-600');
                quizModal.querySelectorAll('.quiz-option').forEach(opt => opt.disabled = true);
                if (isCorrect) score++;
                
                setTimeout(() => {
                    currentQuestion++;
                    updateQuizContent();
                }, 1200);
            };
        });
        document.getElementById('close-quiz-btn').onclick = () => quizModal.remove();
    }
    updateQuizContent();
}

export async function reviewLesson(lessonRecord) {
    const plan = lessonRecord.lessonPlan;
    if (!plan.id) {
        plan.id = `lesson-${lessonRecord.language}-${Date.now()}`;
    }
    stateRef.setLessonPlan(plan);
    stateRef.setCurrentTurnIndex(0);

    if (domElements.languageSelect) domElements.languageSelect.value = lessonRecord.language;
    if (domElements.topicInput) domElements.topicInput.value = lessonRecord.topic;

    if (stateRef.recognition) {
        stateRef.recognition.lang = getLangCode(lessonRecord.language);
    }

    uiRef.showLessonScreen();
    uiRef.stopTopicRotations();

    if (plan.illustration_url) {
        uiRef.restoreIllustration(plan.illustration_url);
    } else if (plan.illustration_prompt) {
        fetchAndDisplayIllustration(plan.illustration_prompt);
    }
    
    await startConversation();
    
    uiRef.showReviewModeUI(lessonRecord.language);
    
    if (saveStateRef) saveStateRef();
    
    advanceTurn(0);
}

export async function playLineAudio(text, party = 'B') {
    stateRef.audioController.abort();
    stateRef.audioController = new AbortController();

    try {
        const cleanText = removeParentheses(text);
        const voiceConfig = getVoiceConfig(domElements.languageSelect.value, party);
        const audioBlob = await apiRef.fetchPartnerAudio(cleanText, voiceConfig);
        const audioUrl = URL.createObjectURL(audioBlob);

        if (stateRef.audioPlayer.src) {
            URL.revokeObjectURL(stateRef.audioPlayer.src);
        }
        stateRef.audioPlayer.src = audioUrl;
        stateRef.audioPlayer.playbackRate = parseFloat(domElements.audioSpeedSelect.value);
        
        await stateRef.audioPlayer.play();
        
    } catch (error) {
        console.error("Failed to fetch audio for manual playback:", error);
    }
}

export function playLineAudioDebounced(text, party = 'B') {
    if (audioDebounceTimer) {
        clearTimeout(audioDebounceTimer);
    }
    if (!stateRef.audioPlayer.paused) {
        stateRef.audioPlayer.pause();
    }
    audioDebounceTimer = setTimeout(() => {
        playLineAudio(text, party);
        audioDebounceTimer = null;
    }, 300);
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

export function resetLesson() {
    if (!stateRef.lessonPlan) return;
    stateRef.audioPlayer?.pause();
    stateRef.audioPlayer.src = "";
    stateRef.setCurrentTurnIndex(0);
    uiRef.resetHighlights();
    uiRef.resetMic();
    stateRef.recognition?.stop();
    uiRef.hideReviewModeBanner?.();
    advanceTurn(0);
}
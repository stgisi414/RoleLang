import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { showToast } from './ui.js';

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

    // For languages without spaces, count characters instead of words
    const isSpacelessLanguage = ['Japanese', 'Chinese'].includes(currentLanguage);
    const textLength = isSpacelessLanguage ? cleanText.length : cleanText.split(/\s+/).length;

    // Lower threshold for spaceless languages
    const threshold = isSpacelessLanguage ? 15 : 5;

    if (textLength <= threshold) {
        return [cleanText];
    }

    const prompt = `
You are an expert linguist. Split the following text into natural, speakable chunks for a language learner.
- Break long texts into 2-4 shorter, meaningful chunks.
- Split at natural sentence boundaries or logical pauses.
- For Japanese: Split at particles like は、が、を、に、で or sentence endings like です、ます、だ
- For Chinese: Split at punctuation marks or natural pause points
- For Korean: Split at particles or sentence endings
- Your response MUST be a valid JSON array of strings.
Language: ${currentLanguage}
Text to Split: "${cleanText}"
Provide the JSON array.`;

    try {
        const data = await apiRef.callGeminiAPI(prompt);
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const sentences = JSON.parse(jsonString);

        if (Array.isArray(sentences) && sentences.every(s => typeof s === 'string' && s.trim().length > 0)) {
            if (sentences.length === 1 && textLength > (threshold * 1.5)) {
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
    const isSpacelessLanguage = ['Japanese', 'Chinese'].includes(language);
    const words = isSpacelessLanguage ? [text] : text.split(/\s+/);
    const threshold = isSpacelessLanguage ? 15 : 5;

    if ((isSpacelessLanguage && text.length <= threshold) || (!isSpacelessLanguage && words.length <= threshold)) {
        return [text];
    }

    let splitPattern;
    switch (language) {
        case 'Korean': 
            splitPattern = /([다요까니다습니다]\s*)/; 
            break;
        case 'Japanese': 
            splitPattern = /(です|ます|だ|である|た|て|。|、)/; 
            break;
        case 'Chinese': 
            splitPattern = /([。！？，、]\s*)/; 
            break;
        default: 
            splitPattern = /([.!?]\s+)/;
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

    // If still no good split, divide by length
    if (sentences.length <= 1) {
        if (isSpacelessLanguage) {
            const midPoint = Math.ceil(text.length / 2);
            return [text.slice(0, midPoint), text.slice(midPoint)];
        } else {
            const midPoint = Math.ceil(words.length / 2);
            return [words.slice(0, midPoint).join(' '), words.slice(midPoint).join(' ')];
        }
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

// Helper function to convert common kanji names to hiragana approximations
function convertKanjiToHiragana(kanjiName) {
    // This is a simplified mapping for common Japanese names
    // In a production app, you'd want a more comprehensive kanji-to-hiragana converter
    const kanjiToHiraganaMap = {
        // Surnames
        '佐藤': 'さとう', '鈴木': 'すずき', '高橋': 'たかはし', '田中': 'たなか', '伊藤': 'いとう',
        '渡辺': 'わたなべ', '山本': 'やまもと', '中村': 'なかむら', '小林': 'こばやし', '加藤': 'かとう',
        '吉田': 'よしだ', '山田': 'やまだ', '佐々木': 'ささき', '山口': 'やまぐち', '松本': 'まつもと',
        // Given names (examples)
        '陽葵': 'ひまり', '凛': 'りん', '詩': 'うた', '結菜': 'ゆいな', '咲良': 'さくら',
        '蓮': 'れん', '陽翔': 'はると', '蒼': 'あおい', '湊': 'みなと', '樹': 'いつき'
    };

    return kanjiToHiraganaMap[kanjiName] || kanjiName;
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
10. **AUDIO TAGGING FOR EXPLANATIONS:** In the explanation "body" text, wrap any ${language} words or phrases that would be helpful for pronunciation practice in <audio></audio> tags. For example: "The word <audio>bonjour</audio> is a common greeting" or "Notice how <audio>je suis</audio> means 'I am'". This allows the app to make these phrases clickable for audio playback. Use this for 2-4 key terms per explanation.
11. **JAPANESE NAMES:** For Japanese, ALWAYS present the names in hiragana with the original kanji in parentheses. For example, "たなか (田中)".

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
    const language = domElements.languageSelect?.value;
    const topic = domElements.topicInput?.value;

    if (!topic) {
        showToast(uiRef.translateText('enterTopic'), 'warning');
        return;
    }

    // Clear state and reset UI
    state.setLessonPlan(null);
    state.setCurrentTurnIndex(0);
    if (typeof saveStateRef === 'function') saveStateRef();

    uiRef.showLoadingSpinner();
    uiRef.hideReviewModeBanner();

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
        showToast(`${uiRef.translateText('errorLoading')} ${error.message}`, 'error');
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
        uiRef.updateMicStatusHTML(`🎉 ${uiRef.translateText('lessonComplete')}`);
        uiRef.enableMicButton(false);
        if (lessonPlan) {
            lessonPlan.isCompleted = true;
            saveLessonToHistory(lessonPlan, domElements.languageSelect.value, domElements.topicInput.value);
            uiRef.showReviewModeUI(domElements.languageSelect.value);
        }
        return;
    }

    const currentTurnData = lessonPlan.dialogue[cti];
    uiRef.highlightActiveLine(cti);

    // If in review mode, don't auto-play audio
    if (lessonPlan.isReviewMode) {
        uiRef.updateMicStatus('reviewModeReady');
        uiRef.enableMicButton(false);
        return;
    }

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

    // Check if we're in review mode - if so, don't auto-play
    if (stateRef.lessonPlan && stateRef.lessonPlan.isReviewMode) {
        uiRef.highlightActiveLine(0);
        uiRef.updateMicStatus('reviewModeReady');
        uiRef.enableMicButton(false);
        return;
    }

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

export async function fetchAndDisplayIllustration(prompt) {
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

            const verificationPrompt = `
You are a language evaluation tool. The user's native language is ${nativeLangName}.

Your task is to determine if a student's spoken text is a correct phonetic match for a given sentence, ignoring punctuation and spacing.

IMPORTANT CONSIDERATIONS FOR CHINESE:
- Chinese speech recognition often struggles with technical terms, English words, and mixed content.
- Browser speech recognition for Chinese has significant limitations with tones and pronunciation variations.
- Focus heavily on overall meaning and context rather than exact character matching.
- Be very lenient with technical vocabulary.
- If the spoken text contains any key concepts from the expected sentence, consider it a match.
- Chinese speech recognition frequently mistranscribes or omits technical terms entirely.
- Accept partial matches if core vocabulary is present, even if grammar or word order differs.
- Consider regional accent variations and pronunciation differences.
- If more than 50% of the core meaning is captured, consider it a successful attempt.

GENERAL CONSIDERATIONS:
- Be flexible with mixed-language content (e.g., English words/acronyms within other languages).
- Speech recognition may not capture English letters/acronyms correctly when embedded in other languages.
- Focus on the overall meaning and pronunciation rather than exact character matching.
- If the spoken text captures the main meaning despite missing parts, consider it a match.

Your response MUST be a simple JSON object with two fields:
1. "is_match": a boolean (true or false). For Chinese, be VERY generous with this assessment.
2. "feedback": A brief, encouraging explanation; citing, if applicable, what exactly the user got wrong. IMPORTANT: This "feedback" field MUST be written in the user's native language, which is ${nativeLangName}.

Here is the information for your evaluation:
- The student was expected to say: "${expectedLine}"
- The student's speech recognition produced: "${spokenText}"

Remember: For Chinese learners, speech recognition technology is often inadequate. Be very forgiving and focus on effort and partial understanding.

Now, provide the JSON response.`;

            const data = await apiRef.callGeminiAPI(verificationPrompt);
            const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const result = JSON.parse(jsonString);
            if (result.is_match) {
                handleCorrectSpeech();
            } else {
                handleIncorrectSpeech(0, expectedLine, spokenText, result.feedback);
            }
        } else {
            // Enhanced logic for Western languages
            let requiredText = (currentSentences.length > 1) ? currentSentences[currentSentenceIndex] : currentTurnData.line.clean_text;

            // More aggressive normalization for better matching
            const normalize = (text) => {
                return text.trim()
                    .toLowerCase()
                    .replace(/[.,!?;:"'`´''""。！？]/g, '')
                    .replace(/\s+/g, ' ')
                    .replace(/[-_]/g, ' ') // Handle hyphens and underscores
                    .trim();
            };

            const normalizedSpoken = normalize(spokenText);
            const normalizedRequired = normalize(requiredText);

            console.log('Speech verification:', {
                original: requiredText,
                normalized: normalizedRequired,
                spoken: normalizedSpoken
            });

            // Check for exact match first
            if (normalizedSpoken === normalizedRequired) {
                handleCorrectSpeech();
                return;
            }

            // Check if spoken text contains all major words from required text
            const requiredWords = normalizedRequired.split(' ').filter(w => w.length > 2);
            const spokenWords = normalizedSpoken.split(' ');
            const matchedWords = requiredWords.filter(word => 
                spokenWords.some(spokenWord => 
                    spokenWord.includes(word) || word.includes(spokenWord) || 
                    levenshteinDistance(word, spokenWord) <= 1
                )
            );

            const wordMatchRatio = requiredWords.length > 0 ? matchedWords.length / requiredWords.length : 0;

            // Use Levenshtein distance as backup
            const distance = levenshteinDistance(normalizedSpoken, normalizedRequired);
            const maxLength = Math.max(normalizedSpoken.length, normalizedRequired.length);
            const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);

            // More lenient matching - accept if word match ratio is good OR similarity is decent
            if (wordMatchRatio >= 0.7 || similarity >= 0.6) {
                handleCorrectSpeech();
            } else {
                handleIncorrectSpeech(Math.max(similarity, wordMatchRatio), normalizedRequired, normalizedSpoken);
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
        const vocabulary = await extractVocabularyFromDialogue();

        if (!vocabulary || vocabulary.length === 0) {
            throw new Error("No vocabulary found in the dialogue.");
        }

        const vocabularyWithTranslations = await generateVocabularyTranslations(vocabulary, language);
        createVocabularyQuizModal(vocabularyWithTranslations, language);

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

async function extractVocabularyFromDialogue() {
    const language = domElements.languageSelect.value;

    if (language === 'English') {
        if (!stateRef.lessonPlan || !stateRef.lessonPlan.dialogue) return [];
        const dialogueText = stateRef.lessonPlan.dialogue.map(turn => turn.line.display).join('\n');
        const prompt = `
You are a vocabulary extraction tool for an English language learner. From the following dialogue, identify 5-10 key vocabulary words or phrases that would be useful for a learner.
For each item, provide the word/phrase and a simple definition or synonym in English.
Your response MUST be a valid JSON array of objects, with each object having a "word" key and a "translation" key (where "translation" is the definition/synonym).
Example:
[
  {"word": "hectic", "translation": "very busy and full of activity"},
  {"word": "grab a bite", "translation": "to get something to eat"}
]
Dialogue:
---
${dialogueText}
---
Now, provide the JSON array.`;

        try {
            const data = await apiRef.callGeminiAPI(prompt);
            const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const vocabulary = JSON.parse(jsonString);

            return vocabulary.map(vocabItem => {
                const contextTurnIndex = stateRef.lessonPlan.dialogue.findIndex(turn =>
                    turn.line && turn.line.display && turn.line.display.toLowerCase().includes(vocabItem.word.toLowerCase())
                );

                if (contextTurnIndex !== -1) {
                    const contextParts = [];
                    if (contextTurnIndex > 0) {
                        const precedingTurn = stateRef.lessonPlan.dialogue[contextTurnIndex - 1];
                        if (precedingTurn && precedingTurn.line && precedingTurn.line.display) {
                            contextParts.push(removeParentheses(precedingTurn.line.display));
                        }
                    }

                    const currentTurn = stateRef.lessonPlan.dialogue[contextTurnIndex];
                    const currentText = removeParentheses(currentTurn.line.display);
                    const wordRegex = new RegExp(vocabItem.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    const contextWithoutWord = currentText.replace(wordRegex, '___');
                    contextParts.push(contextWithoutWord);

                    if (contextTurnIndex < stateRef.lessonPlan.dialogue.length - 1) {
                        const followingTurn = stateRef.lessonPlan.dialogue[contextTurnIndex + 1];
                        if (followingTurn && followingTurn.line && followingTurn.line.display) {
                            contextParts.push(removeParentheses(followingTurn.line.display));
                        }
                    }
                    return { ...vocabItem, context: contextParts.join(' ... ') };
                }
                return { ...vocabItem, context: vocabItem.word };
            });
        } catch (error) {
            console.error("Failed to extract vocabulary for English lesson:", error);
            return [];
        }
    } else {
        if (!stateRef.lessonPlan || !stateRef.lessonPlan.dialogue) return [];
        const vocabulary = [];
        const seenWords = new Set();
        stateRef.lessonPlan.dialogue.forEach((turn, turnIndex) => {
            if (turn.line && turn.line.display) {
                const cleanText = removeParentheses(turn.line.display);
                const translation = extractTranslation(turn.line.display);
                if (translation) {
                    const word = cleanText.trim();
                    const translationClean = translation.replace(/[()]/g, '').trim();
                    if (word && translationClean && !seenWords.has(word.toLowerCase())) {
                        const contextParts = [];
                        if (turnIndex > 0) {
                            const precedingTurn = stateRef.lessonPlan.dialogue[turnIndex - 1];
                            if (precedingTurn && precedingTurn.line && precedingTurn.line.display) {
                                contextParts.push(removeParentheses(precedingTurn.line.display));
                            }
                        }
                        contextParts.push(cleanText);
                        if (turnIndex < stateRef.lessonPlan.dialogue.length - 1) {
                            const followingTurn = stateRef.lessonPlan.dialogue[turnIndex + 1];
                            if (followingTurn && followingTurn.line && followingTurn.line.display) {
                                contextParts.push(removeParentheses(followingTurn.line.display));
                            }
                        }
                        vocabulary.push({ word, translation: translationClean, context: contextParts.join(' ... ') });
                        seenWords.add(word.toLowerCase());
                    }
                }
            }
        });
        return vocabulary.slice(0, 10);
    }
}

function extractTranslation(text) {
    const match = text.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
}

async function generateVocabularyTranslations(vocabulary, targetLanguage) {
    const nativeLangCode = stateRef.nativeLang || 'en';
    const langCodeToName = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'
    };
    const nativeLangName = langCodeToName[nativeLangCode] || 'English';

    if (nativeLangName === 'English') {
        return vocabulary;
    }

    try {
        const vocabList = vocabulary.map(v => v.word).join(', ');
        const prompt = `
You are a vocabulary translator. Your task is to translate words from ${targetLanguage} into ${nativeLangName}.
Please translate each of the following words/phrases from ${targetLanguage} into ${nativeLangName}.
Return ONLY a JSON array with objects containing "word" (original word) and "translation" (translation in ${nativeLangName}).
Words to translate: ${vocabList}
Example format:
[
  {"word": "originalWord1", "translation": "translationInNativeLanguage1"},
  {"word": "originalWord2", "translation": "translationInNativeLanguage2"}
]
IMPORTANT: Return ONLY the JSON array, no other text.`;

        const data = await apiRef.callGeminiAPI(prompt);
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const translations = JSON.parse(jsonString);

        return vocabulary.map(vocabItem => {
            const translationItem = translations.find(t => t.word === vocabItem.word);
            return {
                ...vocabItem,
                nativeTranslation: translationItem ? translationItem.translation : vocabItem.translation
            };
        });
    } catch (error) {
        console.error('Failed to generate native language translations:', error);
        return vocabulary;
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
                <h3 class="text-2xl font-bold text-purple-300 mb-4">${uiRef.translateText('quizComplete')}</h3>
                <div class="text-6xl mb-4">${percentage >= 80 ? '🎉' : '📚'}</div>
                <p class="text-xl text-white mb-4">${uiRef.translateText('yourScore')}: ${score}/${shuffledVocab.length} (${percentage}%)</p>
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
        const correctAnswer = currentVocab.nativeTranslation || currentVocab.translation;

        const allTranslations = shuffledVocab
            .map(v => v.nativeTranslation || v.translation)
            .filter(t => t !== correctAnswer);

        let wrongAnswers = [];
        if (allTranslations.length >= 3) {
            wrongAnswers = allTranslations
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);
        } else {
            wrongAnswers = [...allTranslations];
            const genericWrongAnswers = getGenericWrongAnswers(language, stateRef.nativeLang);
            const neededAnswers = 3 - wrongAnswers.length;

            for (let i = 0; i < neededAnswers && i < genericWrongAnswers.length; i++) {
                if (!wrongAnswers.includes(genericWrongAnswers[i]) && genericWrongAnswers[i] !== correctAnswer) {
                    wrongAnswers.push(genericWrongAnswers[i]);
                }
            }
        }

        const allOptions = [correctAnswer, ...wrongAnswers.slice(0, 3)]
            .sort(() => 0.5 - Math.random());

        const cleanContext = removeParentheses(currentVocab.context);

        quizModal.innerHTML = `
            <div class="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto glassmorphism relative">
                 <button id="close-quiz-btn" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
                <div class="text-center mb-6">
                    <h3 class="text-xl font-bold text-purple-300 mb-2">${uiRef.translateText('vocabularyQuiz')}</h3>
                    <div class="text-sm text-gray-400">
                        ${uiRef.translateText('question') || 'Question'} ${currentQuestion + 1} ${uiRef.translateText('of') || 'of'} ${shuffledVocab.length}
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div class="bg-purple-600 h-2 rounded-full transition-all duration-300"
                             style="width: ${((currentQuestion) / shuffledVocab.length) * 100}%"></div>
                    </div>
                </div>
                <div class="text-center mb-6">
                    <p class="text-gray-300 text-sm mb-2">${uiRef.translateText('whatDoesThisMean') || 'What does this mean?'}</p>
                    <div class="text-3xl font-bold text-white mb-2">${currentVocab.word}</div>
                    <div class="text-sm text-gray-400 italic">"${cleanContext}"</div>
                </div>
                <div class="grid grid-cols-1 gap-3 mb-6">
                    ${allOptions.map((option, index) => `<button class="quiz-option w-full p-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-left" data-answer="${option}">${String.fromCharCode(65 + index)}. ${option}</button>`).join('')}
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-400">
                        ${uiRef.translateText('score') || 'Score'}: ${score}/${currentQuestion}
                    </div>
                </div>
            </div>`;

        quizModal.querySelectorAll('.quiz-option').forEach(option => {
            option.onclick = () => {
                const selectedAnswer = option.dataset.answer;
                const isCorrect = selectedAnswer === correctAnswer;

                quizModal.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.classList.remove('hover:bg-gray-600');
                    opt.disabled = true;

                    if (opt.dataset.answer === correctAnswer) {
                        opt.classList.remove('bg-gray-700');
                        opt.classList.add('bg-green-600');
                    } else if (opt === option && !isCorrect) {
                        opt.classList.remove('bg-gray-700');
                        opt.classList.add('bg-red-600');
                    }
                });

                if (isCorrect) {
                    score++;
                }

                setTimeout(() => {
                    currentQuestion++;
                    updateQuizContent();
                }, 1500);
            };
        });
        document.getElementById('close-quiz-btn').onclick = () => quizModal.remove();
    }
    updateQuizContent();
}

function getGenericWrongAnswers(targetLanguage, nativeLangCode) {
    const wrongAnswersByNative = {
        'en': ['apple', 'house', 'water', 'happy', 'run', 'beautiful', 'money', 'time'],
        'es': ['manzana', 'casa', 'agua', 'feliz', 'correr', 'hermoso', 'dinero', 'tiempo'],
        'fr': ['pomme', 'maison', 'eau', 'heureux', 'courir', 'beau', 'argent', 'temps'],
        'de': ['Apfel', 'Haus', 'Wasser', 'glücklich', 'laufen', 'schön', 'Geld', 'Zeit'],
        'it': ['mela', 'casa', 'acqua', 'felice', 'correre', 'bello', 'soldi', 'tempo'],
        'ja': ['りんご', '家', '水', '嬉しい', '走る', '美しい', 'お金', '時間'],
        'ko': ['사과', '집', '물', '행복한', '달리다', '아름다운', '돈', '시간'],
        'zh': ['苹果', '房子', '水', '快乐', '跑步', '美丽', '钱', '时间']
    };

    return wrongAnswersByNative[nativeLangCode] || wrongAnswersByNative['en'];
}

export async function reviewLesson(lessonRecord) {
    const plan = lessonRecord.lessonPlan;
    if (!plan.id) {
        plan.id = `lesson-${lessonRecord.language}-${Date.now()}`;
    }

    plan.isReviewMode = true;
    plan.isCompleted = true;

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

    uiRef.highlightActiveLine(0);
    uiRef.updateMicStatus('reviewModeReady');
    uiRef.enableMicButton(false);

    if (saveStateRef) saveStateRef();
}

export async function playLineAudio(text, party = 'B') {
    stateRef.resetAudioController();

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

        stateRef.audioPlayer.load();
        await stateRef.audioPlayer.play();

    } catch (error) {
        console.error("Failed to fetch audio for manual playback:", error);
        showToast("Error playing audio.", "error");
    }
}

export function playLineAudioDebounced(text, party = 'B') {
    if (audioDebounceTimer) {
        clearTimeout(audioDebounceTimer);
    }
    if (stateRef.audioPlayer && !stateRef.audioPlayer.paused) {
        stateRef.audioPlayer.pause();
        stateRef.audioPlayer.currentTime = 0;
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

    if (stateRef.lessonPlan.isReviewMode) {
        delete stateRef.lessonPlan.isReviewMode;
    }

    advanceTurn(0);
}

export async function preprocessLessonPlan(plan) {
    if (plan && plan.dialogue) {
        for (const turn of plan.dialogue) {
            if (turn.party && turn.party.toUpperCase() === 'A' && (!turn.sentences || turn.sentences.length === 0)) {
                const cleanText = removeParentheses(turn.line.display);
                turn.sentences = await splitIntoSentences(cleanText);
            }
        }
    }
    return plan;
}
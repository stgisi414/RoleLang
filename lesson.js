import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let domElements = {};
let stateRef = {};
let apiRef = {};
let uiRef = {};

// Speech recognition and audio state
let currentSentences = [];
let currentSentenceIndex = 0;
let speechAttempts = 0;
let currentAudio = null;
let audioDebounceTimer = null;
let isAudioPlaying = false;

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

function getRandomNames(language, count = 5) {
    // Access the global characterNames object from names.js
    const namesByLanguage = window.characterNames;

    if (!namesByLanguage) {
        console.warn('Character names not loaded yet. Using fallback names.');
        return [
            ["John", "Smith"], ["Jane", "Doe"], ["Mike", "Johnson"], 
            ["Sarah", "Williams"], ["David", "Brown"]
        ].slice(0, count);
    }

    if (!namesByLanguage[language]) {
        console.warn(`Names not found for language: ${language}. Falling back to English.`);
        language = 'English';
    }

    const langNames = namesByLanguage[language];
    // Combine male and female names
    const allNames = [...langNames.female, ...langNames.male];

    // Shuffle and return the requested number of names
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
    
    // Clear UI elements
    if (domElements.loadingSpinner) domElements.loadingSpinner.classList.remove('hidden');
    if (domElements.conversationContainer) domElements.conversationContainer.innerHTML = '';
    if (domElements.illustrationImg) domElements.illustrationImg.classList.add('hidden');
    if (domElements.illustrationPlaceholder) domElements.illustrationPlaceholder.classList.remove('hidden');
    if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');

    const prompt = createGeminiPrompt(language, topic, stateRef.getNativeLang());
    
    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'pro' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const plan = JSON.parse(jsonString);
        
        if (!plan.id) plan.id = `lesson-<span class="math-inline">\{language\}\-</span>{Date.now()}`;
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
        uiRef.stopTopicRotations();
        if (domElements.landingScreen) domElements.landingScreen.classList.add('hidden');
        if (domElements.lessonScreen) domElements.lessonScreen.classList.remove('hidden');

        startConversation();
        
        // Show overlay and pre-fetch first audio
        const overlayButton = document.getElementById('confirm-start-lesson-btn');
        if (overlayButton) {
            overlayButton.disabled = true;
            document.getElementById('start-lesson-overlay')?.classList.remove('hidden');
        }

        // Wait for both image and audio
        const illustrationPromise = fetchAndDisplayIllustration(plan.illustration_prompt);
        const audioPromise = preFetchFirstAudio(plan.dialogue[0]);

        await Promise.all([illustrationPromise, audioPromise]);
        
        if (overlayButton) overlayButton.disabled = false;
        
        stateRef.save();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
        if (domElements.landingScreen) domElements.landingScreen.classList.remove('hidden');
        if (domElements.lessonScreen) domElements.lessonScreen.classList.add('hidden');
    }
}

export function startConversation() {
    stateRef.setCurrentTurnIndex(0);
    uiRef.restoreConversation(stateRef.lessonPlan);
    uiRef.displayLessonTitleAndContext(stateRef.lessonPlan);
    addBackToLandingButton();
}

export async function advanceTurn(newTurnIndex) {
    stateRef.setCurrentTurnIndex(newTurnIndex);
    stateRef.save();

    const { lessonPlan, currentTurnIndex } = stateRef;
    
    if (!lessonPlan || !lessonPlan.dialogue) {
        console.error('Invalid lesson plan structure detected');
        return;
    }

    if (currentTurnIndex >= lessonPlan.dialogue.length) {
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        lessonPlan.isCompleted = true;
        saveLessonToHistory(lessonPlan, domElements.languageSelect.value, domElements.topicInput.value);
        uiRef.showReviewModeUI(domElements.languageSelect.value, lessonPlan);
        return;
    }

    const currentTurnData = lessonPlan.dialogue[currentTurnIndex];

    // Clear previous highlights
    document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
    
    const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
    if (currentLineEl) {
        currentLineEl.classList.add('active');
        currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (currentTurnData.party === 'A') { // User's turn
        const cleanText = removeParentheses(currentTurnData.line.display);
        currentSentences = await splitIntoSentences(cleanText);
        currentSentenceIndex = 0;
        
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('listenFirst');
        
        try {
            const audioBlob = await fetchPartnerAudio(cleanText, 'A');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                enableUserMicForSentence();
            };
            
            audio.onerror = () => {
                console.error("Audio playback error for user line.");
                URL.revokeObjectURL(audioUrl);
                enableUserMicForSentence();
            };
        } catch (error) {
            console.error("Failed to fetch user audio:", error);
            enableUserMicForSentence();
        }
    } else { // Partner's turn
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('partnerSpeaking');
        
        try {
            const cleanText = removeParentheses(currentTurnData.line.display);
            const audioBlob = await fetchPartnerAudio(cleanText, 'B');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioFinished');
                setTimeout(() => {
                    advanceTurn(currentTurnIndex + 1);
                }, 500);
            };
            
            audio.onerror = () => {
                console.error("Audio playback error for partner line.");
                URL.revokeObjectURL(audioUrl);
                setTimeout(() => {
                    advanceTurn(currentTurnIndex + 1);
                }, 500);
            };
        } catch (error) {
            console.error("Failed to fetch partner audio:", error);
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioUnavailable');
            setTimeout(() => {
                advanceTurn(currentTurnIndex + 1);
            }, 1500);
        }
    }
}

export async function fetchAndDisplayIllustration(prompt) {
    return new Promise(async (resolve) => {
        try {
            if (domElements.illustrationPlaceholder) domElements.illustrationPlaceholder.classList.add('hidden');
            if (domElements.imageLoader) domElements.imageLoader.classList.remove('hidden');

            const result = await apiRef.generateImage(`${prompt}, digital art, minimalist, educational illustration`, {
                imageSize: 'square_hd',
                numInferenceSteps: 50,
                guidanceScale: 10
            });

            if (result.imageUrl) {
                if (stateRef.lessonPlan) {
                    stateRef.lessonPlan.illustration_url = result.imageUrl;
                    stateRef.save();
                }
                
                if (domElements.illustrationImg) {
                    domElements.illustrationImg.src = result.imageUrl;
                    domElements.illustrationImg.onload = () => {
                        if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');
                        domElements.illustrationImg.classList.remove('hidden');
                        resolve();
                    };
                    domElements.illustrationImg.onerror = () => {
                        showFallbackIllustration();
                        resolve(); // Always resolve, don't block lesson
                    };
                }
            } else {
                throw new Error("No image URL returned from API.");
            }
        } catch (error) {
            console.error("Failed to fetch illustration:", error);
            showFallbackIllustration();
            resolve(); // Always resolve, don't block lesson
        }
    });
}

function showFallbackIllustration() {
    if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');
    if (domElements.illustrationPlaceholder) {
        domElements.illustrationPlaceholder.innerHTML = `
            <div class="text-center text-gray-400">
                <i class="fas fa-comments text-6xl mb-4"></i>
                <p class="text-lg"><span class="math-inline">\{uiRef\.translateText\('roleplayScenario'\)\}</p\>
<p class\="text\-sm mt\-2"\></span>{uiRef.translateText('imageUnavailable')}</p>
            </div>
        `;
        domElements.illustrationPlaceholder.classList.remove('hidden');
    }
}

async function preFetchFirstAudio(firstTurn) {
    return new Promise(async (resolve) => {
        if (!firstTurn) {
            stateRef.preFetchedFirstAudioBlob = null;
            return resolve();
        }
        try {
            stateRef.preFetchedFirstAudioBlob = await fetchPartnerAudio(removeParentheses(firstTurn.line.display), firstTurn.party);
            resolve();
        } catch (error) {
            console.error("Failed to pre-fetch audio:", error);
            stateRef.preFetchedFirstAudioBlob = null;
            resolve(); // Always resolve, don't block lesson
        }
    });
}

async function fetchPartnerAudio(text, party = 'B') {
    const currentLanguage = domElements.languageSelect?.value || 'English';
    const voiceConfig = getVoiceConfig(currentLanguage, party);
    const cleanText = removeParentheses(text);
    
    console.log('TTS API - Input text:', text);
    console.log('TTS API - Cleaned text being sent:', cleanText);

    return await apiRef.fetchPartnerAudio(cleanText, voiceConfig);
}

export async function playLineAudioDebounced(text, party = 'B') {
    if (audioDebounceTimer) {
        clearTimeout(audioDebounceTimer);
    }

    if (stateRef.audioPlayer && !stateRef.audioPlayer.paused) {
        stateRef.audioPlayer.pause();
    }

    audioDebounceTimer = setTimeout(() => {
        playLineAudio(text, party);
        audioDebounceTimer = null;
    }, 300);
}

async function playLineAudio(text, party = 'B') {
    stateRef.audioController.abort();
    stateRef.audioController = new AbortController();

    try {
        const cleanText = removeParentheses(text);
        const audioBlob = await fetchPartnerAudio(cleanText, party);
        const audioUrl = URL.createObjectURL(audioBlob);

        if (stateRef.audioPlayer.src) {
            URL.revokeObjectURL(stateRef.audioPlayer.src);
        }
        stateRef.audioPlayer.src = audioUrl;
        stateRef.audioPlayer.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
        stateRef.audioPlayer.load();
        await stateRef.audioPlayer.play();
    } catch (error) {
        console.error("Failed to fetch audio for playback:", error);
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
    const randomNames = getRandomNames(language, 5);
    const nameExamples = randomNames.map(name => `"${name[0]} ${name[1]}"`).join(', ');

    const isEnglish = language === 'English';
    const translationInstruction = isEnglish
        ? "The 'display' text should not contain any parenthetical translations."
        : `The 'display' text MUST include a brief, parenthetical ${nativeLangName} translation.`;

    let lineObjectStructure = `
        - "display": The line of dialogue in ${language}. ${translationInstruction}
        - "clean_text": The line of dialogue in ${language} WITHOUT any parenthetical translations. THIS IS FOR SPEECH RECOGNITION.`;

    if (language === 'Japanese') {
        lineObjectStructure += `
        - "hiragana": A pure hiragana version of "clean_text".`;
    }

    return `
You are a language tutor creating a lesson for a web application. Your task is to generate a single, complete, structured lesson plan in JSON format. Do not output any text or explanation outside of the single JSON object.

The user wants to learn: **<span class="math-inline">\{language\}\*\*
The user's native language is\: \*\*</span>{nativeLangName}**
The user-provided topic for the roleplay is: **"${topic}"**

Follow these steps precisely:

**STEP 1: Understand the Topic**
The user's topic above might not be in English. First, internally translate this topic to English to ensure you understand the user's intent. Do not show this translation in your output.

**STEP 2: Generate the JSON Lesson Plan**
Now, using your English understanding of the topic, create the lesson plan. The entire generated output must be only the JSON object.

**JSON STRUCTURE REQUIREMENTS:**

1. **Top-Level Keys:** The JSON object must contain these keys: "title", "background_context", "scenario", "language", "illustration_prompt", "dialogue".

2. **Title:** A catchy, descriptive title for the lesson in ${nativeLangName} that captures the essence of the scenario.

3. **Background Context:** A brief paragraph in ${nativeLangName} explaining the context and setting of the roleplay scenario.

4. **Dialogue Object:** Each object in the "dialogue" array must contain:
   - "party": "A" (the user) or "B" (the partner).
   - "line": An object containing the text for the dialogue.
   - "explanation" (optional): An object with a "title" and "body" for grammar tips in ${nativeLangName}.

5. **Line Object:** The "line" object must contain these exact fields:
   ${lineObjectStructure}

6. **Character Names:** You MUST use realistic, culturally-appropriate names for the characters. Here are some good examples for ${language}: ${nameExamples}. Choose from these or similar culturally appropriate names for ${language}. Use both first and last names.

7. **NO PLACEHOLDERS:** Under no circumstances should you use placeholders like "[USER NAME]", "(YOUR NAME)", "<NAME>", or any similar variants.

8. **ILLUSTRATION PROMPT:** The "illustration_prompt" should be a brief, descriptive text in English to generate an appropriate illustration for the scenario.

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

export async function verifyUserSpeech(spokenText) {
    try {
        speechAttempts++;
        const currentLanguage = domElements.languageSelect?.value || 'English';
        const currentTurnData = stateRef.lessonPlan.dialogue[stateRef.currentTurnIndex];

        if (currentLanguage === 'Japanese' || currentLanguage === 'Korean' || currentLanguage === 'Chinese') {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('verifyingWithAI');

            const nativeLangCode = stateRef.getNativeLang() || 'en';
            const langCodeToName = {
                'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'
            };
            const nativeLangName = langCodeToName[nativeLangCode] || 'English';

            let expectedLine;
            if (currentSentences.length > 1) {
                expectedLine = currentSentences[currentSentenceIndex];
            } else {
                expectedLine = currentTurnData.line.clean_text;
            }

            const verificationPrompt = `
You are a language evaluation tool. The user's native language is <span class="math-inline">\{nativeLangName\}\.
Your task is to determine if a student's spoken text is a correct phonetic match for a given sentence, ignoring punctuation and spacing\.
IMPORTANT CONSIDERATIONS FOR CHINESE\:
\- Chinese speech recognition often struggles with technical terms, English words, and mixed content
\- Browser speech recognition for Chinese has significant limitations with tones and pronunciation variations
\- Focus heavily on overall meaning and context rather than exact character matching
\- Be very lenient with technical vocabulary
\- If the spoken text contains any key concepts from the expected sentence, consider it a match
\- Accept partial matches if core vocabulary is present, even if grammar or word order differs
\- If more than 50% of the core meaning is captured, consider it a successful attempt
Your response MUST be a simple JSON object with two fields\:
1\. "is\_match"\: a boolean \(true or false\)\. For Chinese, be VERY generous with this assessment\.
2\. "feedback"\: A brief, encouraging explanation in the user's native language \(</span>{nativeLangName}).

Here is the information for your evaluation:
- The student was expected to say: "<span class="math-inline">\{expectedLine\}"
\- The student's speech recognition produced\: "</span>{spokenText}"

Now, provide the JSON response.`;

            const data = await apiRef.callGeminiAPI(verificationPrompt, { modelPreference: 'super' });
            const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const result = JSON.parse(jsonString);

            if (result.is_match) {
                speechAttempts = 0;
                handleCorrectSpeech();
            } else {
                const feedback = result.feedback || uiRef.translateText('tryAgain');
                if (domElements.micStatus) domElements.micStatus.innerHTML = feedback;

                if (currentLanguage === 'Chinese' && speechAttempts >= 3) {
                    const skipBtn = document.createElement('button');
                    skipBtn.className = 'ml-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm';
                    skipBtn.textContent = uiRef.translateText('skip') || '跳过 (Skip)';
                    skipBtn.onclick = () => {
                        speechAttempts = 0;
                        skipBtn.remove();
                        handleCorrectSpeech();
                    };
                    if (domElements.micStatus) {
                        domElements.micStatus.appendChild(document.createElement('br'));
                        domElements.micStatus.appendChild(skipBtn);
                    }
                }

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
                        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('tryAgainStatus');
                    }
                    if (currentLineEl) currentLineEl.style.borderColor = '';
                }, 4000);
            }
        } else {
            // Western languages logic
            let requiredText;
            if (currentSentences.length > 1) {
                requiredText = currentSentences[currentSentenceIndex] || '';
            } else {
                requiredText = currentTurnData.line.clean_text;
            }

            const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;:"'`´''""。！？]/g, '').replace(/\s+/g, ' ');
            const normalizedSpoken = normalize(spokenText);
            const normalizedRequired = normalize(requiredText);

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
        if (domElements.micStatus) domElements.micStatus.textContent = 'A critical error occurred. Please reset the lesson.';
        if (domElements.micBtn) domElements.micBtn.disabled = true;
    }
}

function handleCorrectSpeech() {
    speechAttempts = 0;

    if (currentSentences.length > 1 && (currentSentenceIndex < currentSentences.length - 1)) {
        currentSentenceIndex++;
        const sentenceCorrectText = uiRef.translateText('sentenceCorrect') || 'Correct! Next sentence...';
        if (domElements.micStatus) domElements.micStatus.textContent = sentenceCorrectText;
        setTimeout(() => {
            enableUserMicForSentence();
        }, 1500);
    } else {
        const correctText = (currentSentences.length > 1) 
            ? uiRef.translateText('allSentencesCorrect')
            : uiRef.translateText('correct');

        if (domElements.micStatus) domElements.micStatus.textContent = correctText;
        const currentLineEl = document.getElementById(`turn-${stateRef.currentTurnIndex}`);
        if (currentLineEl) currentLineEl.style.borderColor = '#4ade80';
        if (domElements.micBtn) domElements.micBtn.disabled = true;

        const nextTurnIndex = stateRef.currentTurnIndex + 1;
        setTimeout(() => {
            advanceTurn(nextTurnIndex);
        }, 2000);
    }
}

function handleIncorrectSpeech(similarity, normalizedRequired, normalizedSpoken) {
    console.log('Speech recognition debug:');
    console.log('Required:', normalizedRequired);
    console.log('Spoken:', normalizedSpoken);
    console.log('Similarity:', (similarity * 100).toFixed(1) + '%');

    const sentenceInfo = currentSentences.length > 1 ?
        ` (Sentence ${currentSentenceIndex + 1}/${currentSentences.length})` : '';

    if (domElements.micStatus) {
        domElements.micStatus.textContent = uiRef.translateText('tryAgain') + ` (${(similarity * 100).toFixed(0)}% match)${sentenceInfo}`;
    }

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
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('tryAgainStatus');
        }
        if (currentLineEl) currentLineEl.style.borderColor = '';
    }, 4000);
}

function enableUserMicForSentence() {
    if (domElements.micBtn) domElements.micBtn.disabled = false;

    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));

    if (currentSentences.length > 1) {
        const currentSentenceEl = document.getElementById(`turn-${stateRef.currentTurnIndex}-sentence-${currentSentenceIndex}`);
        if (currentSentenceEl) {
            currentSentenceEl.classList.add('active-sentence');
        }

        const displaySentence = currentSentenceEl ? currentSentenceEl.textContent : currentSentences[currentSentenceIndex];
        const recordSentenceText = uiRef.translateText('recordSentence') || 'Record sentence';
        if (domElements.micStatus) {
            domElements.micStatus.innerHTML = `<strong>${recordSentenceText} ${currentSentenceIndex + 1}/${currentSentences.length}:</strong><br><span style="color: #38bdf8; font-weight: bold; text-decoration: underline;">"${displaySentence}"</span>`;
        }
    } else {
        const singleSentenceEl =
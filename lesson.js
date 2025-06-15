import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

let domElements = {};
let stateRef = {};
let apiRef = {};
let uiRef = {};
let saveStateRef; // <-- Add a reference for the save function

// Speech recognition and audio state
let currentSentences = [];
let currentSentenceIndex = 0;
let speechAttempts = 0;
let currentAudio = null;
let audioDebounceTimer = null;
let isAudioPlaying = false;

// --- Helper Functions ---
function removeParentheses(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

// ... (other helper functions remain the same) ...
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

async function splitIntoSentences(text) {
    const currentLanguage = domElements.languageSelect?.value || 'English';
    const cleanText = text.trim();

    if (cleanText.split(/\s+/).length <= 5) return [cleanText];

    const prompt = `
You are an expert linguist. Your task is to split the following text into natural, speakable chunks for a language learner.
- Split at natural sentence boundaries, conjunctions, or logical pauses.
- Each chunk should be meaningful.
- For Korean/Japanese/Chinese, prioritize splitting at sentence endings and particles.
- Your response MUST be a valid JSON array of strings.
- If the text is longer than 8 words, try to split it into at least 2 chunks.
Language: ${currentLanguage}
Text to Split: "${cleanText}"
Now, provide the JSON array.`;

    try {
        const data = await apiRef.callGeminiAPI(prompt, { modelPreference: 'lite' });
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const sentences = JSON.parse(jsonString);
        if (Array.isArray(sentences) && sentences.every(s => typeof s === 'string' && s.trim().length > 0)) {
            if (sentences.length === 1 && cleanText.split(/\s+/).length > 8) {
                return tryFallbackSplit(cleanText, currentLanguage);
            }
            return sentences;
        }
        return tryFallbackSplit(cleanText, currentLanguage);
    } catch (error) {
        console.error("Gemini sentence splitting failed, using fallback.", error);
        return tryFallbackSplit(cleanText, currentLanguage);
    }
}


function saveLessonToHistory(lessonPlan, selectedLanguage, originalTopic) {
    try {
        let history = uiRef.getLessonHistory();
        const lessonId = lessonPlan.id;
        const existingLessonIndex = history.findIndex(record => record.lessonPlan.id === lessonId);
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

// FIX: Update init to accept the saveState function
export function init(elements, stateModule, apiModule, uiModule, saveFunc) {
    domElements = elements;
    stateRef = stateModule;
    apiRef = apiModule;
    uiRef = uiModule;
    saveStateRef = saveFunc; // <-- Store the reference
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
    const namesByLanguage = window.characterNames;

    if (!namesByLanguage || !namesByLanguage[language]) {
        language = 'English';
    }

    const langNames = namesByLanguage[language];
    const allNames = [...langNames.female, ...langNames.male];
    const shuffled = [...allNames].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export async function initializeLesson() {
    // ... function implementation is correct and remains the same
    if (!domElements.languageSelect || !domElements.topicInput) return;
    
    const language = domElements.languageSelect.value;
    const topic = domElements.topicInput.value;
    if (!topic) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }
    
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
        
        if (!plan.id) plan.id = `lesson-${language}-${Date.now()}`;
        stateRef.setLessonPlan(plan);

        if (stateRef.recognition) stateRef.recognition.lang = getLangCode(language);

        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
        uiRef.stopTopicRotations();
        if (domElements.landingScreen) domElements.landingScreen.classList.add('hidden');
        if (domElements.lessonScreen) domElements.lessonScreen.classList.remove('hidden');

        await startConversation();
        
        const overlayButton = document.getElementById('confirm-start-lesson-btn');
        if (overlayButton) {
            overlayButton.disabled = true;
            document.getElementById('start-lesson-overlay')?.classList.remove('hidden');
        }

        const illustrationPromise = fetchAndDisplayIllustration(plan.illustration_prompt);
        const audioPromise = preFetchFirstAudio(plan.dialogue[0]);

        await Promise.all([illustrationPromise, audioPromise]);
        
        if (overlayButton) overlayButton.disabled = false;
        
        if (saveStateRef) saveStateRef();
    } catch (error) {
        console.error("Failed to initialize lesson:", error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
        if (domElements.loadingSpinner) domElements.loadingSpinner.classList.add('hidden');
        if (domElements.landingScreen) domElements.landingScreen.classList.remove('hidden');
        if (domElements.lessonScreen) domElements.lessonScreen.classList.add('hidden');
    }
}

export async function startConversation() {
    // ... function implementation is correct and remains the same
    stateRef.setCurrentTurnIndex(0);

    if (stateRef.lessonPlan && stateRef.lessonPlan.dialogue) {
        for (const turn of stateRef.lessonPlan.dialogue) {
            if (turn.party === 'A' && (!turn.sentences || turn.sentences.length === 0)) {
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
    // ... function implementation is correct and remains the same
    stateRef.setCurrentTurnIndex(newTurnIndex);
    if (saveStateRef) saveStateRef();

    const { lessonPlan, currentTurnIndex: cti } = stateRef;
    if (!lessonPlan || !lessonPlan.dialogue || cti >= lessonPlan.dialogue.length) {
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        if (domElements.micBtn) domElements.micBtn.disabled = true;
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

    if (currentTurnData.party === 'A') {
        const cleanText = removeParentheses(currentTurnData.line.display);
        
        if (currentTurnData.sentences && currentTurnData.sentences.length > 0) {
            currentSentences = currentTurnData.sentences;
        } else {
            currentSentences = await splitIntoSentences(cleanText);
            currentTurnData.sentences = currentSentences; 
        }
        
        currentSentenceIndex = 0;
        
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('listenFirst');
        
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
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('partnerSpeaking');
        
        try {
            const cleanText = removeParentheses(currentTurnData.line.display);
            const audioBlob = await fetchPartnerAudio(cleanText, 'B');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(domElements.audioSpeedSelect?.value || '1');
            await audio.play();
            
            audio.onended = () => { URL.revokeObjectURL(audioUrl); if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioFinished'); setTimeout(() => advanceTurn(cti + 1), 500); };
            audio.onerror = () => { setTimeout(() => advanceTurn(cti + 1), 500); };
        } catch (error) {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioUnavailable');
            setTimeout(() => advanceTurn(cti + 1), 1500);
        }
    }
}

export async function fetchanddisplayillustration(prompt) {
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
                    // FIX: Called the correct save function reference
                    if (saveStateRef) saveStateRef();
                }
                
                if (domElements.illustrationImg) {
                    domElements.illustrationImg.src = result.imageUrl;
                    domElements.illustrationImg.onload = () => {
                        if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');
                        domElements.illustrationImg.classList.remove('hidden');
                        resolve();
                    };
                    domElements.illustrationImg.onerror = () => {
                        showfallbackillustration();
                        resolve();
                    };
                } else {
                     showfallbackillustration();
                     resolve();
                }
            } else {
                throw new Error("No image URL returned from API.");
            }
        } catch (error) {
            console.error("Failed to fetch illustration:", error);
            showfallbackillustration();
            resolve();
        }
    });
}

function showfallbackillustration() {
    if (domelements.imageloader) domelements.imageloader.classlist.add('hidden');
    if (domelements.illustrationplaceholder) {
        domelements.illustrationplaceholder.innerhtml = `
            <div class="text-center text-gray-400">
                <i class="fas fa-comments text-6xl mb-4"></i>
                <p class="text-lg">${uiref.translatetext('roleplayscenario')}</p>
                <p class="text-sm mt-2">${uiref.translatetext('imageunavailable')}</p>
            </div>
        `;
        domelements.illustrationplaceholder.classlist.remove('hidden');
    }
}

async function prefetchfirstaudio(firstturn) {
    return new promise(async (resolve) => {
        if (!firstturn) {
            stateref.setprefetchedfirstaudioblob(null);
            return resolve();
        }
        try {
            const blob = await fetchpartneraudio(removeparentheses(firstturn.line.display), firstturn.party);
            stateref.setprefetchedfirstaudioblob(blob);
            resolve();
        } catch (error) {
            console.error("failed to pre-fetch audio:", error);
            stateref.setprefetchedfirstaudioblob(null);
            resolve();
        }
    });
}

async function fetchpartneraudio(text, party = 'b') {
    const currentlanguage = domelements.languageselect?.value || 'english';
    const voiceconfig = getvoiceconfig(currentlanguage, party);
    const cleantext = removeparentheses(text);
    return await apiref.fetchpartneraudio(cleantext, voiceconfig);
}

export async function playlineaudiodebounced(text, party = 'b') {
    if (audiodebouncetimer) cleartimeout(audiodebouncetimer);
    if (stateref.audioplayer && !stateref.audioplayer.paused) stateref.audioplayer.pause();
    audiodebouncetimer = settimeout(() => {
        playlineaudio(text, party);
        audiodebouncetimer = null;
    }, 300);
}

async function playlineaudio(text, party = 'b') {
    stateref.audiocontroller.abort();
    stateref.audiocontroller = new abortcontroller();
    try {
        const cleantext = removeparentheses(text);
        const audioblob = await fetchpartneraudio(cleantext, party);
        const audiourl = url.createobjecturl(audioblob);
        if (stateref.audioplayer.src) url.revokeobjecturl(stateref.audioplayer.src);
        stateref.audioplayer.src = audiourl;
        stateref.audioplayer.playbackrate = parsefloat(domelements.audiospeedselect?.value || '1');
        stateref.audioplayer.load();
        await stateref.audioplayer.play();
    } catch (error) {
        console.error("failed to fetch audio for playback:", error);
    }
}

export function debounce(func, wait) {
    let timeout;
    return function executedfunction(...args) {
        const later = () => {
            cleartimeout(timeout);
            func(...args);
        };
        cleartimeout(timeout);
        timeout = settimeout(later, wait);
    };
}

function creategeminiprompt(language, topic, nativelangname) {
    const randomnames = getrandomnames(language, 5);
    const nameexamples = randomnames.map(name => `"${name[0]} ${name[1]}"`).join(', ');
    const isenglish = language === 'english';
    const translationinstruction = isenglish
        ? "the 'display' text should not contain any parenthetical translations."
        : `the 'display' text must include a brief, parenthetical ${nativelangname} translation.`;
    let lineobjectstructure = `
        - "display": the line of dialogue in ${language}. ${translationinstruction}
        - "clean_text": the line of dialogue in ${language} without any parenthetical translations. this is for speech recognition.`;
    if (language === 'japanese') {
        lineobjectstructure += `
        - "hiragana": a pure hiragana version of "clean_text".`;
    }
    return `
you are a language tutor creating a lesson for a web application. your task is to generate a single, complete, structured lesson plan in json format. do not output any text or explanation outside of the single json object.

the user wants to learn: **${language}**
the user's native language is: **${nativelangname}**
the user-provided topic for the roleplay is: **"${topic}"**

follow these steps precisely:

**step 1: understand the topic**
the user's topic above might not be in english. first, internally translate this topic to english to ensure you understand the user's intent. do not show this translation in your output.

**step 2: generate the json lesson plan**
now, using your english understanding of the topic, create the lesson plan. the entire generated output must be only the json object.

**json structure requirements:**

1. **top-level keys:** the json object must contain these keys: "title", "background_context", "scenario", "language", "illustration_prompt", "dialogue".

2. **title:** a catchy, descriptive title for the lesson in ${nativelangname} that captures the essence of the scenario.

3. **background context:** a brief paragraph in ${nativelangname} explaining the context and setting of the roleplay scenario.

4. **dialogue object:** each object in the "dialogue" array must contain:
   - "party": "a" (the user) or "b" (the partner).
   - "line": an object containing the text for the dialogue.
   - "explanation" (optional): an object with a "title" and "body" for grammar tips in ${nativelangname}.

5. **line object:** the "line" object must contain these exact fields:
   ${lineobjectstructure}

6. **character names:** you must use realistic, culturally-appropriate names for the characters. here are some good examples for ${language}: ${nameexamples}. choose from these or similar culturally appropriate names for ${language}. use both first and last names.

7. **no placeholders:** under no circumstances should you use placeholders like "[user name]", "(your name)", "<name>", or any similar variants.

8. **illustration prompt:** the "illustration_prompt" should be a brief, descriptive text in english to generate an appropriate illustration for the scenario.

now, generate the complete json lesson plan.`;
}

export function togglespeechrecognition() {
    if (!stateref.recognition) return;
    if (stateref.isrecognizing) {
        stateref.recognition.stop();
    } else {
        try {
            const selectedlanguage = domelements.languageselect?.value || 'english';
            stateref.recognition.lang = getlangcode(selectedlanguage);
            stateref.recognition.start();
        } catch (error) {
            console.error('speech recognition failed to start:', error);
            if (domelements.micstatus) {
                domelements.micstatus.textcontent = 'speech recognition is not supported for this language in your browser.';
            }
        }
    }
}

export async function verifyuserspeech(spokentext) {
    try {
        speechattempts++;
        const currentlanguage = domelements.languageselect?.value || 'english';
        const currentturndata = stateref.lessonplan.dialogue[stateref.currentturnindex];
        if (currentlanguage === 'japanese' || currentlanguage === 'korean' || currentlanguage === 'chinese') {
            if (domelements.micstatus) domelements.micstatus.textcontent = uiref.translatetext('verifyingwithai');
            const nativelangname = (stateref.gettranslations().langenglish || 'english'); // simplified
            let expectedline = (currentsentences.length > 1) ? currentsentences[currentsentenceindex] : currentturndata.line.clean_text;

            const verificationprompt = `
you are a language evaluation tool. the user's native language is ${nativelangname}.
your task is to determine if a student's spoken text is a correct phonetic match for a given sentence, ignoring punctuation and spacing.
important: for chinese, be very lenient with technical vocabulary and accept partial matches if core concepts are present.
your response must be a simple json object with two fields: "is_match": a boolean, and "feedback": a brief, encouraging explanation in ${nativelangname}.
expected: "${expectedline}"
spoken: "${spokentext}"
provide the json response.`;

            const data = await apiref.callgeminiapi(verificationprompt, { modelpreference: 'super' });
            const jsonstring = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            const result = json.parse(jsonstring);

            if (result.is_match) {
                speechattempts = 0;
                handlecorrectspeech();
            } else {
                const feedback = result.feedback || uiref.translatetext('tryagain');
                if (domelements.micstatus) domelements.micstatus.innerhtml = feedback;

                if (currentlanguage === 'chinese' && speechattempts >= 3) {
                    const skipbtn = document.createelement('button');
                    skipbtn.classname = 'ml-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm';
                    skipbtn.textcontent = uiref.translatetext('skip') || '跳过 (skip)';
                    skipbtn.onclick = () => { speechattempts = 0; skipbtn.remove(); handlecorrectspeech(); };
                    if (domelements.micstatus) {
                        domelements.micstatus.appendchild(document.createelement('br'));
                        domelements.micstatus.appendchild(skipbtn);
                    }
                }
                const currentlineel = document.getelementbyid(`turn-${stateref.currentturnindex}`);
                if (currentlineel) { currentlineel.style.bordercolor = '#f87171'; }
                settimeout(() => {
                    if (currentsentences.length > 1) enableusermicforsentence();
                    else if (domelements.micstatus) domelements.micstatus.textcontent = uiref.translatetext('tryagainstatus');
                    if (currentlineel) currentlineel.style.bordercolor = '';
                }, 4000);
            }
        } else {
            let requiredtext = (currentsentences.length > 1) ? currentsentences[currentsentenceindex] || '' : currentturndata.line.clean_text;
            const normalize = (text) => text.trim().tolowercase().replace(/[.,!?;:"'`´''""。！？]/g, '').replace(/\s+/g, ' ');
            const normalizedspoken = normalize(spokentext);
            const normalizedrequired = normalize(requiredtext);
            const distance = levenshteindistance(normalizedspoken, normalizedrequired);
            const maxlength = math.max(normalizedspoken.length, normalizedrequired.length);
            const similarity = maxlength === 0 ? 1 : 1 - (distance / maxlength);
            if (similarity >= 0.75) { handlecorrectspeech(); }
            else { handleincorrectspeech(similarity, normalizedrequired, normalizedspoken); }
        }
    } catch (error) {
        console.error("critical error in verifyuserspeech:", error);
        if (domelements.micstatus) domelements.micstatus.textcontent = 'a critical error occurred. please reset the lesson.';
        if (domelements.micbtn) domelements.micbtn.disabled = true;
    }
}

function levenshteindistance(str1, str2) {
    const matrix = array(str2.length + 1).fill(null).map(() => array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i++) { matrix[0][i] = i; }
    for (let j = 0; j <= str2.length; j++) { matrix[j][0] = j; }
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = math.min(matrix[j - 1][i] + 1, matrix[j][i - 1] + 1, matrix[j - 1][i - 1] + cost);
        }
    }
    return matrix[str2.length][str1.length];
}

function handlecorrectspeech() {
    speechattempts = 0;
    if (currentsentences.length > 1 && (currentsentenceindex < currentsentences.length - 1)) {
        currentsentenceindex++;
        const sentencecorrecttext = uiref.translatetext('sentencecorrect') || 'correct! next sentence...';
        if (domelements.micstatus) domelements.micstatus.textcontent = sentencecorrecttext;
        settimeout(() => { enableusermicforsentence(); }, 1500);
    } else {
        const correcttext = (currentsentences.length > 1) ? uiref.translatetext('allsentencescorrect') : uiref.translatetext('correct');
        if (domelements.micstatus) domelements.micstatus.textcontent = correcttext;
        const currentlineel = document.getelementbyid(`turn-${stateref.currentturnindex}`);
        if (currentlineel) currentlineel.style.bordercolor = '#4ade80';
        if (domelements.micbtn) domelements.micbtn.disabled = true;
        const nextturnindex = stateref.currentturnindex + 1;
        settimeout(() => { advanceturn(nextturnindex); }, 2000);
    }
}

function handleincorrectspeech(similarity, normalizedrequired, normalizedspoken) {
    const sentenceinfo = currentsentences.length > 1 ? ` (sentence ${currentsentenceindex + 1}/${currentsentences.length})` : '';
    if (domelements.micstatus) domelements.micstatus.textcontent = uiref.translatetext('tryagain') + ` (${(similarity * 100).tofixed(0)}% match)${sentenceinfo}`;
    const currentlineel = document.getelementbyid(`turn-${stateref.currentturnindex}`);
    if (currentlineel) {
        currentlineel.classlist.remove('active');
        void currentlineel.offsetwidth;
        currentlineel.classlist.add('active');
        currentlineel.style.bordercolor = '#f87171';
    }
    settimeout(() => {
        if (currentsentences.length > 1) enableusermicforsentence();
        else if (domelements.micstatus) domelements.micstatus.textcontent = uiref.translatetext('tryagainstatus');
        if (currentlineel) currentlineel.style.bordercolor = '';
    }, 4000);
}

function enableusermicforsentence() {
    if (domelements.micbtn) domelements.micbtn.disabled = false;
    document.queryselectorall('.sentence-span.active-sentence').foreach(el => el.classlist.remove('active-sentence'));
    if (currentsentences.length > 1) {
        const currentsentenceel = document.getelementbyid(`turn-${stateref.currentturnindex}-sentence-${currentsentenceindex}`);
        if (currentsentenceel) currentsentenceel.classlist.add('active-sentence');
        const displaysentence = currentsentenceel ? currentsentenceel.textcontent : currentsentences[currentsentenceindex];
        const recordsentencetext = uiref.translatetext('recordsentence') || 'record sentence';
        if (domelements.micstatus) domelements.micstatus.innerhtml = `<strong>${recordsentencetext} ${currentsentenceindex + 1}/${currentsentences.length}:</strong><br><span style="color: #38bdf8; font-weight: bold; text-decoration: underline;">"${displaysentence}"</span>`;
    } else {
        const singlesentenceel = document.getelementbyid(`turn-${stateref.currentturnindex}-sentence-0`);
        if (singlesentenceel) singlesentenceel.classlist.add('active-sentence');
        const yourturntext = uiref.translatetext('yourturn') || 'your turn';
        const lookforhighlightedtext = uiref.translatetext('lookforhighlighted') || 'look for the highlighted sentence above';
        if (domelements.micstatus) domelements.micstatus.innerhtml = `<strong>${yourturntext}</strong><br><span style="color: #38bdf8; font-style: italic;">${lookforhighlightedtext}</span>`;
    }
}

export function confirmstartlesson() {
    if (!domelements.startlessonoverlay) return;
    domelements.startlessonoverlay.classlist.add('hidden');

    if (stateref.prefetchedfirstaudioblob) {
        const firstturn = stateref.lessonplan.dialogue[0];
        const audiourl = url.createobjecturl(stateref.prefetchedfirstaudioblob);
        const audio = new audio(audiourl);
        audio.playbackrate = parsefloat(domelements.audiospeedselect.value);

        audio.play().catch(e => console.error("error playing pre-fetched audio:", e));

        const firstlineel = document.getelementbyid('turn-0');
        if (firstlineel) {
            firstlineel.classlist.add('active');
            firstlineel.scrollintoview({ behavior: 'smooth', block: 'center' });
        }

        audio.addeventlistener('ended', async () => {
            url.revokeobjecturl(audiourl);

            if (firstturn.party === 'a') {
                const cleantext = removeparentheses(firstturn.line.display);
                currentsentences = await splitintosentences(cleantext);
                currentsentenceindex = 0;
                enableusermicforsentence();
            } else {
                advanceturn(1);
            }
        });
    } else {
        advanceturn(0);
    }
}

export async function reviewLesson(lessonRecord) {
    stateRef.setLessonPlan(lessonRecord.lessonPlan);
    stateRef.setCurrentTurnIndex(0);
    domElements.languageSelect.value = lessonRecord.language;
    domElements.topicInput.value = lessonRecord.topic;
    if (stateRef.recognition) stateRef.recognition.lang = getLangCode(lessonRecord.language);
    domElements.landingScreen.classList.add('hidden');
    domElements.lessonScreen.classList.remove('hidden');
    uiRef.stopTopicRotations();
    if (stateRef.lessonPlan.illustration_url) {
        uiRef.restoreIllustration(stateRef.lessonPlan.illustration_url);
    } else if (stateRef.lessonPlan.illustration_prompt) {
        fetchAndDisplayIllustration(stateRef.lessonPlan.illustration_prompt);
    }
    await startConversation();
    uiRef.showReviewModeUI(lessonRecord.language);
    stateRef.setCurrentTurnIndex(stateRef.lessonPlan.dialogue.length);
    if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
    if (domElements.micBtn) domElements.micBtn.disabled = true;
    
    // FIX: Call the stored saveState function reference
    if (saveStateRef) {
        saveStateRef();
    }
}

export function resetlesson() {
    if (!stateref.lessonplan) return;

    if (stateref.audioplayer && !stateref.audioplayer.paused) {
        stateref.audioplayer.pause();
        stateref.audioplayer.src = "";
    }

    stateref.setcurrentturnindex(0);

    document.queryselectorall('.dialogue-line.active').foreach(el => el.classlist.remove('active'));
    document.queryselectorall('.sentence-span.active-sentence').foreach(el => el.classlist.remove('active-sentence'));

    if (domelements.micbtn) {
        domelements.micbtn.disabled = false;
        domelements.micbtn.classlist.remove('bg-green-600');
        domelements.micbtn.classlist.add('bg-red-600');
    }
    if (domelements.micstatus) domelements.micstatus.textcontent = uiref.translatetext('micstatus');


    if (stateref.isrecognizing && stateref.recognition) {
        stateref.recognition.stop();
    }

    if (uiref.hidereviewmodebanner) {
        uiref.hidereviewmodebanner();
    }

    advanceturn(0);
}

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

export async function fetchAndDisplayIllustration(prompt) {
    if (!domElements.illustrationImg || !domElements.imageLoader || !domElements.illustrationPlaceholder) return;
    
    try {
        domElements.imageLoader.classList.remove('hidden');
        domElements.illustrationPlaceholder.classList.add('hidden');
        
        const result = await api.generateImage(prompt, {
            imageSize: 'square_hd',
            numInferenceSteps: 50,
            guidanceScale: 10
        });
        
        if (result.success && result.imageUrl) {
            domElements.illustrationImg.src = result.imageUrl;
            domElements.illustrationImg.classList.remove('hidden');
            domElements.imageLoader.classList.add('hidden');
            
            // Save the image URL to the lesson plan
            if (state.lessonPlan) {
                state.lessonPlan.illustration_url = result.imageUrl;
                stateRef.save();
            }
        } else {
            throw new Error('Image generation failed');
        }
    } catch (error) {
        console.error('Failed to fetch illustration:', error);
        domElements.imageLoader.classList.add('hidden');
        domElements.illustrationPlaceholder.classList.remove('hidden');
        
        if (domElements.illustrationPlaceholder) {
            domElements.illustrationPlaceholder.innerHTML = `
                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-2"></i>
                <p class="text-yellow-500">${uiRef.translateText('imageUnavailable')}</p>
            `;
        }
    }
}

export async function initializeLesson() {
    const selectedLanguage = domElements.languageSelect?.value;
    const topicInput = domElements.topicInput?.value?.trim();

    if (!selectedLanguage) {
        alert(uiRef.translateText('chooseLanguage'));
        return;
    }

    if (!topicInput) {
        alert(uiRef.translateText('enterTopic'));
        return;
    }

    try {
        domElements.startLessonOverlay?.classList.remove('hidden');
        
        const prompt = `Create a realistic roleplay conversation in ${selectedLanguage} about: ${topicInput}. 
        
        The conversation should:
        1. Have exactly 8-12 exchanges (turns) between two people
        2. Be appropriate for language learning
        3. Include realistic dialogue that native speakers would use
        4. Person A should be the language learner, Person B should be a native speaker
        5. Include natural expressions, common phrases, and cultural context
        
        Format your response as JSON with this exact structure:
        {
          "title": "Brief title for the scenario",
          "background_context": "Brief context about the situation",
          "illustration_prompt": "Detailed prompt for generating an illustration of this scene",
          "dialogue": [
            {
              "party": "A",
              "line": {
                "display": "What the learner says in ${selectedLanguage}",
                "phonetic": "Phonetic pronunciation guide if needed"
              },
              "explanation": {
                "title": "Grammar/Culture Point",
                "body": "Explanation of grammar, cultural context, or key phrases used"
              }
            },
            {
              "party": "B",
              "line": {
                "display": "What the native speaker responds in ${selectedLanguage}",
                "phonetic": "Phonetic pronunciation guide if needed"
              }
            }
          ]
        }`;

        const response = await api.callGeminiAPI(prompt);
        const content = response.candidates[0].content.parts[0].text;
        
        let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        
        const lessonPlan = JSON.parse(jsonMatch[0].replace(/```json|```/g, '').trim());
        
        if (!lessonPlan.dialogue || lessonPlan.dialogue.length === 0) {
            throw new Error('Invalid lesson plan structure');
        }

        state.setLessonPlan(lessonPlan);
        state.setCurrentTurnIndex(0);
        
        // Switch to lesson screen
        domElements.landingScreen?.classList.add('hidden');
        domElements.lessonScreen?.classList.remove('hidden');
        
        // Display lesson content
        uiRef.displayLessonTitleAndContext(lessonPlan);
        await uiRef.restoreConversation(lessonPlan);
        
        // Generate illustration
        if (lessonPlan.illustration_prompt) {
            fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
        }
        
        // Set up speech recognition language
        if (state.recognition) {
            state.recognition.lang = getLangCode(selectedLanguage);
        }
        
        // Start the lesson
        advanceTurn(0);
        
        // Save lesson to history
        saveLessonToHistory(topicInput, selectedLanguage);
        
        uiRef.stopTopicRotations();
        stateRef.save();
        
    } catch (error) {
        console.error('Failed to initialize lesson:', error);
        alert(`${uiRef.translateText('errorLoading')} ${error.message}`);
    } finally {
        domElements.startLessonOverlay?.classList.add('hidden');
    }
}

export function advanceTurn(turnIndex) {
    if (!state.lessonPlan || !state.lessonPlan.dialogue) return;
    
    const dialogue = state.lessonPlan.dialogue;
    if (turnIndex >= dialogue.length) {
        // Lesson complete
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('lessonComplete');
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        state.lessonPlan.isCompleted = true;
        uiRef.showReviewModeUI(domElements.languageSelect?.value, state.lessonPlan);
        stateRef.save();
        return;
    }
    
    const currentTurn = dialogue[turnIndex];
    state.setCurrentTurnIndex(turnIndex);
    
    // Highlight current turn
    document.querySelectorAll('.dialogue-line').forEach(line => line.classList.remove('active'));
    const currentLine = document.getElementById(`turn-${turnIndex}`);
    if (currentLine) {
        currentLine.classList.add('active');
        currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    if (currentTurn.party === 'A') {
        // User's turn
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('yourTurn');
        if (domElements.micBtn) domElements.micBtn.disabled = false;
    } else {
        // Partner's turn - play audio
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('partnerSpeaking');
        if (domElements.micBtn) domElements.micBtn.disabled = true;
        
        playPartnerAudio(currentTurn.line.display, () => {
            // After partner speaks, advance to next turn
            advanceTurn(turnIndex + 1);
        });
    }
    
    stateRef.save();
}

export async function playPartnerAudio(text, callback) {
    try {
        const selectedLanguage = domElements.languageSelect?.value;
        const voiceConfig = getVoiceConfig(selectedLanguage);
        
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('partnerSpeaking');
        
        const audioBlob = await api.fetchPartnerAudio(text, voiceConfig);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        state.audioPlayer.src = audioUrl;
        
        const speed = domElements.audioSpeedSelect ? parseFloat(domElements.audioSpeedSelect.value) : 1.0;
        state.audioPlayer.playbackRate = speed;
        
        state.audioPlayer.onended = () => {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioFinished');
            URL.revokeObjectURL(audioUrl);
            if (callback) callback();
        };
        
        state.audioPlayer.onerror = () => {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioError');
            URL.revokeObjectURL(audioUrl);
            if (callback) callback();
        };
        
        await state.audioPlayer.play();
        
    } catch (error) {
        console.error('Audio playback error:', error);
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('audioUnavailable');
        if (callback) callback();
    }
}

export function getVoiceConfig(language) {
    const voiceConfigs = {
        'English': { voice_id: 'pNInz6obpgDQGcFmaJgB', language_code: 'en' },
        'Spanish': { voice_id: 'VR6AewLTigWG4xSOukaG', language_code: 'es' },
        'French': { voice_id: 'XB0fDUnXU5powFXDhCwa', language_code: 'fr' },
        'German': { voice_id: 'pNInz6obpgDQGcFmaJgB', language_code: 'de' },
        'Italian': { voice_id: 'XB0fDUnXU5powFXDhCwa', language_code: 'it' },
        'Japanese': { voice_id: 'pNInz6obpgDQGcFmaJgB', language_code: 'ja' },
        'Chinese': { voice_id: 'pNInz6obpgDQGcFmaJgB', language_code: 'zh' },
        'Korean': { voice_id: 'pNInz6obpgDQGcFmaJgB', language_code: 'ko' }
    };
    return voiceConfigs[language] || voiceConfigs['English'];
}

export function toggleSpeechRecognition() {
    if (!state.recognition) return;
    
    if (state.isRecognizing) {
        state.recognition.stop();
    } else {
        const selectedLanguage = domElements.languageSelect?.value;
        if (selectedLanguage) {
            state.recognition.lang = getLangCode(selectedLanguage);
        }
        state.recognition.start();
    }
}

export async function verifyUserSpeech(spokenText) {
    if (!state.lessonPlan || !state.lessonPlan.dialogue) return;
    
    const currentTurn = state.lessonPlan.dialogue[state.currentTurnIndex];
    if (!currentTurn || currentTurn.party !== 'A') return;
    
    try {
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('verifyingWithAI');
        
        const prompt = `Compare these two phrases and determine if they mean the same thing:
        Expected: "${currentTurn.line.display}"
        Spoken: "${spokenText}"
        
        Respond with only "CORRECT" if they match in meaning (allow for minor pronunciation differences), or "INCORRECT" if they don't match.`;
        
        const response = await api.callGeminiAPI(prompt);
        const result = response.candidates[0].content.parts[0].text.trim().toUpperCase();
        
        if (result.includes('CORRECT')) {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('correct');
            setTimeout(() => {
                advanceTurn(state.currentTurnIndex + 1);
            }, 1500);
        } else {
            if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('tryAgain');
            setTimeout(() => {
                if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('tryAgainStatus');
            }, 2000);
        }
    } catch (error) {
        console.error('Speech verification error:', error);
        if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('tryAgainStatus');
    }
}

export function resetLesson() {
    state.setLessonPlan(null);
    state.setCurrentTurnIndex(0);
    stateRef.clear();
    
    domElements.lessonScreen?.classList.add('hidden');
    domElements.landingScreen?.classList.remove('hidden');
    
    if (domElements.conversationContainer) domElements.conversationContainer.innerHTML = '';
    if (domElements.illustrationImg) {
        domElements.illustrationImg.classList.add('hidden');
        domElements.illustrationImg.src = '';
    }
    if (domElements.illustrationPlaceholder) {
        domElements.illustrationPlaceholder.classList.remove('hidden');
        domElements.illustrationPlaceholder.innerHTML = `
            <i class="fas fa-image text-4xl mb-2"></i>
            <p data-translate="illustrationPlaceholder">${uiRef.translateText('illustrationPlaceholder')}</p>
        `;
    }
    if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');
    if (domElements.micBtn) domElements.micBtn.disabled = false;
    if (domElements.micStatus) domElements.micStatus.textContent = uiRef.translateText('micStatus');
    
    uiRef.hideReviewModeBanner();
    uiRef.startTopicRotations();
}

export function confirmStartLesson() {
    domElements.startLessonOverlay?.classList.add('hidden');
    initializeLesson();
}

function saveLessonToHistory(topic, language) {
    try {
        const history = JSON.parse(localStorage.getItem('rolelang_lesson_history') || '[]');
        const lesson = {
            topic: topic,
            language: language,
            completedAt: new Date().toLocaleDateString(),
            timestamp: Date.now()
        };
        
        history.push(lesson);
        
        // Keep only the last 100 lessons
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        
        localStorage.setItem('rolelang_lesson_history', JSON.stringify(history));
    } catch (error) {
        console.error('Failed to save lesson to history:', error);
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

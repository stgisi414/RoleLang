// --- Global References ---
let domElements = {};
let getTranslations;
let getNativeLang;
let saveState;
let backToLandingCallback = () => window.location.reload(); // Default fallback

// Add module-level variables for the state setter functions.
let setNativeLang;
let setCurrentTranslations;

// --- Constants ---
const LESSON_HISTORY_KEY = 'rolelang_lesson_history';

// --- Topic Rotation State ---
let topicRotationIntervals = [];
const animationClasses = [
    'topic-animate-in-1', 'topic-animate-in-2', 'topic-animate-in-3', 'topic-animate-in-4',
    'topic-animate-in-5', 'topic-animate-in-6', 'topic-animate-in-7', 'topic-animate-in-8'
];
const exitAnimationClasses = [
    'topic-animate-out', 'topic-animate-out-1', 'topic-animate-out-2', 'topic-animate-out-3'
];


// --- Initialization ---
export function init(elements, translationsFunc, nativeLangFunc, saveFunc, backCb, setNativeLangFunc, setCurrentTranslationsFunc) {
    domElements = elements;
    getTranslations = translationsFunc;
    getNativeLang = nativeLangFunc;
    saveState = saveFunc;
    backToLandingCallback = backCb;
    // Assign the setter functions to the module-level variables.
    setNativeLang = setNativeLangFunc;
    setCurrentTranslations = setCurrentTranslationsFunc;
}

// --- Translation ---
export function translateText(key) {
    const translations = getTranslations();
    if (!translations || typeof translations !== 'object') {
        console.warn('Translations not available for key:', key);
        return `[${key}]`;
    }
    return translations[key] || `[${key}]`;
}

export function updateTranslations() {
    document.title = translateText('title');
    document.querySelectorAll('[data-translate]').forEach(el => {
        el.textContent = translateText(el.getAttribute('data-translate'));
    });
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        el.placeholder = translateText(el.getAttribute('data-translate-placeholder'));
    });
}

// --- Language Management ---
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
    if (domElements.nativeFlagEl) domElements.nativeFlagEl.textContent = flag;
    if (domElements.nativeLangTextEl) domElements.nativeLangTextEl.textContent = name;

    // Use the functions passed via init instead of the fragile window.state
    if (setNativeLang && setCurrentTranslations) {
        setNativeLang(langCode);
        setCurrentTranslations(window.translations[langCode] || window.translations.en);
    } else {
        console.error("UI module has not been initialized with state setters.");
        return; // Guard against race conditions
    }

    // Now that the state is reliably updated, the UI can be translated.
    updateTranslations();
    updateBackButton();

    // Refresh other dynamic elements
    stopTopicRotations();
    startTopicRotations();
    localStorage.setItem('rolelang_native_lang', JSON.stringify({ code: langCode, flag, name }));
    if(typeof saveState === 'function') saveState();
}


function detectNativeLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    const supportedLangs = {
        'en': { code: 'en', flag: '🇺🇸', name: 'English' },
        'es': { code: 'es', flag: '🇪🇸', name: 'Español' },
        'fr': { code: 'fr', flag: '🇫🇷', name: 'Français' },
        'de': { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
        'it': { code: 'it', flag: '🇮🇹', name: 'Italiano' },
        'zh': { code: 'zh', flag: '🇨🇳', name: '中文' },
        'ja': { code: 'ja', flag: '🇯🇵', name: '日본語' },
        'ko': { code: 'ko', flag: '🇰🇷', name: '한국어' }
    };
    const lang = supportedLangs[browserLang] || supportedLangs['en'];
    console.log(`Detected browser language: ${browserLang}, setting to: ${lang.code}`);
    setNativeLanguage(lang.code, lang.flag, lang.name);
}

// --- History Functions ---
export function getLessonHistory() {
    try {
        const history = localStorage.getItem(LESSON_HISTORY_KEY);
        if (!history) return [];
        const parsedHistory = JSON.parse(history);
        const validHistory = parsedHistory.filter(record =>
            record && record.lessonPlan && record.lessonPlan.dialogue &&
            Array.isArray(record.lessonPlan.dialogue) && record.lessonPlan.dialogue.length > 0 &&
            record.language && record.topic && record.id
        );
        if (validHistory.length !== parsedHistory.length) {
            localStorage.setItem(LESSON_HISTORY_KEY, JSON.stringify(validHistory));
        }
        return validHistory;
    } catch (error) {
        console.warn('Failed to load lesson history:', error);
        localStorage.removeItem(LESSON_HISTORY_KEY);
        return [];
    }
}

export function displayLessonHistory() {
    const historyContainer = domElements.historyLessonsContainer;
    if (!historyContainer) return;

    const history = getLessonHistory();
    historyContainer.innerHTML = '';

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center py-8 text-gray-400">
                <i class="fas fa-history text-3xl mb-2"></i>
                <p>${translateText('noCompletedLessons')}</p>
            </div>`;
        return;
    }

    const recentLessons = history.slice(0, 6);
    recentLessons.forEach((lesson, index) => {
        const lessonCard = document.createElement('div');
        lessonCard.className = 'history-card bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-lg p-3 cursor-pointer transition-all';
        lessonCard.dataset.lessonId = lesson.id;

        lessonCard.innerHTML = `
            <div class="text-purple-300 text-xs mb-1">${lesson.language}</div>
            <div class="text-white text-sm font-medium mb-1 line-clamp-2">${lesson.topic}</div>
            <div class="text-gray-400 text-xs">${lesson.completedAt || ''}</div>
        `;

        lessonCard.style.opacity = '0';
        lessonCard.classList.add(`topic-animate-in-${(index % 6) + 1}`);
        historyContainer.appendChild(lessonCard);
    });
}

// --- Visibility & UI Toggles ---
export function toggleLessonsVisibility(forceShow = null) {
    const isHidden = domElements.lessonsContainer.classList.contains('hidden');
    const chevronIcon = domElements.toggleLessonsBtn.querySelector('i');
    const show = forceShow !== null ? forceShow : isHidden;

    if (show) {
        domElements.lessonsContainer.classList.remove('hidden');
        chevronIcon.style.transform = 'rotate(180deg)';
        if (topicRotationIntervals.length === 0) startTopicRotations();
    } else {
        domElements.lessonsContainer.classList.add('hidden');
        chevronIcon.style.transform = 'rotate(0deg)';
        stopTopicRotations();
    }
    if(typeof saveState === 'function') saveState();
}

export function toggleHistoryVisibility() {
    if (!domElements.historyContainer || !domElements.toggleHistoryBtn) return;
    const isHidden = domElements.historyContainer.classList.contains('hidden');
    const chevronIcon = domElements.toggleHistoryBtn.querySelector('i');
    if (isHidden) {
        domElements.historyContainer.classList.remove('hidden');
        chevronIcon.style.transform = 'rotate(180deg)';
        displayLessonHistory();
    } else {
        domElements.historyContainer.classList.add('hidden');
        chevronIcon.style.transform = 'rotate(0deg)';
    }
}

// Add a flag to prevent multiple simultaneous explanation requests
let isExplanationLoading = false;

export async function showExplanation(content) {
    // Prevent multiple simultaneous calls
    if (isExplanationLoading) {
        console.log('Explanation already loading, ignoring duplicate request');
        return;
    }

    // Ensure we have valid content before showing modal
    if (!content || !content.title || !content.body) {
        console.error('Invalid explanation content:', content);
        return;
    }

    // Set loading flag and show loading state
    isExplanationLoading = true;
    
    // Show modal immediately with loading content
    if (domElements.modalBody) {
        domElements.modalBody.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="loader mr-3"></div>
                <span class="text-gray-300">${translateText('loadingExplanation') || 'Loading explanation...'}</span>
            </div>
        `;
    }
    
    if (domElements.modal) {
        domElements.modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    try {
        // Translate the explanation title and body if they're in English but the UI is in another language
        const nativeLang = getNativeLang() || 'en';
        let translatedTitle = content.title;
        let translatedBody = content.body;

    // If the native language is not English, translate the explanation content
    if (nativeLang !== 'en') {
        try {
            const api = await import('./api.js');
            
            // Get the native language name for translation
            const languageNames = {
                'es': 'Spanish',
                'fr': 'French', 
                'de': 'German',
                'it': 'Italian',
                'zh': 'Chinese',
                'ja': 'Japanese',
                'ko': 'Korean'
            };
            const targetLanguageName = languageNames[nativeLang] || 'English';

            // Translate the title and body
            const translatePrompt = `
Translate the following grammar explanation title and content into ${targetLanguageName}. Keep the same meaning and technical accuracy:

Title: "${content.title}"
Content: "${content.body}"

Respond with ONLY the translated content in this exact format:
TITLE: [translated title]
CONTENT: [translated content]

Do not add any other text or explanations.`;

            const translationData = await api.callGeminiAPI(translatePrompt);
            
            if (translationData?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const translationText = translationData.candidates[0].content.parts[0].text.trim();
                
                // Parse the response
                const titleMatch = translationText.match(/TITLE:\s*(.+?)(?=\nCONTENT:)/s);
                const contentMatch = translationText.match(/CONTENT:\s*(.+)$/s);
                
                if (titleMatch && contentMatch) {
                    translatedTitle = titleMatch[1].trim();
                    translatedBody = contentMatch[1].trim();
                }
            }
        } catch (error) {
            console.error('Failed to translate explanation:', error);
            // Fall back to original content if translation fails
        }
    }

    // Parse the explanation content for audio-tagged phrases
    const { processedBody, audioItems } = await parseAndRenderExplanationWithAudio({ 
        title: translatedTitle, 
        body: translatedBody 
    });

    // Create the modal content with explanation text and YouTube video option
    if (domElements.modalBody) {
        domElements.modalBody.innerHTML = `
            <h3 class="text-xl font-bold mb-2 text-cyan-300">${translatedTitle}</h3>
            ${content.originalSentence ? `<div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 mb-4">
                <p class="text-blue-300 font-bold" style="font-size: 14px !important; line-height: 1.4;">${content.originalSentence}</p>
            </div>` : ''}
            <p class="text-gray-300 mb-4">${processedBody}</p>
            <div class="border-t border-gray-600 pt-6 mt-6">
                <div class="text-center mb-4">
                    <h4 class="text-lg font-semibold text-cyan-300 mb-3">
                        <i class="fas fa-play text-red-500 mr-2"></i>
                        ${translateText('relatedEducationalVideo')}
                    </h4>
                    <button id="youtube-play-btn" class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center font-semibold">
                        <i class="fab fa-youtube mr-2"></i>
                        ${translateText('loadVideo')}
                    </button>
                </div>
                <div id="youtube-container" class="mt-6">
                    <div id="youtube-loader" class="flex items-center justify-center py-8 hidden">
                        <div class="loader"></div>
                        <span class="ml-3 text-gray-400">${translateText('loadingVideo')}</span>
                    </div>
                    <div id="video-content" class="hidden">
                        <iframe 
                            id="youtube-iframe" 
                            class="w-full h-80 rounded-lg shadow-lg"
                            frameborder="0" 
                            allowfullscreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            src="">
                        </iframe>
                    </div>
                </div>
            </div>
        `;
    }

    } catch (error) {
        console.error('Error loading explanation:', error);
        
        // Show error state in modal
        if (domElements.modalBody) {
            domElements.modalBody.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 text-4xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold mb-2 text-red-400">${translateText('errorLoadingExplanation') || 'Error Loading Explanation'}</h3>
                    <p class="text-gray-300 mb-4">${translateText('explanationLoadFailed') || 'Failed to load explanation. Please try again.'}</p>
                    <button class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg" onclick="document.getElementById('explanation-modal').classList.add('hidden'); document.body.classList.remove('modal-open');">
                        ${translateText('close') || 'Close'}
                    </button>
                </div>
            `;
        }
        showToast('Failed to load explanation', 'error');
    } finally {
        // Always clear the loading flag
        isExplanationLoading = false;
    }

    // Add modal close handler to stop video playback and audio
    const handleModalClose = () => {
        const iframe = document.getElementById('youtube-iframe');
        if (iframe && iframe.src) {
            // Stop video by clearing and resetting the src
            const currentSrc = iframe.src;
            iframe.src = '';
            // Optional: Reset to original src if needed for future use
            setTimeout(() => {
                if (iframe) iframe.src = currentSrc;
            }, 100);
        }
        
        // Stop any ongoing audio playback from dialogue lines
        const state = window.state || await import('./state.js');
        if (state.audioPlayer && !state.audioPlayer.paused) {
            state.audioPlayer.pause();
            state.audioPlayer.currentTime = 0;
        }
        
        document.body.classList.remove('modal-open'); // Unlock body scroll
    };

    // Store the close handler for cleanup
    domElements.modal._closeHandler = handleModalClose;

    // Add click event listener to the YouTube play button
    const playBtn = document.getElementById('youtube-play-btn');
    if (playBtn) {
        playBtn.onclick = () => {
            // Hide the button and show loader
            playBtn.classList.add('hidden');
            document.getElementById('youtube-loader').classList.remove('hidden');

            // Search for and load YouTube video
            searchAndLoadYouTubeVideo(content.title);
        };
    }

    // Add click event listeners for audio phrases
    const audioPhrases = domElements.modalBody.querySelectorAll('.audio-phrase');
    audioPhrases.forEach(phraseElement => {
        phraseElement.addEventListener('click', async () => {
            const phrase = phraseElement.getAttribute('data-phrase');
            await playPhraseAudio(phrase);
        });
    });
}

async function playPhraseAudio(phrase) {
    try {
        const targetLanguage = domElements.languageSelect?.value || 'English';
        showToast(`${translateText('playingPhrase')}: "${phrase}"`, 'info');

        // Import lesson module to get voice config
        const lesson = await import('./lesson.js');
        const api = await import('./api.js');

        // Get appropriate voice config for the target language
        const voiceConfig = getVoiceConfigForLanguage(targetLanguage);

        // Fetch and play audio
        const audioBlob = await api.fetchPartnerAudio(phrase, voiceConfig);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.play().catch(error => {
            console.error('Error playing phrase audio:', error);
            showToast('Audio playback failed', 'error');
        });

        audio.onended = () => URL.revokeObjectURL(audioUrl);
        audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            showToast('Audio playback failed', 'error');
        };

    } catch (error) {
        console.error('Failed to play phrase audio:', error);
        showToast('Audio generation failed', 'error');
    }
}

function getVoiceConfigForLanguage(language) {
    const voiceConfigs = {
        'English': { voice_id: "pNInz6obpgDQGcFmaJgB", language_code: "en" },
        'Spanish': { voice_id: "XrExE9yKIg1WjnnlVkGX", language_code: "es" },
        'French': { voice_id: "ThT5KcBeYPX3keUQqHPh", language_code: "fr" },
        'German': { voice_id: "pNInz6obpgDQGcFmaJgB", language_code: "de" },
        'Italian': { voice_id: "XB0fDUnXU5powFXDhCwa", language_code: "it" },
        'Japanese': { voice_id: "jBpfuIE2acCO8z3wKNLl", language_code: "ja" },
        'Chinese': { voice_id: "2EiwWnXFnvU5JabPnv8n", language_code: "zh" },
        'Korean': { voice_id: "bVMeCyTHy58xNoL34h3p", language_code: "ko" }
    };
    return voiceConfigs[language] || voiceConfigs['English'];
}

// YouTube Data API key - you'll need to get this from Google Cloud Console
const YOUTUBE_API_KEY = 'AIzaSyDAdiXobuer_CZHdM1llM5RlrfhRbls84M'; // Replace with your actual API key

async function searchAndLoadYouTubeVideo(title) {
    const loader = document.getElementById('youtube-loader');
    const videoContent = document.getElementById('video-content');
    const playBtn = document.getElementById('youtube-play-btn');

    try {
        console.log('Searching YouTube for:', title);
        showToast(translateText('searchingForVideos'), 'info');

        // Generate intelligent search term using Gemini
        const searchQuery = await createIntelligentSearchTerm(title);
        console.log('Generated search query:', decodeURIComponent(searchQuery));

        // Search YouTube using the Data API
        const videoId = await searchYouTubeVideos(decodeURIComponent(searchQuery));

        if (videoId) {
            // Load the video in iframe
            const iframe = document.getElementById('youtube-iframe');
            iframe.src = `https://www.youtube.com/embed/${videoId}`;

            loader.classList.add('hidden');
            videoContent.classList.remove('hidden');

            showToast(translateText('educationalVideoLoaded'), 'success');
        } else {
            throw new Error('No suitable videos found');
        }

    } catch (error) {
        console.error('Error loading YouTube video:', error);

        // Simple fallback - show search link
        const searchQuery = encodeURIComponent(`${title} grammar explanation tutorial`);
        loader.classList.remove('hidden');
        loader.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-300 mb-4">${translateText('videoNotAvailable')}</p>
                <a href="https://www.youtube.com/results?search_query=${searchQuery}" 
                   target="_blank" 
                   class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center">
                    <i class="fab fa-youtube mr-2"></i>
                    ${translateText('searchYoutube')}
                </a>
            </div>
        `;
    }
}

async function searchYouTubeVideos(query) {
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
        console.warn('YouTube API key not configured');
        throw new Error('YouTube API key not configured');
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=5&order=relevance&relevanceLanguage=en&safeSearch=strict`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            // Filter for educational content
            const educationalVideo = data.items.find(item => {
                const title = item.snippet.title.toLowerCase();
                const description = item.snippet.description.toLowerCase();
                const channel = item.snippet.channelTitle.toLowerCase();

                // Look for educational keywords
                const educationalKeywords = ['learn', 'tutorial', 'lesson', 'explanation', 'guide', 'how to', 'grammar', 'language'];
                const hasEducationalContent = educationalKeywords.some(keyword => 
                    title.includes(keyword) || description.includes(keyword) || channel.includes(keyword)
                );

                return hasEducationalContent;
            });

            // Return the first educational video or fall back to the first result
            const selectedVideo = educationalVideo || data.items[0];
            console.log('Selected video:', selectedVideo.snippet.title);
            return selectedVideo.id.videoId;
        }

        throw new Error('No videos found');

    } catch (error) {
        console.error('YouTube search failed:', error);
        throw error;
    }
}

async function createIntelligentSearchTerm(explanationTitle) {
    try {
        // Get current language from the language select element
        const targetLanguage = domElements.languageSelect?.value || 'English';
        const nativeLang = getNativeLang() || 'en';

        console.log(`Creating search term for: "${explanationTitle}" in ${targetLanguage}`);

        const prompt = `
You are a YouTube search optimization expert for language learning content. Your task is to create the most effective search term for finding educational videos about a specific grammar or language concept.

Given:
- Grammar/Language Topic: "${explanationTitle}"
- Target Language: "${targetLanguage}"
- User's Native Language: "${nativeLang}"

Create an optimized YouTube search query that will find the best educational videos. Consider:
1. The specific grammar concept or language topic
2. The target language being learned
3. Common terms used by language educators on YouTube
4. Alternative phrasings and synonyms
5. Popular educational channels' naming conventions

Your response should be a single, concise search phrase (no quotes, max 60 characters) that maximizes the chance of finding relevant educational content.

Examples of good search terms:
- "Spanish ser vs estar explanation"
- "French subjunctive mood tutorial"
- "Japanese particle wa ga difference"
- "German case system grammar lesson"

Create the best search term for the given topic and language:`;

        // Import api dynamically to avoid circular imports
        const api = await import('./api.js');
        const data = await api.callGeminiAPI(prompt);

        if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid API response structure');
        }

        const searchTerm = data.candidates[0].content.parts[0].text.trim().replace(/["""]/g, '');

        if (!searchTerm || searchTerm.length === 0) {
            throw new Error('Empty search term generated');
        }

        console.log(`Generated intelligent search term: "${searchTerm}"`);
        return searchTerm;

    } catch (error) {
        console.error('Failed to generate intelligent search term:', error);

        // Fallback to basic search
        const cleanTitle = explanationTitle.replace(/[^\w\s]/gi, '').trim();
        const targetLanguage = domElements.languageSelect?.value || 'English';
        const fallbackQuery = `${targetLanguage} ${cleanTitle} grammar explanation tutorial`;

        console.log(`Using fallback search term: "${fallbackQuery}"`);
        return fallbackQuery;
    }
}

async function parseAndRenderExplanationWithAudio(content) {
    const targetLanguage = domElements.languageSelect?.value || 'English';

    // Parse the explanation text for audio tags
    const audioTagRegex = /<audio>(.*?)<\/audio>/g;
    let processedBody = content.body;
    const audioItems = [];

    // Extract all audio-tagged phrases
    let match;
    let index = 0;
    while ((match = audioTagRegex.exec(content.body)) !== null) {
        const phrase = match[1];
        const audioId = `audio-phrase-${index}`;
        audioItems.push({ id: audioId, phrase: phrase });

        // Replace the audio tag with a clickable span
        processedBody = processedBody.replace(
            match[0], 
            `<span class="audio-phrase" data-audio-id="${audioId}" data-phrase="${phrase}">${phrase}</span>`
        );
        index++;
    }

    return { processedBody, audioItems };
}

function showToast(message, type = 'info') {
    if (typeof Toastify !== 'undefined') {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toastInstance = Toastify({
            text: `<span class="toast-icon">${icons[type] || icons.info}</span>${message}`,
            duration: 6000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            escapeMarkup: false,
            className: `toast-${type}`,
            onClick: function() {
                toastInstance.hideToast();
            }
        });

        // Enhanced exit animation with shadowbox effects
        const originalHide = toastInstance.hideToast;
        toastInstance.hideToast = function() {
            const toastElement = this.toastElement;
            if (toastElement) {
                // Add a subtle pulse before sliding out
                toastElement.style.animation = 'toastSlideOut 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
                setTimeout(() => originalHide.call(this), 500);
            } else {
                originalHide.call(this);
            }
        };

        // Add hover effects for better interactivity
        toastInstance.showToast();

        // Enhanced hover effects
        setTimeout(() => {
            const toastElement = toastInstance.toastElement;
            if (toastElement) {
                toastElement.addEventListener('mouseenter', () => {
                    toastElement.style.transform = 'translateX(0) scale(1.02)';
                    toastElement.style.boxShadow = `
                        0 35px 70px rgba(0, 0, 0, 0.5),
                        0 0 40px rgba(255, 255, 255, 0.12),
                        inset 0 1px 0 rgba(255, 255, 255, 0.15),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                    `;
                });

                toastElement.addEventListener('mouseleave', () => {
                    toastElement.style.transform = 'translateX(0) scale(1)';
                    toastElement.style.boxShadow = '';
                });
            }
        }, 100);

        return toastInstance;
    } else {
        console.log(`Toast (${type}): ${message}`);
        return null;
    }
}


export function showReviewModeUI(language) {
    hideReviewModeBanner();

    const reviewBanner = document.createElement('div');
    reviewBanner.className = 'review-mode-indicator bg-cyan-900 text-white px-4 py-3 mb-4 rounded-lg';

    const reviewModeText = translateText('reviewMode');
    const lessonCompleteText = translateText('lessonCompleteReview');
    const vocabQuizText = translateText('vocabularyQuiz');

    reviewBanner.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i class="fas fa-history text-lg"></i>
                <span class="font-medium">${reviewModeText} - ${lessonCompleteText}</span>
            </div>
            <button id="vocab-quiz-btn" class="vocab-quiz-flash flex items-center space-x-2 bg-silver text-blue-900 px-3 py-1 rounded-lg transition-all duration-300 hover:text-purple-400 hover:shadow-lg hover:shadow-purple-400/50">
                <i class="fas fa-brain text-sm"></i>
                <span class="text-sm">${vocabQuizText}</span>
            </button>
        </div>
    `;

    domElements.lessonScreen.insertBefore(reviewBanner, domElements.lessonScreen.firstChild);
}


export function hideReviewModeBanner() {
    const banner = document.querySelector('.review-mode-indicator');
    if (banner) {
        banner.remove();
    }
}

export function showTutorial() {
    domElements.tutorialModal.classList.remove('hidden');
    updateTranslations();
}

// --- Tabs ---
export function switchTab(tabName) {
    if (tabName === 'difficulty') {
        domElements.difficultyTab.classList.add('bg-blue-600', 'text-white');
        domElements.situationsTab.classList.remove('bg-blue-600', 'text-white');
        domElements.difficultyContent.classList.remove('hidden');
        domElements.situationsContent.classList.add('hidden');
    } else {
        domElements.situationsTab.classList.add('bg-blue-600', 'text-white');
        domElements.difficultyTab.classList.remove('bg-blue-600', 'text-white');
        domElements.situationsContent.classList.remove('hidden');
        domElements.difficultyContent.classList.add('hidden');
    }
    stopTopicRotations();
    startTopicRotations();
}

// --- Topic Rotations ---
export function startTopicRotations() {
    stopTopicRotations();
    rotateTopics();
    topicRotationIntervals.push(setInterval(rotateTopics, 8000));
}

export function stopTopicRotations() {
    topicRotationIntervals.forEach(clearInterval);
    topicRotationIntervals = [];
}

function rotateTopics() {
     const containers = {
        beginner: document.getElementById('beginner-container'),
        intermediate: document.getElementById('intermediate-container'),
        advanced: document.getElementById('advanced-container')
    };
    Object.entries(containers).forEach(([level, container]) => {
        if (container) {
            animateTopicsOut(container);
            setTimeout(() => {
                const newTopics = getRandomTopics(level, 4);
                animateTopicsIn(container, newTopics, level);
            }, 500);
        }
    });
}

function animateTopicsOut(container) {
    const buttons = container.querySelectorAll('.lesson-btn');
    buttons.forEach((button, index) => {
        setTimeout(() => {
            const randomExitAnimation = exitAnimationClasses[Math.floor(Math.random() * exitAnimationClasses.length)];
            button.classList.add(randomExitAnimation);
            setTimeout(() => button.remove(), 400);
        }, index * 50);
    });
}

function animateTopicsIn(container, topics, level) {
    topics.forEach((topic, index) => {
        setTimeout(() => {
            const button = createTopicButton(topic, level);
            const randomAnimation = animationClasses[Math.floor(Math.random() * animationClasses.length)];
            button.classList.add(randomAnimation);
            container.appendChild(button);
        }, index * 100);
    });
}

function createTopicButton(topic, level) {
    const button = document.createElement('button');
    const colorMap = {
        beginner: 'green', intermediate: 'yellow', advanced: 'red',
        realistic: 'blue', futuristic: 'purple', historical: 'amber',
        drama: 'red', comedy: 'yellow', horror: 'purple'
    };
    const color = colorMap[level] || 'gray';
    button.className = `lesson-btn bg-${color}-600/20 hover:bg-${color}-600/30 text-${color}-300 text-xs py-2 px-3 rounded-md transition-all border border-${color}-600/30`;
    button.setAttribute('data-topic', topic);
    button.textContent = topic;
    button.style.opacity = '0';
    return button;
}

function getRandomTopics(level, count) {
    const topicPools = getTranslations().topics || {};
    const pool = topicPools[level] || [];
    return [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
}


// --- Lesson Display ---
export function displayLessonTitleAndContext(lessonPlan) {
    domElements.lessonTitle.textContent = lessonPlan.title;
    domElements.lessonTitleContainer.classList.toggle('hidden', !lessonPlan.title);
    domElements.backgroundContext.textContent = lessonPlan.background_context;
    domElements.backgroundContextContainer.classList.toggle('hidden', !lessonPlan.background_context);
}

export async function restoreConversation(lessonPlan) {
    domElements.conversationContainer.innerHTML = '';
    if (lessonPlan && lessonPlan.dialogue) {
        for (const [index, turn] of lessonPlan.dialogue.entries()) {
            const lineDiv = createDialogueLine(turn, index);
            domElements.conversationContainer.appendChild(lineDiv);
        }
    }
}

function createDialogueLine(turn, index) {
    const lineDiv = document.createElement('div');
    const party = turn.party ? turn.party.toUpperCase() : 'B';

    lineDiv.className = `dialogue-line text-white cursor-pointer ${party === 'A' ? 'user-line' : 'partner-line'}`;
    lineDiv.id = `turn-${index}`;

    const speakerIcon = party === 'A' ? '👤' : '🤖';
    let lineContent = `<strong>${speakerIcon}</strong> `;

    if (party === 'A' && turn.sentences && turn.sentences.length > 0) {
        turn.sentences.forEach((sentence, sentenceIndex) => {
            lineContent += `<span class="sentence-span" id="turn-${index}-sentence-${sentenceIndex}">${sentence}</span> `;
        });

        const originalLine = turn.line.display;
        if (originalLine.includes('(')) {
            const translationPart = originalLine.substring(originalLine.indexOf('('));
            lineContent += `<span class="translation-part text-gray-400">${translationPart}</span>`;
        }
    } else {
        lineContent += turn.line.display;
    }

    lineContent += ` <i class="fas fa-volume-up text-gray-400 ml-2 hover:text-sky-300"></i>`;
    lineDiv.innerHTML = lineContent.trim();

    if (turn.explanation) {
        const explanationSpan = document.createElement('span');
        explanationSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300 ml-6"></i>`;
        explanationSpan.classList.add('explanation-link');
        
        // Add debounced click handler to prevent multiple rapid clicks
        let clickTimeout = null;
        explanationSpan.onclick = (e) => {
            e.stopPropagation();
            
            // Clear any existing timeout
            if (clickTimeout) {
                clearTimeout(clickTimeout);
            }
            
            // Debounce the click with a 300ms delay
            clickTimeout = setTimeout(() => {
                // Include the original sentence in the explanation
                const explanationWithSentence = {
                    ...turn.explanation,
                    originalSentence: turn.line.display || turn.line.text || ''
                };
                showExplanation(explanationWithSentence);
                clickTimeout = null;
            }, 300);
        };
        lineDiv.appendChild(explanationSpan);
    }

    return lineDiv;
}

export function restoreIllustration(imageUrl) {
    domElements.illustrationPlaceholder.classList.add('hidden');
    domElements.imageLoader.classList.add('hidden');
    domElements.illustrationImg.src = imageUrl;
    domElements.illustrationImg.classList.remove('hidden');
}


export function addBackToLandingButton() {
    if (document.getElementById('lesson-header')) return;

    const headerContainer = document.createElement('div');
    headerContainer.id = 'lesson-header';

    const backBtn = document.createElement('button');
    backBtn.id = 'back-to-landing-btn';
    backBtn.className = 'back-button bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm';
    backBtn.innerHTML = `<i class="fas fa-arrow-left mr-2"></i>${translateText('back')}`;

    backBtn.onclick = backToLandingCallback;

    if (domElements.lessonTitleContainer) {
        headerContainer.appendChild(backBtn);
        headerContainer.appendChild(domElements.lessonTitleContainer);
        domElements.lessonScreen.insertBefore(headerContainer, domElements.lessonScreen.firstChild);
    }
}

export function updateBackButton() {
    const backBtn = document.getElementById('back-to-landing-btn');
if (backBtn) {
        backBtn.innerHTML = `<i class="fas fa-arrow-left mr-2"></i>${translateText('back')}`;
    }
}

export function showLandingScreen() {
    domElements.landingScreen?.classList.remove('hidden');
    domElements.lessonScreen?.classList.add('hidden');
}

export function showLessonScreen() {
    domElements.lessonScreen?.classList.remove('hidden');
    domElements.landingScreen?.classList.add('hidden');
}

// --- NEWLY ADDED UI FUNCTIONS ---

export function showLoadingSpinner() {
    domElements.loadingSpinner?.classList.remove('hidden');
}

export function hideLoadingSpinner() {
    domElements.loadingSpinner?.classList.add('hidden');
}

export function disableStartButton(disabled) {
    if (domElements.confirmStartLessonBtn) {
        domElements.confirmStartLessonBtn.disabled = disabled;
    }
}

export function highlightActiveLine(turnIndex) {
    document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
    const lineEl = document.getElementById(`turn-${turnIndex}`);
    if (lineEl) {
        lineEl.classList.add('active');
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

export function showStartOverlay() {
    domElements.startLessonOverlay?.classList.remove('hidden');
}

export function hideStartOverlay() {
    domElements.startLessonOverlay?.classList.add('hidden');
}

export function updateMicStatus(key, isHtml = false) {
    if (domElements.micStatus) {
        const text = translateText(key);
        if (isHtml) {
            domElements.micStatus.innerHTML = text;
        } else {
            domElements.micStatus.textContent = text;
        }
    }
}

export function updateMicStatusHTML(htmlContent) {
    if (domElements.micStatus) {
        domElements.micStatus.innerHTML = htmlContent;
    }
}

export function updateMicStatusForSentence(current, total, sentenceText) {
    if (domElements.micStatus) {
        const text = translateText('recordSentence');
        domElements.micStatus.innerHTML = `<strong>${text} ${current}/${total}:</strong><br><span class="text-cyan-400 font-bold">"${sentenceText}"</span>`;
    }
}

export function enableMicButton(enabled) {
    if (domElements.micBtn) {
        domElements.micBtn.disabled = !enabled;
    }
}

export function highlightActiveSentence(turnIndex, sentenceIndex) {
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
    const sentenceEl = document.getElementById(`turn-${turnIndex}-sentence-${sentenceIndex}`);
    if (sentenceEl) {
        sentenceEl.classList.add('active-sentence');
    }
}

export function showImageLoader() {
    domElements.illustrationPlaceholder?.classList.add('hidden');
    domElements.imageLoader?.classList.remove('hidden');
    domElements.illustrationImg?.classList.add('hidden');
}

export function showFallbackIllustration() {
    domElements.imageLoader?.classList.add('hidden');
    if (domElements.illustrationPlaceholder) {
        domElements.illustrationPlaceholder.innerHTML = `
          <div class="text-center text-gray-500">
              <i class="fas fa-comments text-4xl mb-2"></i>
              <p>${translateText('roleplayScenario')}</p>
              <p class="text-sm mt-1">${translateText('imageUnavailable')}</p>
          </div>
      `;
        domElements.illustrationPlaceholder.classList.remove('hidden');
    }
    domElements.illustrationImg?.classList.add('hidden');
}

export function flashLineBorder(turnIndex, status) {
    const lineEl = document.getElementById(`turn-${turnIndex}`);
    if (lineEl) {
        const color = status === 'correct' ? '#4ade80' : '#f87171';
        lineEl.style.transition = 'border-color 0.3s ease';
        lineEl.style.borderColor = color;
        setTimeout(() => {
            lineEl.style.borderColor = '';
        }, 1500);
    }
}

export function showSkipButton(callback) {
    if (domElements.micStatus) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'ml-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-3 py-1 rounded text-sm';
        skipBtn.textContent = translateText('skip');
        skipBtn.onclick = () => {
            callback();
            skipBtn.remove();
        };
        domElements.micStatus.appendChild(document.createElement('br'));
        domElements.micStatus.appendChild(skipBtn);
    }
}

export function resetHighlights() {
    document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));
}

export function resetMic() {
    if (domElements.micBtn) {
        domElements.micBtn.disabled = true;
        domElements.micBtn.classList.remove('bg-green-600');
        domElements.micBtn.classList.add('bg-red-600');
    }
    if (domElements.micStatus) {
        domElements.micStatus.textContent = translateText('micStatus');
    }
}

export function showLessonComplete() {
    updateMicStatusHTML(`🎉 ${translateText('lessonComplete')}`);
    enableMicButton(false);
}

// Export toast function for use in other modules
export { showToast };
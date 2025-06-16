// --- Global References ---
let domElements = {};
let getTranslations;
let getNativeLang;
let saveState;
let backToLandingCallback = () => window.location.reload(); // Default fallback

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
export function init(elements, translationsFunc, nativeLangFunc, saveFunc, backCb) {
    domElements = elements;
    getTranslations = translationsFunc;
    getNativeLang = nativeLangFunc;
    saveState = saveFunc;
    backToLandingCallback = backCb; // Assign the callback
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
    
    // Update state module - this is for UI language only, not target language
    if (window.state) {
        window.state.setNativeLang(langCode);
        window.state.setCurrentTranslations(window.translations[langCode] || window.translations.en);
    }
    
    updateTranslations();
    updateBackButton(); 
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
        'ja': { code: 'ja', flag: '🇯🇵', name: '日本語' },
        'ko': { code: 'ko', flag: '🇰🇷', name: '한국어' }
    };
    const lang = supportedLangs[browserLang] || supportedLangs['en'];
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

export function showExplanation(content) {
    // Create the modal content with explanation text and YouTube video
    const videoId = generateYouTubeSearchUrl(content.title);
    
    domElements.modalBody.innerHTML = `
        <h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3>
        <p class="text-gray-300 mb-4">${content.body}</p>
        <div class="border-t border-gray-600 pt-4">
            <h4 class="text-lg font-semibold text-cyan-300 mb-3 flex items-center">
                <i class="fab fa-youtube text-red-500 mr-2"></i>
                Related Video
            </h4>
            <div id="youtube-container" class="relative">
                <div id="youtube-loader" class="flex items-center justify-center py-8">
                    <div class="loader"></div>
                    <span class="ml-3 text-gray-400">Loading video...</span>
                </div>
                <iframe 
                    id="youtube-iframe" 
                    class="hidden w-full h-64 rounded-lg"
                    frameborder="0" 
                    allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
            </div>
        </div>
    `;
    
    domElements.modal.classList.remove('hidden');
    
    // Load YouTube video after modal is shown
    loadYouTubeVideo(content.title);
}

function generateYouTubeSearchUrl(title) {
    // Clean the title for better search results
    const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
    const searchQuery = encodeURIComponent(`${cleanTitle} grammar explanation english learning`);
    return `https://www.youtube.com/results?search_query=${searchQuery}`;
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
        showToast(`Generated search: "${searchTerm.substring(0, 30)}..."`, 'info');
        return encodeURIComponent(searchTerm);
        
    } catch (error) {
        console.error('Failed to generate intelligent search term:', error);
        showToast('Using fallback search term', 'warning');
        
        // Fallback to basic search
        const cleanTitle = explanationTitle.replace(/[^\w\s]/gi, '').trim();
        const targetLanguage = domElements.languageSelect?.value || 'English';
        const fallbackQuery = `${targetLanguage} ${cleanTitle} grammar explanation tutorial`;
        
        console.log(`Using fallback search term: "${fallbackQuery}"`);
        return encodeURIComponent(fallbackQuery);
    }
}

function showToast(message, type = 'info') {
    if (typeof Toastify !== 'undefined') {
        const backgroundColor = type === 'error' ? '#ef4444' : 
                              type === 'success' ? '#10b981' : 
                              type === 'warning' ? '#f59e0b' : '#3b82f6';
        
        Toastify({
            text: message,
            duration: 4000,
            gravity: "top",
            position: "right",
            backgroundColor: backgroundColor,
            stopOnFocus: true,
            style: {
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500"
            }
        }).showToast();
    } else {
        console.log(`Toast (${type}): ${message}`);
    }
}

function checkYTSearchLibrary() {
    return new Promise((resolve) => {
        // Check if ES6 module is loaded
        if (typeof window.yts !== 'undefined') {
            console.log('yt-search ES6 module found');
            resolve(true);
            return;
        }
        
        // Check loading status
        if (window.ytsLoaded === true) {
            console.log('yt-search marked as loaded');
            resolve(true);
            return;
        }
        
        if (window.ytsLoaded === false) {
            console.log('yt-search marked as failed to load');
            resolve(false);
            return;
        }
        
        // Wait for the ES6 module to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`Checking for yt-search ES6 module, attempt ${attempts}/15`);
            
            if (typeof window.yts !== 'undefined' || window.ytsLoaded === true) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (window.ytsLoaded === false || attempts >= 15) {
                clearInterval(checkInterval);
                console.log('yt-search ES6 module check timed out or failed');
                resolve(false);
            }
        }, 200);
    });
}

async function loadYouTubeVideo(title) {
    const loader = document.getElementById('youtube-loader');
    const iframe = document.getElementById('youtube-iframe');
    
    try {
        showToast('Searching for related video...', 'info');
        
        // Check if yt-search library is available
        const isLibraryLoaded = await checkYTSearchLibrary();
        if (!isLibraryLoaded) {
            console.warn('yt-search library not available, proceeding with fallback');
            throw new Error('yt-search library not available after waiting');
        }
        
        // Generate intelligent search term using Gemini
        const searchQuery = await createIntelligentSearchTerm(title);
        const decodedQuery = decodeURIComponent(searchQuery);
        console.log('Generated search query:', decodedQuery);
        
        // Use the ES6 module reference
        if (!window.yts) {
            console.warn('yt-search ES6 module not available, using fallback search');
            throw new Error('yt-search ES6 module not accessible - showing manual search link');
        }
        
        // Use yt-search library to find videos
        console.log('Searching YouTube with yt-search ES6 module...');
        
        // Use a promise wrapper to handle potential errors
        let searchResults;
        try {
            searchResults = await Promise.race([
                window.yts(decodedQuery),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), 10000)
                )
            ]);
        } catch (searchError) {
            console.error('yt-search failed:', searchError);
            throw new Error(`Search failed: ${searchError.message}`);
        }
        
        console.log('yt-search results:', searchResults);
        
        if (searchResults && searchResults.videos && searchResults.videos.length > 0) {
            const video = searchResults.videos[0];
            const videoId = video.videoId;
            const videoTitle = video.title;
            const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
            
            console.log('Found video:', videoTitle);
            showToast(`Found video: ${videoTitle.substring(0, 50)}...`, 'success');
            
            iframe.src = embedUrl;
            loader.classList.add('hidden');
            iframe.classList.remove('hidden');
        } else {
            console.log('No videos found in search results');
            showToast('No videos found automatically', 'warning');
            
            // Fallback: show a search link if no video found
            loader.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-search text-gray-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 mb-3">No video found automatically</p>
                    <a href="https://www.youtube.com/results?search_query=${searchQuery}" 
                       target="_blank" 
                       class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center">
                        <i class="fab fa-youtube mr-2"></i>
                        Search on YouTube
                    </a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading YouTube video:', error);
        showToast(`Video search failed: ${error.message}`, 'error');
        
        try {
            const errorSearchQuery = await createIntelligentSearchTerm(title);
            loader.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle text-yellow-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 mb-3">Could not load video</p>
                    <p class="text-xs text-gray-500 mb-3">Error: ${error.message}</p>
                    <a href="https://www.youtube.com/results?search_query=${errorSearchQuery}" 
                       target="_blank" 
                       class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center">
                        <i class="fab fa-youtube mr-2"></i>
                        Search on YouTube
                    </a>
                </div>
            `;
        } catch (fallbackError) {
            console.error('Fallback search term generation also failed:', fallbackError);
            showToast('Complete video search failure', 'error');
            
            // Ultimate fallback if even intelligent search fails
            const basicSearchQuery = encodeURIComponent(`${title} grammar explanation english learning`);
            loader.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle text-yellow-400 text-2xl mb-2"></i>
                    <p class="text-gray-400 mb-3">Could not load video</p>
                    <p class="text-xs text-gray-500 mb-3">Multiple errors occurred</p>
                    <a href="https://www.youtube.com/results?search_query=${basicSearchQuery}" 
                       target="_blank" 
                       class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center">
                        <i class="fab fa-youtube mr-2"></i>
                        Search on YouTube
                    </a>
                </div>
            `;
        }
    }
}


export function showReviewModeUI(language) {
    hideReviewModeBanner();

    const reviewBanner = document.createElement('div');
    reviewBanner.className = 'review-mode-indicator bg-purple-600 text-white px-4 py-3 mb-4 rounded-lg';

    const reviewModeText = translateText('reviewMode');
    const lessonCompleteText = translateText('lessonCompleteReview');
    const vocabQuizText = translateText('vocabQuiz');

    reviewBanner.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i class="fas fa-history text-lg"></i>
                <span class="font-medium">${reviewModeText} - ${lessonCompleteText}</span>
            </div>
            <button id="vocab-quiz-btn" class="flex items-center space-x-2 bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded-lg transition-colors">
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
        explanationSpan.onclick = (e) => {
            e.stopPropagation();
            showExplanation(turn.explanation);
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
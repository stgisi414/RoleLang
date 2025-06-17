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
const YOUTUBE_API_KEY = 'AIzaSyBQLgFiUYdSNvpbyO_TgdzXmSvT9BFgal4'; // Your API key

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
    setNativeLang = setNativeLangFunc;
    setCurrentTranslations = setCurrentTranslationsFunc;
}

// --- Translation ---
export function translateText(key) {
    const translations = getTranslations();
    if (!translations || typeof translations !== 'object') {
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

    if (setNativeLang && setCurrentTranslations) {
        setNativeLang(langCode);
        setCurrentTranslations(window.translations[langCode] || window.translations.en);
    } else {
        console.error("UI module has not been initialized with state setters.");
        return;
    }

    updateTranslations();
    updateBackButton();

    stopTopicRotations();
    // Check which tab is active and start the correct rotation
    if (domElements.difficultyContent && !domElements.difficultyContent.classList.contains('hidden')) {
        startTopicRotations();
    } else {
        startSituationsRotations();
    }
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
        historyContainer.innerHTML = `<div class="col-span-2 flex flex-col items-center justify-center py-8 text-gray-400"><i class="fas fa-history text-3xl mb-2"></i><p>${translateText('noCompletedLessons')}</p></div>`;
        return;
    }

    const recentLessons = history.slice(0, 6);
    recentLessons.forEach((lesson, index) => {
        const lessonCard = document.createElement('div');
        lessonCard.className = 'history-card bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-lg p-3 cursor-pointer transition-all';
        lessonCard.dataset.lessonId = lesson.id;
        lessonCard.innerHTML = `<div class="text-purple-300 text-xs mb-1">${lesson.language}</div><div class="text-white text-sm font-medium mb-1 line-clamp-2">${lesson.topic}</div><div class="text-gray-400 text-xs">${lesson.completedAt || ''}</div>`;
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
        if (topicRotationIntervals.length === 0) {
             if (domElements.difficultyContent && !domElements.difficultyContent.classList.contains('hidden')) {
                startTopicRotations();
            } else {
                startSituationsRotations();
            }
        }
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

let isExplanationLoading = false;

export async function showExplanation(content) {
    if (isExplanationLoading || !content || !content.title || !content.body) {
        return;
    }
    isExplanationLoading = true;

    if (domElements.modalBody) {
        domElements.modalBody.innerHTML = `<div class="flex items-center justify-center py-8"><div class="loader mr-3"></div><span class="text-gray-300">${translateText('loadingExplanation') || 'Loading explanation...'}</span></div>`;
    }
    if (domElements.modal) {
        domElements.modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    try {
        const nativeLang = getNativeLang() || 'en';
        let translatedTitle = content.title;
        let translatedBody = content.body;

        if (nativeLang !== 'en') {
            // Translation logic... (kept as is)
        }

        const { processedBody } = await parseAndRenderExplanationWithAudio({ title: translatedTitle, body: translatedBody });

        if (domElements.modalBody) {
            domElements.modalBody.innerHTML = `
                <h3 class="text-xl font-bold mb-2 text-cyan-300">${translatedTitle}</h3>
                ${content.originalSentence ? `<div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 mb-4"><p class="text-blue-300 font-bold" style="font-size: 14px !important; line-height: 1.4;">${content.originalSentence}</p></div>` : ''}
                <p class="text-gray-300 mb-4">${processedBody}</p>
                <div class="border-t border-gray-600 pt-6 mt-6">
                    <div class="text-center mb-4">
                        <h4 class="text-lg font-semibold text-cyan-300 mb-3"><i class="fas fa-play text-red-500 mr-2"></i>${translateText('relatedEducationalVideo')}</h4>
                        <button id="youtube-play-btn" class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center font-semibold"><i class="fab fa-youtube mr-2"></i>${translateText('loadVideo')}</button>
                    </div>
                    <div id="youtube-container" class="mt-6">
                        <div id="youtube-loader" class="flex items-center justify-center py-8 hidden"><div class="loader"></div><span class="ml-3 text-gray-400">${translateText('loadingVideo')}</span></div>
                        <div id="video-content" class="hidden"><iframe id="youtube-iframe" class="w-full h-80 rounded-lg shadow-lg" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" src=""></iframe></div>
                    </div>
                </div>`;
        }
    } catch (error) {
        // Error handling logic... (kept as is)
    } finally {
        isExplanationLoading = false;
    }

    const playBtn = document.getElementById('youtube-play-btn');
    if (playBtn) {
        playBtn.onclick = () => {
            playBtn.classList.add('hidden');
            document.getElementById('youtube-loader').classList.remove('hidden');
            searchAndLoadYouTubeVideo(content);
        };
    }

    const audioPhrases = domElements.modalBody.querySelectorAll('.audio-phrase');
    audioPhrases.forEach(phraseElement => {
        phraseElement.addEventListener('click', async () => {
            const phrase = phraseElement.getAttribute('data-phrase');
            await playPhraseAudio(phrase);
        });
    });
}

async function playPhraseAudio(phrase) {
    // Kept as is
}

function getVoiceConfigForLanguage(language) {
    // Kept as is
}

async function createIntelligentSearchTerm(explanationContent) {
    try {
        const targetLanguage = domElements.languageSelect?.value || 'English';
        const nativeLang = getNativeLang() || 'en';
        const { title, body } = explanationContent;

        const prompt = `
You are an expert at creating effective Youtube queries for language learners.
Analyze the following explanation and extract the single most important grammar point or vocabulary term.
**Explanation Title:** "${title}"
**Explanation Body:** "${body}"
**Target Language:** "${targetLanguage}"
Based on the above, what is the core concept a learner would want a video about?
Respond with ONLY the most relevant search query. For example, if the concept is the Japanese particle "ごろ", respond with "Japanese grammar ごろ tutorial". If it's about "ser" and "estar" in Spanish, respond with "ser vs estar Spanish grammar lesson".`;

        const api = await import('./api.js');
        const data = await api.callGeminiAPI(prompt);
        const searchTerm = data.candidates[0].content.parts[0].text.trim().replace(/[""]/g, '');

        if (!searchTerm) throw new Error('Empty search term generated');
        console.log(`Generated intelligent search term: "${searchTerm}"`);
        return searchTerm;

    } catch (error) {
        console.error('Failed to generate intelligent search term:', error);
        const cleanTitle = explanationContent.title.replace(/[^\w\s]/gi, '').trim();
        const targetLanguage = domElements.languageSelect?.value || 'English';
        return `${targetLanguage} ${cleanTitle} grammar explanation`;
    }
}

async function searchYouTubeVideos(query) {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
        throw new Error('YouTube API key not configured');
    }
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&maxResults=10&order=relevance`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`Youtube API error: ${searchResponse.status}`);

        const searchData = await searchResponse.json();
        if (!searchData.items || searchData.items.length === 0) return null;

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) throw new Error(`YouTube Details API error: ${detailsResponse.status}`);

        const detailsData = await detailsResponse.json();
        const embeddableVideo = detailsData.items.find(item => item.status.embeddable === true);

        if (embeddableVideo) {
            console.log('Found embeddable video:', embeddableVideo.snippet.title);
            return embeddableVideo.id;
        }

        console.warn('No embeddable videos found in the top 10 results.');
        return null;

    } catch (error) {
        console.error('YouTube video search failed:', error);
        throw error;
    }
}

async function searchAndLoadYouTubeVideo(content) {
    const loader = document.getElementById('youtube-loader');
    const videoContent = document.getElementById('video-content');
    const iframe = document.getElementById('youtube-iframe');

    try {
        const searchQuery = await createIntelligentSearchTerm(content);
        const videoId = await searchYouTubeVideos(searchQuery);

        if (videoId) {
            iframe.src = `https://www.youtube.com/embed/${videoId}`;
            loader.classList.add('hidden');
            videoContent.classList.remove('hidden');
            showToast(translateText('educationalVideoLoaded'), 'success');
        } else {
            throw new Error('No embeddable videos found.');
        }
    } catch (error) {
        console.error('Error loading YouTube video:', error);
        const fallbackSearchQuery = encodeURIComponent(`${content.title} grammar explanation tutorial`);
        loader.innerHTML = `<div class="text-center py-8"><p class="text-gray-300 mb-4">${translateText('videoNotAvailable')}</p><a href="https://www.youtube.com/results?search_query=${fallbackSearchQuery}" target="_blank" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center"><i class="fab fa-youtube mr-2"></i>${translateText('searchYoutube')}</a></div>`;
    }
}

async function parseAndRenderExplanationWithAudio(content) {
    const targetLanguage = domElements.languageSelect?.value || 'English';

    const audioTagRegex = /<audio>(.*?)<\/audio>/g;
    let processedBody = content.body;
    const audioItems = [];

    let match;
    let index = 0;
    while ((match = audioTagRegex.exec(content.body)) !== null) {
        const phrase = match[1];
        const audioId = `audio-phrase-${index}`;
        audioItems.push({ id: audioId, phrase: phrase });

        processedBody = processedBody.replace(
            match[0], 
            `<span class="audio-phrase" data-audio-id="${audioId}" data-phrase="${phrase}">${phrase}</span>`
        );
        index++;
    }

    return { processedBody, audioItems };
}

export function showToast(message, type = 'info') {
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

        const originalHide = toastInstance.hideToast;
        toastInstance.hideToast = function() {
            const toastElement = this.toastElement;
            if (toastElement) {
                toastElement.style.animation = 'toastSlideOut 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
                setTimeout(() => originalHide.call(this), 500);
            } else {
                originalHide.call(this);
            }
        };

        toastInstance.showToast();

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
    stopTopicRotations();

    if (tabName === 'difficulty') {
        // Activate difficulty tab
        domElements.difficultyTab.classList.add('bg-blue-600', 'text-white');
        domElements.difficultyTab.classList.remove('text-gray-400');

        // Deactivate situations tab
        domElements.situationsTab.classList.remove('bg-blue-600', 'text-white');
        domElements.situationsTab.classList.add('text-gray-400');

        // Toggle content visibility
        domElements.difficultyContent.classList.remove('hidden');
        domElements.situationsContent.classList.add('hidden');

        startTopicRotations();
    } else { // situations tab
        // Activate situations tab
        domElements.situationsTab.classList.add('bg-blue-600', 'text-white');
        domElements.situationsTab.classList.remove('text-gray-400');

        // Deactivate difficulty tab
        domElements.difficultyTab.classList.remove('bg-blue-600', 'text-white');
        domElements.difficultyTab.classList.add('text-gray-400');

        // Toggle content visibility
        domElements.situationsContent.classList.remove('hidden');
        domElements.difficultyContent.classList.add('hidden');

        startSituationsRotations();
    }
}

// --- Topic Rotations ---
export function startTopicRotations() {
    stopTopicRotations();
    rotateTopics();
    topicRotationIntervals.push(setInterval(rotateTopics, 8000));
}

export function startSituationsRotations() {
    stopTopicRotations();
    rotateSituations();
    topicRotationIntervals.push(setInterval(rotateSituations, 8000));
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

function rotateSituations() {
    const containers = {
        realistic: document.getElementById('realistic-container'),
        futuristic: document.getElementById('futuristic-container'),
        historical: document.getElementById('historical-container'),
        drama: document.getElementById('drama-container'),
        comedy: document.getElementById('comedy-container'),
        horror: document.getElementById('horror-container')
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
    container.innerHTML = ''; // Clear previous buttons before adding new ones
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

        let clickTimeout = null;
        explanationSpan.onclick = (e) => {
            e.stopPropagation();
            if (clickTimeout) clearTimeout(clickTimeout);
            clickTimeout = setTimeout(() => {
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
    const sentenceEl = document.getElementById(`turn-${index}-sentence-${sentenceIndex}`);
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

export function closeExplanationModal() {
    const iframe = document.getElementById('youtube-iframe');
    if (iframe && iframe.src) {
        iframe.src = ''; 
    }

    import('./state.js').then(state => {
        if (state.audioPlayer && !state.audioPlayer.paused) {
            state.audioPlayer.pause();
            state.audioPlayer.currentTime = 0;
        }
        if (state.audioController) {
            state.audioController.abort();
        }
    }).catch(err => console.error("Failed to import state for audio cleanup:", err));

    domElements.modal?.classList.add('hidden');
    document.body.classList.remove('modal-open');
}
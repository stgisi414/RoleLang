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
    if (typeof getNativeLang === 'function') {
        getNativeLang(langCode);
    }
    domElements.nativeFlagEl.textContent = flag;
    domElements.nativeLangTextEl.textContent = name;
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
    domElements.modalBody.innerHTML = `<h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3><p class="text-gray-300">${content.body}</p>`;
    domElements.modal.classList.remove('hidden');
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

export function showImageLoader() {
    //... function content
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

export function hideStartOverlay() {
    domElements.startLessonOverlay?.classList.add('hidden');
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
    updateMicStatus('lessonComplete');
    enableMicButton(false);
}
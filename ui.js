
import * as state from './state.js';

let domElements = {};
let getTranslationsFunc;
let getNativeLangFunc;
// REMOVE THIS -> let setNativeLanguageFunc;
let saveStateFunc;

export function init(elements, getTranslations, getNativeLang, save) { // Removed setNativeLanguage from parameters
    domElements = elements;
    getTranslationsFunc = getTranslations;
    getNativeLangFunc = getNativeLang;
    // REMOVE THIS -> setNativeLanguageFunc = setNativeLanguage;
    saveStateFunc = save;
}

export function translateText(key) {
    const translations = getTranslationsFunc();
    return translations[key] || window.translations?.en?.[key] || key;
}

export function updateTranslations() {
    document.title = translateText('title');
    document.querySelectorAll('[data-translate]').forEach(el => {
        el.textContent = translateText(el.getAttribute('data-translate'));
    });
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        el.placeholder = translateText(el.getAttribute('data-translate-placeholder'));
    });
    updateBackButton();
    if (domElements.historyContainer && !domElements.historyContainer.classList.contains('hidden')) {
        displayLessonHistory();
    }
}

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
    state.setNativeLang(langCode);
    if (domElements.nativeFlagEl) domElements.nativeFlagEl.textContent = flag;
    if (domElements.nativeLangTextEl) domElements.nativeLangTextEl.textContent = name;
    state.setCurrentTranslations(window.translations[langCode] || window.translations.en);
    updateTranslations();
    stopTopicRotations();
    startTopicRotations();
    localStorage.setItem('rolelang_native_lang', JSON.stringify({ code: langCode, flag, name }));
}

function detectNativeLanguage() {
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const langCode = browserLang.split('-')[0].toLowerCase();
    const map = {
        'en': { code: 'en', flag: '🇺🇸', name: 'English' },
        'es': { code: 'es', flag: '🇪🇸', name: 'Español' },
        'fr': { code: 'fr', flag: '🇫🇷', name: 'Français' },
        'de': { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
        'it': { code: 'it', flag: '🇮🇹', name: 'Italiano' },
        'zh': { code: 'zh', flag: '🇨🇳', name: '中文' },
        'ja': { code: 'ja', flag: '🇯🇵', name: '日本語' },
        'ko': { code: 'ko', flag: '🇰🇷', name: '한국어' }
    };
    const detected = map[langCode] || map['en'];
    setNativeLanguage(detected.code, detected.flag, detected.name);
}

export function showTutorial() {
    if (domElements.tutorialModal) {
        domElements.tutorialModal.classList.remove('hidden');
        updateTranslations();
    }
}

export function showExplanation(content) {
    if (domElements.modalBody && domElements.modal) {
        domElements.modalBody.innerHTML = `<h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3><p class="text-gray-300">${content.body}</p>`;
        domElements.modal.classList.remove('hidden');
    }
}

export async function restoreConversation(lessonPlan) {
    if (!domElements.conversationContainer) return;
    
    domElements.conversationContainer.innerHTML = '';
    for (const [index, turn] of lessonPlan.dialogue.entries()) {
        const lineDiv = document.createElement('div');
        lineDiv.classList.add('dialogue-line', 'text-white', 'cursor-pointer');
        lineDiv.id = `turn-${index}`;
        const speakerIcon = turn.party === 'A' ? '👤' : '🤖';
        lineDiv.innerHTML = `<strong>${speakerIcon}</strong> ${turn.line.display} <i class="fas fa-volume-up text-gray-400 ml-2 hover:text-sky-300"></i>`;
        lineDiv.classList.add(turn.party === 'A' ? 'user-line' : 'partner-line');
        
        if (turn.explanation) {
            const expSpan = document.createElement('span');
            expSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300 ml-6"></i>`;
            expSpan.classList.add('explanation-link');
            expSpan.onclick = (e) => { e.stopPropagation(); showExplanation(turn.explanation); };
            lineDiv.appendChild(expSpan);
        }
        domElements.conversationContainer.appendChild(lineDiv);
    }
}

export function restoreIllustration(imageUrl) {
    if (domElements.illustrationPlaceholder) domElements.illustrationPlaceholder.classList.add('hidden');
    if (domElements.imageLoader) domElements.imageLoader.classList.add('hidden');
    if (domElements.illustrationImg) {
        domElements.illustrationImg.src = imageUrl;
        domElements.illustrationImg.classList.remove('hidden');
    }
}

export function displayLessonTitleAndContext(lessonPlan) {
    const titleContainer = document.getElementById('lesson-title-container');
    const titleElement = document.getElementById('lesson-title');
    const contextContainer = document.getElementById('background-context-container');
    const contextElement = document.getElementById('background-context');

    if (lessonPlan && lessonPlan.title && titleElement) {
        titleElement.textContent = lessonPlan.title;
        titleContainer?.classList.remove('hidden');
    }
    if (lessonPlan && lessonPlan.background_context && contextElement) {
        contextElement.textContent = lessonPlan.background_context;
        contextContainer?.classList.remove('hidden');
    }
}

export function updateBackButton() {
    const backBtn = document.getElementById('back-to-landing-btn');
    if (backBtn) {
        backBtn.innerHTML = `<i class="fas fa-arrow-left mr-2"></i>${translateText('back')}`;
    }
}

export function hideReviewModeBanner() {
    const banner = document.querySelector('.review-mode-indicator');
    if (banner) {
        banner.remove();
    }
}

export function showReviewModeUI(language, lessonPlan) {
    const lessonScreen = domElements.lessonScreen;
    if (!lessonScreen) return;
    
    const existingReviewIndicator = lessonScreen.querySelector('.review-mode-indicator');
    if (existingReviewIndicator) {
        existingReviewIndicator.remove();
    }

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
    
    lessonScreen.insertBefore(reviewBanner, lessonScreen.firstChild);
}

export function populateLessonTopics() {
    const translations = getTranslations();
    const nativeLang = getNativeLang() || 'en';
    
    if (!translations || !translations[nativeLang] || !translations[nativeLang].topics) {
        console.warn('Topics not available for current language');
        return;
    }

    const topics = translations[nativeLang].topics;
    
    const containers = {
        'beginner-container': topics.beginner || [],
        'intermediate-container': topics.intermediate || [],
        'advanced-container': topics.advanced || [],
        'realistic-container': topics.realistic || [],
        'futuristic-container': topics.futuristic || [],
        'historical-container': topics.historical || [],
        'drama-container': topics.drama || [],
        'comedy-container': topics.comedy || [],
        'horror-container': topics.horror || []
    };

    Object.entries(containers).forEach(([containerId, topicList]) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = ''; // Clear existing content
            topicList.slice(0, 4).forEach((topic, index) => {
                const button = document.createElement('button');
                button.className = 'lesson-btn bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 hover:border-blue-400/50 text-white px-3 py-2 rounded-lg text-sm transition-all transform hover:scale-105 backdrop-blur-sm';
                button.setAttribute('data-topic', topic);
                button.textContent = topic;
                button.style.opacity = '0';
                button.style.animation = `gentleFadeIn 0.5s ease-out ${index * 0.1}s forwards`;
                container.appendChild(button);
            });
        }
    });Haunted House', 'Mystery Solver', 'Scary Story', 'Thriller Plot']
    };

    Object.entries(containers).forEach(([containerId, topics]) => {
        const container = document.getElementById(containerId);
        if (container && container.children.length === 0) {
            topics.forEach(topic => {
                const button = document.createElement('button');
                button.className = 'lesson-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-all';
                button.setAttribute('data-topic', topic);
                button.textContent = topic;
                container.appendChild(button);
            });
        }
    });
}

export function displayLessonHistory() {
    if (!domElements.historyLessonsContainer) return;
    
    // Clear existing content
    domElements.historyLessonsContainer.innerHTML = '';
    
    // Try to get lesson history from localStorage
    try {
        const history = JSON.parse(localStorage.getItem('rolelang_lesson_history') || '[]');
        
        if (history.length === 0) {
            const noHistoryMsg = document.createElement('div');
            noHistoryMsg.className = 'col-span-2 text-center text-gray-500 py-4';
            noHistoryMsg.textContent = translateText('noCompletedLessons') || 'No completed lessons yet';
            domElements.historyLessonsContainer.appendChild(noHistoryMsg);
            return;
        }

        // Display the lessons with proper styling
        history.slice(0, 6).forEach((lessonRecord, index) => {
            const lessonCard = document.createElement('button');
            lessonCard.className = 'history-card bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 hover:border-amber-400/50 text-white p-3 rounded-lg text-left transition-all transform hover:scale-105 backdrop-blur-sm';
            
            lessonCard.innerHTML = `
                <div class="font-medium text-sm mb-1 line-clamp-1">${lessonRecord.topic}</div>
                <div class="text-xs text-gray-400 mb-1">${lessonRecord.language}</div>
                <div class="text-xs text-gray-500">${lessonRecord.completedAt}</div>
            `;
            
            lessonCard.style.opacity = '0';
            lessonCard.style.animation = `gentleFadeIn 0.5s ease-out ${index * 0.1}s forwards`;
            
            lessonCard.onclick = () => {
                // Load the lesson for review
                if (lessonRecord.lessonPlan && domElements.topicInput) {
                    domElements.topicInput.value = lessonRecord.topic;
                    if (domElements.languageSelect) {
                        domElements.languageSelect.value = lessonRecord.language;
                    }
                }
            };
            
            domElements.historyLessonsContainer.appendChild(lessonCard);
        });
    } catch (error) {
        console.warn('Failed to load lesson history:', error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'col-span-2 text-center text-red-400 py-4';
        errorMsg.textContent = 'Error loading lesson history';
        domElements.historyLessonsContainer.appendChild(errorMsg);
    }essonsContainer.appendChild(noHistoryMsg);
            return;
        }

        // Display recent lessons (last 8)
        const recentLessons = history.slice(-8).reverse();
        recentLessons.forEach((lesson, index) => {
            const lessonCard = document.createElement('button');
            lessonCard.className = 'history-card bg-amber-800/20 hover:bg-amber-700/30 border border-amber-600/30 rounded-lg p-3 text-left transition-all';
            lessonCard.innerHTML = `
                <div class="text-white font-medium text-sm line-clamp-2 mb-1">${lesson.topic}</div>
                <div class="text-amber-300 text-xs">${lesson.language}</div>
                <div class="text-gray-400 text-xs">${lesson.completedAt}</div>
            `;
            domElements.historyLessonsContainer.appendChild(lessonCard);
        });
    } catch (error) {
        console.error('Error loading lesson history:', error);
    }
}

export function startTopicRotations() {
    // Populate topics when starting rotations
    populateLessonTopics();
    console.log('Starting topic rotations');
}

export function stopTopicRotations() {
    // Implementation to stop topic rotations
    console.log('Stopping topic rotations');
}

export function switchTab(tabName) {
    if (!domElements.difficultyTab || !domElements.situationsTab) return;
    
    if (tabName === 'difficulty') {
        domElements.difficultyTab.classList.add('bg-blue-600', 'text-white');
        domElements.difficultyTab.classList.remove('text-gray-400');
        domElements.situationsTab.classList.remove('bg-blue-600', 'text-white');
        domElements.situationsTab.classList.add('text-gray-400');
        domElements.difficultyContent?.classList.remove('hidden');
        domElements.situationsContent?.classList.add('hidden');
    } else if (tabName === 'situations') {
        domElements.situationsTab.classList.add('bg-blue-600', 'text-white');
        domElements.situationsTab.classList.remove('text-gray-400');
        domElements.difficultyTab.classList.remove('bg-blue-600', 'text-white');
        domElements.difficultyTab.classList.add('text-gray-400');
        domElements.situationsContent?.classList.remove('hidden');
        domElements.difficultyContent?.classList.add('hidden');
    }
}

export function toggleLessonsVisibility(forceShow = false) {
    if (!domElements.lessonsContainer || !domElements.toggleLessonsBtn) return;
    
    const isHidden = domElements.lessonsContainer.classList.contains('hidden');
    const chevronIcon = domElements.toggleLessonsBtn.querySelector('i');

    if (isHidden || forceShow) {
        domElements.lessonsContainer.classList.remove('hidden');
        if (chevronIcon) chevronIcon.style.transform = 'rotate(180deg)';
        // Populate lesson topics if not already done
        populateLessonTopics();
    } else if (!forceShow) {
        domElements.lessonsContainer.classList.add('hidden');
        if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
    }

    if (saveStateFunc) saveStateFunc();
}

export function toggleHistoryVisibility() {
    if (!domElements.historyContainer || !domElements.toggleHistoryBtn) return;
    
    const isHidden = domElements.historyContainer.classList.contains('hidden');
    const chevronIcon = domElements.toggleHistoryBtn.querySelector('i');

    if (isHidden) {
        domElements.historyContainer.classList.remove('hidden');
        if (chevronIcon) chevronIcon.style.transform = 'rotate(180deg)';
        displayLessonHistory();
    } else {
        domElements.historyContainer.classList.add('hidden');
        if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
    }
}

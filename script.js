document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const landingScreen = document.getElementById('landing-screen');
    const lessonScreen = document.getElementById('lesson-screen');
    const startLessonBtn = document.getElementById('start-lesson-btn');
    const languageSelect = document.getElementById('language-select');
    const topicInput = document.getElementById('topic-input');

    const illustrationContainer = document.getElementById('illustration-container');
    const illustrationImg = document.getElementById('lesson-illustration');
    const illustrationPlaceholder = document.getElementById('illustration-placeholder');
    const imageLoader = document.getElementById('image-loader');
    const conversationContainer = document.getElementById('conversation-container');
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');
    const loadingSpinner = document.getElementById('loading-spinner');
    const audioSpeedSelect = document.getElementById('audio-speed');
    const resetLessonBtn = document.getElementById('reset-lesson-btn');

    const modal = document.getElementById('explanation-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Native language dropdown elements
    const nativeLangBtn = document.getElementById('native-lang-btn');
    const nativeLangDropdown = document.getElementById('native-lang-dropdown');
    const nativeFlagEl = document.getElementById('native-flag');
    const nativeLangTextEl = document.getElementById('native-lang-text');
    const toggleLessonsBtn = document.getElementById('toggle-lessons-btn');
    const lessonsContainer = document.getElementById('lessons-container');
    const difficultyTab = document.getElementById('difficulty-tab');
    const situationsTab = document.getElementById('situations-tab');
    const difficultyContent = document.getElementById('difficulty-content');
    const situationsContent = document.getElementById('situations-content');

    // --- API & State ---
    // IMPORTANT: Replace with your actual Gemini API Key.
    // It's highly recommended to use a backend proxy to protect this key in a real application.
    const GEMINI_API_KEY = 'AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${GEMINI_API_KEY}`;
    const TTS_API_URL = 'https://langcamp.us/elevenlbs-exchange-audio/exchange-audio';
    const IMAGE_API_URL = 'https://ainovel.site/api/generate-image';

    // ADD THIS NEW OBJECT
    const langKeyToCode = {
        'langEnglish': 'en-US',
        'langSpanish': 'es-ES',
        'langFrench': 'fr-FR',
        'langGerman': 'de-DE',
        'langItalian': 'it-IT',
        'langJapanese': 'ja-JP',
        'langChinese': 'zh-CN',
        'langKorean': 'ko-KR'
    };

    let lessonPlan = null;
    let currentTurnIndex = 0;
    let isRecognizing = false;
    let topicRotationIntervals = [];
    let nativeLang = 'en'; // Default to English
    let currentTranslations = translations.en; // Default translations

    // State management
    const STATE_KEY = 'rolelang_app_state';
    const LESSON_HISTORY_KEY = 'rolelang_lesson_history';
    const MAX_LESSON_HISTORY = 100;

    function saveState() {
        const state = {
            lessonPlan: lessonPlan,
            currentTurnIndex: currentTurnIndex,
            currentScreen: lessonPlan ? 'lesson' : 'landing',
            selectedLanguage: languageSelect.value,
            topicInput: topicInput.value,
            nativeLang: nativeLang,
            lessonsVisible: !lessonsContainer.classList.contains('hidden'),
            audioSpeed: audioSpeedSelect ? audioSpeedSelect.value : '1',
            lastSaved: Date.now()
        };

        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }

    function loadState() {
        try {
            const savedState = localStorage.getItem(STATE_KEY);
            if (!savedState) return null;

            const state = JSON.parse(savedState);

            // Check if state is recent (within 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            if (state.lastSaved < sevenDaysAgo) {
                localStorage.removeItem(STATE_KEY);
                return null;
            }

            return state;
        } catch (error) {
            console.warn('Failed to load state from localStorage:', error);
            localStorage.removeItem(STATE_KEY);
            return null;
        }
    }

    function clearState() {
        localStorage.removeItem(STATE_KEY);
    }

    function restoreState(state) {
        // Restore form values
        if (state.selectedLanguage) {
            languageSelect.value = state.selectedLanguage;
        }
        if (state.topicInput) {
            topicInput.value = state.topicInput;
        }

        // Restore lessons visibility
        if (state.lessonsVisible) {
            lessonsContainer.classList.remove('hidden');
            const chevronIcon = toggleLessonsBtn.querySelector('i');
            chevronIcon.style.transform = 'rotate(180deg)';
        }

        // Restore audio speed
        if (state.audioSpeed && audioSpeedSelect) {
            audioSpeedSelect.value = state.audioSpeed;
        }

        // Restore lesson if it exists
        if (state.lessonPlan && state.currentScreen === 'lesson') {
            lessonPlan = state.lessonPlan;
            currentTurnIndex = state.currentTurnIndex;

            // Set speech recognition language
            if (recognition) {
                recognition.lang = getLangCode(state.selectedLanguage);
            }

            // Switch to lesson screen
            landingScreen.classList.add('hidden');
            lessonScreen.classList.remove('hidden');

            // Restore conversation
            restoreConversation();

            // Restore illustration
            if (lessonPlan.illustration_url) {
                restoreIllustration(lessonPlan.illustration_url);
            } else if (lessonPlan.illustration_prompt) {
                fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
            }

            // Resume from current turn
            advanceTurn();

            // Stop topic rotations when in lesson
            stopTopicRotations();
        }
    }

    // Translation function
    function translateText(key) {
        return currentTranslations[key] || translations.en[key] || key;
    }

    // Update all translatable elements
    function updateTranslations() {
        // Update document title
        document.title = translateText('title');

        // Update all elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            element.textContent = translateText(key);
        });

        // Update all elements with data-translate-placeholder attribute
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            element.placeholder = translateText(key);
        });

        // Update mic status if it has default text
        const micStatusEl = document.getElementById('mic-status');
        if (micStatusEl && micStatusEl.textContent === translateText('micStatus')) {
            micStatusEl.textContent = translateText('micStatus');
        }
    }

    // Detect browser language and set native language
    const detectNativeLanguage = () => {
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();

        // Map of supported native languages
        const nativeLangMap = {
            'en': { code: 'en', flag: '🇺🇸', name: 'English' },
            'es': { code: 'es', flag: '🇪🇸', name: 'Español' },
            'fr': { code: 'fr', flag: '🇫🇷', name: 'Français' },
            'de': { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
            'it': { code: 'it', flag: '🇮🇹', name: 'Italiano' },
            'zh': { code: 'zh', flag: '🇨🇳', name: '中文' },
            'ja': { code: 'ja', flag: '🇯🇵', name: '日本語' },
            'ko': { code: 'ko', flag: '🇰🇷', name: '한국어' }
        };

        const detectedLang = nativeLangMap[langCode] || nativeLangMap['en'];
        setNativeLanguage(detectedLang.code, detectedLang.flag, detectedLang.name);
    };

    const setNativeLanguage = (langCode, flag, name) => {
        nativeLang = langCode;
        nativeFlagEl.textContent = flag;
        nativeLangTextEl.textContent = name;

        // Update translations
        currentTranslations = translations[langCode] || translations.en;
        updateTranslations();

        // Refresh topics with new language
        stopTopicRotations();
        startTopicRotations();

        // Store in localStorage for persistence
        localStorage.setItem('rolelang_native_lang', JSON.stringify({ code: langCode, flag, name }));
    };

    // Function to get translated topic pools
    function getTopicPools() {
        return currentTranslations.topics || translations.en.topics;
    }

    const animationClasses = [
        'topic-animate-in-1', 'topic-animate-in-2', 'topic-animate-in-3', 'topic-animate-in-4',
        'topic-animate-in-5', 'topic-animate-in-6', 'topic-animate-in-7', 'topic-animate-in-8'
    ];

    const exitAnimationClasses = [
        'topic-animate-out', 'topic-animate-out-1', 'topic-animate-out-2', 'topic-animate-out-3'
    ];

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US'; // This will be updated based on language choice
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else {
        micStatus.textContent = translateText('speechNotSupported');
        micBtn.disabled = true;
    }

    // --- Event Listeners ---
    startLessonBtn.addEventListener('click', initializeLesson);
    micBtn.addEventListener('click', toggleSpeechRecognition);
    toggleLessonsBtn.addEventListener('click', toggleLessonsVisibility);
    document.getElementById('toggle-history-btn').addEventListener('click', toggleHistoryVisibility);
    difficultyTab.addEventListener('click', () => switchTab('difficulty'));
    situationsTab.addEventListener('click', () => switchTab('situations'));
    resetLessonBtn.addEventListener('click', resetLesson);

    // Add event listeners for lesson buttons
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('lesson-btn')) {
            const topic = event.target.getAttribute('data-topic');
            topicInput.value = topic;
            // Save state when topic changes
            saveState();
            // Visual feedback
            event.target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                event.target.style.transform = '';
            }, 150);
        }
    });

    // Save state when form inputs change
    languageSelect.addEventListener('change', saveState);
    topicInput.addEventListener('input', debounce(saveState, 500));
    audioSpeedSelect.addEventListener('change', saveState);
    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (event) => {
        // Close modal if clicking on the backdrop
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Native language dropdown event listeners
    nativeLangBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        nativeLangDropdown.classList.toggle('hidden');
    });

    // Handle native language option selection
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('native-lang-option') || event.target.closest('.native-lang-option')) {
            const option = event.target.closest('.native-lang-option');
            const langCode = option.getAttribute('data-lang');
            const flag = option.getAttribute('data-flag');
            const name = option.textContent.trim();

            setNativeLanguage(langCode, flag, name);
            nativeLangDropdown.classList.add('hidden');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!nativeLangBtn.contains(event.target) && !nativeLangDropdown.contains(event.target)) {
            nativeLangDropdown.classList.add('hidden');
        }
    });

    if (recognition) {
        recognition.onstart = () => {
            isRecognizing = true;
            micBtn.classList.add('bg-green-600');
            micBtn.classList.remove('bg-red-600');
            micStatus.textContent = translateText('listening');
        };

        recognition.onend = () => {
            isRecognizing = false;
            micBtn.classList.remove('bg-green-600');
            micBtn.classList.add('bg-red-600');
            // The status text is now correctly handled by the speech verification functions,
            // so we no longer reset it here. This fixes the "flashing" message bug.
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error, "for language:", recognition.lang);
            const currentLanguage = languageSelect.value;

            if (event.error === 'language-not-supported') {
                micStatus.innerHTML = `Speech recognition for <strong>${currentLanguage}</strong> is not supported by your browser. You can continue the lesson without microphone practice.`;
                // Disable the mic button permanently for this session if the language is unsupported.
                micBtn.disabled = true;
                micBtn.style.cursor = 'not-allowed';
                // Visually show it's disabled
                micBtn.classList.add('disabled:bg-gray-600', 'disabled:cursor-not-allowed', 'disabled:transform-none');

            } else if (event.error === 'no-speech') {
                micStatus.textContent = "Sorry, I didn't hear that. Please try again.";
            } else if (event.error === 'audio-capture') {
                micStatus.textContent = "Microphone error. Please check your browser and system permissions.";
                micBtn.disabled = true;
            } else {
                micStatus.textContent = `An error occurred: ${event.error}.`;
            }
        };

        recognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            micStatus.textContent = `${translateText('youSaid')} "${spokenText}"`;
            verifyUserSpeech(spokenText);
        };
    }

    // --- Lesson History Functions ---

    function saveLessonToHistory(lessonPlan, selectedLanguage, originalTopic) {
        try {
            const history = getLessonHistory();
            const lessonRecord = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                language: selectedLanguage,
                topic: originalTopic,
                scenario: lessonPlan.scenario,
                completedAt: new Date().toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                lessonPlan: lessonPlan
            };

            // Add to beginning of array
            history.unshift(lessonRecord);

            // Keep only the most recent MAX_LESSON_HISTORY lessons
            if (history.length > MAX_LESSON_HISTORY) {
                history.splice(MAX_LESSON_HISTORY);
            }

            localStorage.setItem(LESSON_HISTORY_KEY, JSON.stringify(history));

            // Refresh history display if visible
            if (!document.getElementById('history-container').classList.contains('hidden')) {
                displayLessonHistory();
            }
        } catch (error) {
            console.warn('Failed to save lesson to history:', error);
        }
    }

    function getLessonHistory() {
        try {
            const history = localStorage.getItem(LESSON_HISTORY_KEY);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.warn('Failed to load lesson history:', error);
            return [];
        }
    }

    function displayLessonHistory() {
        const historyContainer = document.getElementById('history-lessons-container');
        const history = getLessonHistory();

        if (history.length === 0) {
            historyContainer.innerHTML = `
        <div class="col-span-2 flex flex-col items-center justify-center py-8 text-gray-400">
          <i class="fas fa-history text-3xl mb-2"></i>
          <p>${translateText('noCompletedLessons')}</p>
        </div>
      `;
            return;
        }

        historyContainer.innerHTML = '';

        // Display up to 6 most recent lessons in a grid
        const recentLessons = history.slice(0, 6);
        recentLessons.forEach((lesson, index) => {
            const lessonCard = document.createElement('div');
            lessonCard.className = 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-lg p-3 cursor-pointer transition-all';
            lessonCard.innerHTML = `
        <div class="text-purple-300 text-xs mb-1">${lesson.language}</div>
        <div class="text-white text-sm font-medium mb-1 line-clamp-2">${lesson.topic}</div>
        <div class="text-gray-400 text-xs">${lesson.completedAt}</div>
      `;

            lessonCard.addEventListener('click', () => {
                reviewLesson(lesson);
            });

            // Add animation
            lessonCard.style.opacity = '0';
            lessonCard.classList.add(`topic-animate-in-${(index % 6) + 1}`);

            historyContainer.appendChild(lessonCard);
        });
    }

    function reviewLesson(lessonRecord) {
        // Set up the lesson for review
        lessonPlan = lessonRecord.lessonPlan;
        currentTurnIndex = 0;

        // Update form values
        languageSelect.value = lessonRecord.language;
        topicInput.value = lessonRecord.topic;

        // Set speech recognition language
        if (recognition) {
            recognition.lang = getLangCode(lessonRecord.language);
        }

        // Clear previous state and switch to lesson screen
        clearState();
        landingScreen.classList.add('hidden');
        lessonScreen.classList.remove('hidden');

        // Stop topic rotations
        stopTopicRotations();

        // Set up lesson
        if (lessonPlan.illustration_url) {
            restoreIllustration(lessonPlan.illustration_url);
        } else if (lessonPlan.illustration_prompt) {
            fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
        }

        startConversation();

        // Add review indicator
        const reviewIndicator = document.createElement('div');
        reviewIndicator.className = 'absolute top-16 left-4 bg-purple-600 text-white px-3 py-1 rounded-lg text-sm z-10';
        reviewIndicator.innerHTML = '<i class="fas fa-history mr-2"></i>Review Mode';
        lessonScreen.appendChild(reviewIndicator);

        // Save state for review session
        saveState();
    }

    // --- Tab Switching Functions ---

    function switchTab(tabName) {
        if (tabName === 'difficulty') {
            difficultyTab.classList.add('bg-blue-600', 'text-white');
            difficultyTab.classList.remove('text-gray-400');
            situationsTab.classList.remove('bg-blue-600', 'text-white');
            situationsTab.classList.add('text-gray-400');
            difficultyContent.classList.remove('hidden');
            situationsContent.classList.add('hidden');

            // Stop situations rotations and start difficulty rotations
            stopTopicRotations();
            startTopicRotations();
        } else if (tabName === 'situations') {
            situationsTab.classList.add('bg-blue-600', 'text-white');
            situationsTab.classList.remove('text-gray-400');
            difficultyTab.classList.remove('bg-blue-600', 'text-white');
            difficultyTab.classList.add('text-gray-400');
            situationsContent.classList.remove('hidden');
            difficultyContent.classList.add('hidden');

            // Stop difficulty rotations and start situations rotations
            stopTopicRotations();
            startSituationsRotations();
        }
    }

    // --- Toggle Functions ---

    function toggleLessonsVisibility() {
        const isHidden = lessonsContainer.classList.contains('hidden');
        const chevronIcon = toggleLessonsBtn.querySelector('i');

        if (isHidden) {
            lessonsContainer.classList.remove('hidden');
            chevronIcon.style.transform = 'rotate(180deg)';
            // Restart topic rotations when showing lessons
            if (topicRotationIntervals.length === 0) {
                startTopicRotations();
            }
        } else {
            lessonsContainer.classList.add('hidden');
            chevronIcon.style.transform = 'rotate(0deg)';
            // Stop topic rotations when hiding lessons
            stopTopicRotations();
        }

        // Save state when lessons visibility changes
        saveState();
    }

    function toggleHistoryVisibility() {
        const historyContainer = document.getElementById('history-container');
        const isHidden = historyContainer.classList.contains('hidden');
        const chevronIcon = document.getElementById('toggle-history-btn').querySelector('i');

        if (isHidden) {
            historyContainer.classList.remove('hidden');
            chevronIcon.style.transform = 'rotate(180deg)';
            displayLessonHistory();
        } else {
            historyContainer.classList.add('hidden');
            chevronIcon.style.transform = 'rotate(0deg)';
        }
    }

    // --- Topic Rotation Functions ---

    function getRandomTopics(level, count = 4) {
        const topicPools = getTopicPools();
        const pool = topicPools[level] || [];
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    function createTopicButton(topic, level) {
        const button = document.createElement('button');
        let colorClass;

        // Handle difficulty levels
        if (level === 'beginner') {
            colorClass = 'green';
        } else if (level === 'intermediate') {
            colorClass = 'yellow';
        } else if (level === 'advanced') {
            colorClass = 'red';
        }
        // Handle situation types
        else if (level === 'realistic') {
            colorClass = 'blue';
        } else if (level === 'futuristic') {
            colorClass = 'purple';
        } else if (level === 'historical') {
            colorClass = 'amber';
        } else {
            colorClass = 'gray'; // fallback
        }

        button.className = `lesson-btn bg-${colorClass}-600/20 hover:bg-${colorClass}-600/30 text-${colorClass}-300 text-xs py-2 px-3 rounded-md transition-all border border-${colorClass}-600/30`;
        button.setAttribute('data-topic', topic);
        button.textContent = topic;
        button.style.opacity = '0';
        return button;
    }

    function animateTopicsIn(container, topics, level) {
        // Add smooth transition class to container
        container.classList.add('topic-container-transition');

        topics.forEach((topic, index) => {
            setTimeout(() => {
                const button = createTopicButton(topic, level);
                const randomAnimation = animationClasses[Math.floor(Math.random() * animationClasses.length)];
                button.classList.add(randomAnimation);
                container.appendChild(button);

                // Add smooth hover transitions
                button.addEventListener('mouseenter', () => {
                    if (!button.classList.contains('animating')) {
                        button.style.transform = 'translateY(-1px)';
                    }
                });

                button.addEventListener('mouseleave', () => {
                    if (!button.classList.contains('animating')) {
                        button.style.transform = '';
                    }
                });
            }, index * 100); // Faster stagger for smoother feel
        });
    }

    function animateTopicsOut(container) {
        const buttons = container.querySelectorAll('.lesson-btn');

        buttons.forEach((button, index) => {
            setTimeout(() => {
                button.classList.add('animating');
                const randomExitAnimation = exitAnimationClasses[Math.floor(Math.random() * exitAnimationClasses.length)];
                button.classList.add(randomExitAnimation);

                setTimeout(() => {
                    if (button.parentNode) {
                        button.parentNode.removeChild(button);
                    }
                }, 400); // Match the reduced CSS animation duration
            }, index * 50); // Faster staggered exit timing
        });
    }

    function rotateTopics() {
        const containers = {
            beginner: document.getElementById('beginner-container'),
            intermediate: document.getElementById('intermediate-container'),
            advanced: document.getElementById('advanced-container')
        };

        Object.entries(containers).forEach(([level, container], containerIndex) => {
            // Stagger the start of each container's animation for smoother overall effect
            setTimeout(() => {
                animateTopicsOut(container);

                setTimeout(() => {
                    const newTopics = getRandomTopics(level, 4);
                    animateTopicsIn(container, newTopics, level);
                }, 500); // Faster transition overlap
            }, containerIndex * 150); // Reduced stagger timing
        });
    }

    function startTopicRotations() {
        // Initial population with staggered start
        setTimeout(() => {
            rotateTopics();
        }, 500); // Small delay for initial load

        // Set up intervals for each level (8 seconds for smoother experience)
        topicRotationIntervals.push(setInterval(rotateTopics, 8000));
    }

    function rotateSituations() {
        const containers = {
            realistic: document.getElementById('realistic-container'),
            futuristic: document.getElementById('futuristic-container'),
            historical: document.getElementById('historical-container')
        };

        Object.entries(containers).forEach(([situation, container], containerIndex) => {
            // Stagger the start of each container's animation for smoother overall effect
            setTimeout(() => {
                animateTopicsOut(container);

                setTimeout(() => {
                    const newTopics = getRandomSituationTopics(situation, 4);
                    animateTopicsIn(container, newTopics, situation);
                }, 500); // Faster transition overlap
            }, containerIndex * 150); // Reduced stagger timing
        });
    }

    function getRandomSituationTopics(situation, count = 4) {
        const topicPools = getTopicPools();
        const pool = topicPools[situation] || [];
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    function startSituationsRotations() {
        // Initial population with staggered start
        setTimeout(() => {
            rotateSituations();
        }, 500); // Small delay for initial load

        // Set up intervals for each situation (8 seconds for smoother experience)
        topicRotationIntervals.push(setInterval(rotateSituations, 8000));
    }

    function stopTopicRotations() {
        topicRotationIntervals.forEach(interval => clearInterval(interval));
        topicRotationIntervals = [];
    }

    // --- Core Functions ---

    async function initializeLesson() {
        const language = languageSelect.value;
        const topic = topicInput.value;
        const langKey = languageSelect.options[languageSelect.selectedIndex].getAttribute('data-translate');

        if (!topic) {
            alert(translateText('enterTopic'));
            return;
        }

        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            alert(translateText('apiKeyError'));
            return;
        }

        // Clear previous state when starting new lesson
        clearState();

        // Update UI
        loadingSpinner.classList.remove('hidden');
        conversationContainer.innerHTML = '';
        illustrationImg.classList.add('hidden');
        illustrationPlaceholder.classList.remove('hidden');
        imageLoader.classList.add('hidden');

        const prompt = createGeminiPrompt(language, topic);

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_NONE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_NONE"
                        }
                    ]
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            // Find the JSON part and parse it
            const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            lessonPlan = JSON.parse(jsonString);

            // Set speech recognition language
            if (recognition) {
                const langCode = getLangCode(langKey); // USE THE NEW langKey
                recognition.lang = langCode;

                // Special handling for Japanese - add warning if speech recognition may not work well
                if (language === 'Japanese') {
                    console.warn('Japanese speech recognition may have limited accuracy. Consider using the visual verification.');
                }
            }

            // Stop topic rotations when lesson starts
            stopTopicRotations();

            landingScreen.classList.add('hidden');
            lessonScreen.classList.remove('hidden');

            fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
            startConversation();

            // Save initial state
            saveState();

        } catch (error) {
            console.error("Failed to initialize lesson:", error);
            alert(`${translateText('errorLoading')} ${error.message}`);
            landingScreen.classList.remove('hidden');
            lessonScreen.classList.add('hidden');
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }

    function restoreConversation() {
        conversationContainer.innerHTML = ''; // Clear previous conversation
        lessonPlan.dialogue.forEach((turn, index) => {
            const lineDiv = document.createElement('div');
            lineDiv.classList.add('dialogue-line', 'text-white', 'cursor-pointer');
            lineDiv.id = `turn-${index}`;

            // Create the base content with speaker name
            let lineContent = `<strong>${turn.party}:</strong> `;

            if (turn.party === 'A') {
                const displayText = removeParentheses(turn.line.display); // Use line.display
                const sentences = splitIntoSentences(displayText);

                if (sentences.length > 1) {
                    // Multiple sentences - wrap each in a span with ID
                    sentences.forEach((sentence, sentenceIndex) => {
                        lineContent += `<span class="sentence-span" id="turn-${index}-sentence-${sentenceIndex}">${sentence}</span>`;
                        if (sentenceIndex < sentences.length - 1) {
                            lineContent += ' ';
                        }
                    });

                    // Add the original line with translation in parentheses if it exists
                    const originalLine = turn.line.display;
                    if (originalLine.includes('(')) {
                        const translationPart = originalLine.substring(originalLine.indexOf('('));
                        lineContent += ` <span class="translation-part text-gray-400">${translationPart}</span>`;
                    }
                } else {
                    // Single sentence
                    lineContent += `<span class="sentence-span" id="turn-${index}-sentence-0">${displayText}</span>`;
                }
            } else {
                // Partner lines (B) - no sentence splitting needed
                lineContent += turn.line.display;
            }

            lineContent += ` <i class="fas fa-volume-up text-gray-400 ml-2 hover:text-sky-300"></i>`;
            lineDiv.innerHTML = lineContent;

            if (turn.party === 'A') {
                lineDiv.classList.add('user-line');
            } else {
                lineDiv.classList.add('partner-line');
            }

            // Add debounced click listener for audio playback
            lineDiv.addEventListener('click', (e) => {
                playLineAudioDebounced(turn.line.display);
            });

            // Add click listener for explanations
            if (turn.explanation) {
                const explanationSpan = document.createElement('span');
                explanationSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300 ml-6"></i>`;
                explanationSpan.classList.add('explanation-link');
                explanationSpan.onclick = (e) => {
                    e.stopPropagation(); // Prevent audio playback
                    showExplanation(turn.explanation);
                };
                lineDiv.appendChild(explanationSpan);
            }

            conversationContainer.appendChild(lineDiv);
        });
    }

    function restoreIllustration(imageUrl) {
        illustrationPlaceholder.classList.add('hidden');
        imageLoader.classList.add('hidden');
        illustrationImg.src = imageUrl;
        illustrationImg.classList.remove('hidden');
    }

    function startConversation() {
        currentTurnIndex = 0;
        restoreConversation();
        addBackToLandingButton();
        advanceTurn();
    }

    // Global audio state management
    let currentAudio = null;
    let audioDebounceTimer = null;
    let isAudioPlaying = false;

    async function playLineAudio(text) {
        try {
            const cleanText = removeParentheses(text);
            const audioBlob = await fetchPartnerAudio(cleanText);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.playbackRate = parseFloat(audioSpeedSelect.value);

            // Set up audio event listeners
            audio.addEventListener('play', () => {
                isAudioPlaying = true;
                currentAudio = audio;
            });

            audio.addEventListener('ended', () => {
                isAudioPlaying = false;
                currentAudio = null;
                URL.revokeObjectURL(audioUrl);
            });

            audio.addEventListener('error', (error) => {
                console.error("Audio playback failed:", error);
                isAudioPlaying = false;
                currentAudio = null;
                URL.revokeObjectURL(audioUrl);
            });

            audio.play().catch(error => {
                console.error("Audio playback failed:", error);
                isAudioPlaying = false;
                currentAudio = null;
                URL.revokeObjectURL(audioUrl);
            });
        } catch (error) {
            console.error("Failed to fetch audio for playback:", error);
        }
    }

    // Debounced version of playLineAudio
    function playLineAudioDebounced(text) {
        // Clear any existing debounce timer
        if (audioDebounceTimer) {
            clearTimeout(audioDebounceTimer);
        }

        // Stop current audio if playing
        if (currentAudio && isAudioPlaying) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            isAudioPlaying = false;
            currentAudio = null;
        }

        // Set new debounce timer
        audioDebounceTimer = setTimeout(() => {
            playLineAudio(text);
            audioDebounceTimer = null;
        }, 300); // 300ms debounce delay
    }

    // Add variables to track sentence-by-sentence recording
    let currentSentences = [];
    let currentSentenceIndex = 0;
    let speechAttempts = 0;

    // Helper function to split text into sentences
    function splitIntoSentences(text) {
        const currentLanguage = languageSelect.value;

        // For Japanese, use a simpler approach that works better with hiragana
        if (currentLanguage === 'Japanese') {
            // Japanese sentence endings: 。！？です ます た だ
            // Split on major punctuation and common sentence endings
            const japaneseEndings = /[。！？]/;

            if (!japaneseEndings.test(text)) {
                // No clear sentence endings, try splitting on common patterns
                // Look for です、ます、た、だ followed by space or end
                const patterns = /(です|ます|した|だった|たい|ない)(?=[。\s]|$)/g;
                const sentences = [];
                let lastIndex = 0;
                let match;

                while ((match = patterns.exec(text)) !== null) {
                    const endIndex = match.index + match[0].length;
                    const sentence = text.substring(lastIndex, endIndex).trim();
                    if (sentence) {
                        sentences.push(sentence);
                    }
                    lastIndex = endIndex;

                    // Skip any whitespace after the match
                    while (lastIndex < text.length && /\s/.test(text[lastIndex])) {
                        lastIndex++;
                    }
                }

                // Add remaining text
                const remaining = text.substring(lastIndex).trim();
                if (remaining) {
                    sentences.push(remaining);
                }

                return sentences.length > 0 ? sentences : [text.trim()];
            }

            // Split on punctuation for Japanese
            const parts = text.split(/([。！？])/);
            const result = [];

            for (let i = 0; i < parts.length; i += 2) {
                const sentence = parts[i];
                const punctuation = parts[i + 1] || '';
                const fullSentence = sentence + punctuation;
                if (fullSentence.trim()) {
                    result.push(fullSentence.trim());
                }
            }

            return result.length > 0 ? result : [text.trim()];
        }

        // For other languages, handle ellipses and sentence endings properly
        // First, protect ellipses by temporarily replacing them
        const ellipsisPlaceholder = '___ELLIPSIS___';
        const textWithProtectedEllipses = text.replace(/\.{2,}/g, ellipsisPlaceholder);
        
        const sentenceEndings = /[.!?。！？]/;

        if (!sentenceEndings.test(textWithProtectedEllipses)) {
            // Restore ellipses and return as single sentence
            return [text.trim()];
        }

        const sentences = [];
        let currentSentence = '';

        for (let i = 0; i < textWithProtectedEllipses.length; i++) {
            const char = textWithProtectedEllipses[i];
            
            // Check if we're at the start of an ellipsis placeholder
            if (textWithProtectedEllipses.substring(i, i + ellipsisPlaceholder.length) === ellipsisPlaceholder) {
                // Add the original ellipsis back
                const originalEllipsis = text.substring(
                    text.indexOf('...', currentSentence.replace(new RegExp(ellipsisPlaceholder, 'g'), '...').length),
                    text.indexOf('...', currentSentence.replace(new RegExp(ellipsisPlaceholder, 'g'), '...').length) + 
                    (text.match(/\.{2,}/g) || ['...'])[0].length
                );
                currentSentence += originalEllipsis || '...';
                i += ellipsisPlaceholder.length - 1;
                continue;
            }
            
            currentSentence += char;

            if (/[.!?。！？]/.test(char)) {
                let j = i + 1;
                while (j < textWithProtectedEllipses.length && /\s/.test(textWithProtectedEllipses[j])) {
                    currentSentence += textWithProtectedEllipses[j];
                    j++;
                }

                if (currentSentence.trim()) {
                    // Restore any ellipses in the sentence
                    const restoredSentence = currentSentence.replace(new RegExp(ellipsisPlaceholder, 'g'), '...');
                    sentences.push(restoredSentence.trim());
                }
                currentSentence = '';
                i = j - 1;
            }
        }

        if (currentSentence.trim()) {
            // Restore any ellipses in the remaining sentence
            const restoredSentence = currentSentence.replace(new RegExp(ellipsisPlaceholder, 'g'), '...');
            sentences.push(restoredSentence.trim());
        }

        return sentences.length > 0 ? sentences : [text.trim()];
    }

    async function advanceTurn() {
        if (currentTurnIndex >= lessonPlan.dialogue.length) {
            micStatus.textContent = translateText('lessonComplete');
            micBtn.disabled = true;

            // Save completed lesson to history
            const selectedLanguage = languageSelect.value;
            const originalTopic = topicInput.value;
            saveLessonToHistory(lessonPlan, selectedLanguage, originalTopic);

            // Clear state when lesson is complete
            clearState();
            return;
        }

        const currentTurnData = lessonPlan.dialogue[currentTurnIndex];

        // Clear all previous highlighting
        document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));

        const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
        currentLineEl.classList.add('active');
        currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Save state after turn advance
        saveState();

        if (currentTurnData.party === 'A') { // User's turn
            // Split the line into sentences for sentence-by-sentence recording
            const currentLanguage = languageSelect.value;

            // Always use original text for display and sentence splitting
            const cleanText = removeParentheses(currentTurnData.line.display);
            currentSentences = splitIntoSentences(cleanText);
            currentSentenceIndex = 0;

            micBtn.disabled = true;
            micStatus.textContent = translateText('listenFirst');

            try {
                // Stop any currently playing audio before starting new one
                if (currentAudio && isAudioPlaying) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                    isAudioPlaying = false;
                    currentAudio = null;
                }

                // Play user's line first for them to hear
                const audioBlob = await fetchPartnerAudio(cleanText);
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                audio.addEventListener('loadeddata', () => {
                    audio.playbackRate = parseFloat(audioSpeedSelect.value);
                    audio.play().catch(error => {
                        console.error("Audio play failed:", error);
                        enableUserMicForSentence();
                    });
                });

                audio.addEventListener('play', () => {
                    isAudioPlaying = true;
                    currentAudio = audio;
                });

                audio.addEventListener('ended', () => {
                    isAudioPlaying = false;
                    currentAudio = null;
                    URL.revokeObjectURL(audioUrl);
                    enableUserMicForSentence();
                });

                audio.addEventListener('error', (e) => {
                    console.error("Audio error:", e);
                    isAudioPlaying = false;
                    currentAudio = null;
                    URL.revokeObjectURL(audioUrl);
                    enableUserMicForSentence();
                });

            } catch (error) {
                console.error("Failed to fetch user audio:", error);
                enableUserMicForSentence();
            }
        } else { // Partner's turn
            // Reset sentence tracking for partner turns
            currentSentences = [];
            currentSentenceIndex = 0;

            micBtn.disabled = true;
            micStatus.textContent = translateText('partnerSpeaking');
            try {
                const cleanText = removeParentheses(currentTurnData.line.display);
                // Stop any currently playing audio before starting new one
                if (currentAudio && isAudioPlaying) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                    isAudioPlaying = false;
                    currentAudio = null;
                }

                const audioBlob = await fetchPartnerAudio(cleanText);
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Ensure audio loads before playing
                audio.addEventListener('loadeddata', () => {
                    audio.playbackRate = parseFloat(audioSpeedSelect.value);
                    audio.play().catch(error => {
                        console.error("Audio play failed:", error);
                        // Continue to next turn even if audio fails
                        setTimeout(() => {
                            currentTurnIndex++;
                            advanceTurn();
                        }, 2000);
                    });
                });

                audio.addEventListener('play', () => {
                    isAudioPlaying = true;
                    currentAudio = audio;
                });

                audio.addEventListener('ended', () => {
                    isAudioPlaying = false;
                    currentAudio = null;
                    URL.revokeObjectURL(audioUrl);
                    micStatus.textContent = translateText('audioFinished');
                    setTimeout(() => {
                        currentTurnIndex++;
                        advanceTurn();
                    }, 500);
                });

                audio.addEventListener('error', (e) => {
                    console.error("Audio error:", e);
                    isAudioPlaying = false;
                    currentAudio = null;
                    URL.revokeObjectURL(audioUrl);
                    micStatus.textContent = translateText('audioError');
                    setTimeout(async () => {
                        currentTurnIndex++;
                        advanceTurn();
                    }, 1000);
                });

            } catch (error) {
                console.error("Failed to fetch partner audio:", error);
                micStatus.textContent = translateText('audioUnavailable');
                setTimeout(() => {
                    currentTurnIndex++;
                    advanceTurn();
                }, 1500);
            }
        }
    }

    function enableUserMicForSentence() {
        micBtn.disabled = false;

        // Clear previous sentence highlighting
        document.querySelectorAll('.sentence-span.active-sentence').forEach(el => el.classList.remove('active-sentence'));

        if (currentSentences.length > 1) {
            // Highlight the current sentence
            const currentSentenceEl = document.getElementById(`turn-${currentTurnIndex}-sentence-${currentSentenceIndex}`);
            if (currentSentenceEl) {
                currentSentenceEl.classList.add('active-sentence');
            }

            // Show the sentence as it appears in the UI (original text)
            const displaySentence = currentSentenceEl ? currentSentenceEl.textContent : currentSentences[currentSentenceIndex];
            micStatus.innerHTML = `<strong>${translateText('recordSentence')} ${currentSentenceIndex + 1}/${currentSentences.length}:</strong><br><span style="color: #38bdf8; font-weight: bold; text-decoration: underline;">"${displaySentence}"</span>`;
        } else {
            // Single sentence - highlight the entire sentence
            const singleSentenceEl = document.getElementById(`turn-${currentTurnIndex}-sentence-0`);
            if (singleSentenceEl) {
                singleSentenceEl.classList.add('active-sentence');
            }

            micStatus.innerHTML = `<strong>${translateText('yourTurn')}</strong><br><span style="color: #38bdf8; font-style: italic;">Look for the highlighted sentence above</span>`;
        }
    }

    function enableUserMic() {
        micBtn.disabled = false;
        if (currentSentences.length > 1) {
            enableUserMicForSentence();
        } else {
            micStatus.textContent = translateText('yourTurn');
        }
    }

    function removeParentheses(text) {
        return text.replace(/\s*\([^)]*\)/g, '').trim();
    }

    async function verifyUserSpeech(spokenText) {
        try {
            speechAttempts++;
            const currentLanguage = languageSelect.value;
            const currentTurnData = lessonPlan.dialogue[currentTurnIndex];

            if (currentLanguage === 'Japanese' || currentLanguage === 'Korean' || currentLanguage === 'Chinese') {
                micStatus.textContent = translateText('verifyingWithAI');

                // Get the user's native language to localize the feedback
                const nativeLangCode = nativeLang || 'en';
                const langCodeToName = {
                    'en': 'English',
                    'es': 'Spanish',
                    'fr': 'French',
                    'de': 'German',
                    'it': 'Italian',
                    'zh': 'Chinese',
                    'ja': 'Japanese',
                    'ko': 'Korean'
                };
                const nativeLangName = langCodeToName[nativeLangCode] || 'English';

                let expectedLine;
                if (currentSentences.length > 1) {
                    expectedLine = currentSentences[currentSentenceIndex];
                } else {
                    expectedLine = currentTurnData.line.clean_text;
                }

                console.log(`Verifying ${currentLanguage} speech with AI method...`);
                console.log(`Expected sentence: ${expectedLine}`);
                console.log(`Spoken text: ${spokenText}`);

                const verificationPrompt = `
    You are a language evaluation tool. The user's native language is ${nativeLangName}.

    Your task is to determine if a student's spoken text is a correct phonetic match for a given sentence, ignoring punctuation and spacing.

    IMPORTANT CONSIDERATIONS FOR CHINESE:
    - Chinese speech recognition often struggles with technical terms, English words, and mixed content
    - Browser speech recognition for Chinese has significant limitations with tones and pronunciation variations
    - Focus heavily on overall meaning and context rather than exact character matching
    - Be very lenient with technical vocabulary like "人工智能" (AI), "代码" (code), "网页应用" (web application)
    - If the spoken text contains any key concepts from the expected sentence, consider it a match
    - Chinese speech recognition frequently mistranscribes or omits technical terms entirely
    - Accept partial matches if core vocabulary is present, even if grammar or word order differs
    - Consider regional accent variations and pronunciation differences
    - If more than 50% of the core meaning is captured, consider it a successful attempt

    GENERAL CONSIDERATIONS:
    - Be flexible with mixed-language content (e.g., English words/acronyms within other languages)
    - Speech recognition may not capture English letters/acronyms correctly when embedded in other languages
    - Focus on the overall meaning and pronunciation rather than exact character matching
    - If the spoken text captures the main meaning despite missing parts, consider it a match

    Your response MUST be a simple JSON object with two fields:
    1. "is_match": a boolean (true or false). For Chinese, be VERY generous with this assessment.
    2. "feedback": A brief, encouraging explanation; citing, if applicable, what exactly the user got wrong. IMPORTANT: This "feedback" field MUST be written in the user's native language, which is ${nativeLangName}.

    Here is the information for your evaluation:
    - The student was expected to say: "${expectedLine}"
    - The student's speech recognition produced: "${spokenText}"

    Remember: For Chinese learners, speech recognition technology is often inadequate. Be very forgiving and focus on effort and partial understanding.

    Now, provide the JSON response.`;

                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: verificationPrompt }] }],
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ]
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Gemini verification API error: ${response.statusText}`);
                }

                const data = await response.json();
                const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
                const result = JSON.parse(jsonString);

                console.log('Gemini verification result:', result);

                if (result.is_match) {
                    speechAttempts = 0; // Reset attempts on success
                    handleCorrectSpeech();
                } else {
                    // Use the localized feedback from Gemini, with a localized fallback.
                    const feedback = result.feedback || translateText('tryAgain');
                    micStatus.innerHTML = feedback;
                    
                    // Add skip button for Chinese after 3 attempts
                    if (currentLanguage === 'Chinese' && speechAttempts >= 3) {
                        const skipBtn = document.createElement('button');
                        skipBtn.className = 'ml-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm';
                        skipBtn.textContent = '跳过 (Skip)';
                        skipBtn.onclick = () => {
                            speechAttempts = 0;
                            skipBtn.remove();
                            handleCorrectSpeech();
                        };
                        micStatus.appendChild(document.createElement('br'));
                        micStatus.appendChild(skipBtn);
                    }
                    
                    const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
                    currentLineEl.classList.remove('active');
                    void currentLineEl.offsetWidth;
                    currentLineEl.classList.add('active');
                    currentLineEl.style.borderColor = '#f87171';

                    setTimeout(() => {
                        if (currentSentences.length > 1) {
                            enableUserMicForSentence();
                        } else {
                            micStatus.textContent = translateText('tryAgainStatus');
                        }
                        currentLineEl.style.borderColor = '';
                    }, 4000);
                }
            } else {
                // This is the existing logic for Western languages, which remains unchanged.
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
            micStatus.textContent = 'A critical error occurred. Please reset the lesson.';
            micBtn.disabled = true;
        }
    }

    function handleCorrectSpeech() {
        speechAttempts = 0; // Reset attempts when correct
        if (currentSentences.length > 1) {
            // Multi-sentence mode
            currentSentenceIndex++;

            if (currentSentenceIndex >= currentSentences.length) {
                // All sentences completed
                micStatus.textContent = translateText('allSentencesCorrect');
                const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
                currentLineEl.style.borderColor = '#4ade80'; // green-400
                micBtn.disabled = true;
                currentTurnIndex++;
                saveState();
                setTimeout(() => {
                    advanceTurn();
                }, 3000); // CHANGED FROM 1500
            } else {
                // Move to next sentence
                micStatus.textContent = translateText('sentenceCorrect');
                setTimeout(() => {
                    enableUserMicForSentence();
                }, 2500); // CHANGED FROM 1000
            }
        } else {
            // Single sentence mode
            micStatus.textContent = translateText('correct');
            const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
            currentLineEl.style.borderColor = '#4ade80'; // green-400
            micBtn.disabled = true;
            currentTurnIndex++;
            saveState();
            setTimeout(() => {
                advanceTurn();
            }, 3000); // CHANGED FROM 1500
        }
    }

    function handleIncorrectSpeech(similarity, normalizedRequired, normalizedSpoken) {
        // Show debug info to help troubleshoot
        console.log('Speech recognition debug:');
        console.log('Required:', normalizedRequired);
        console.log('Spoken:', normalizedSpoken);
        console.log('Similarity:', (similarity * 100).toFixed(1) + '%');

        const sentenceInfo = currentSentences.length > 1 ?
            ` (Sentence ${currentSentenceIndex + 1}/${currentSentences.length})` : '';

        micStatus.textContent = translateText('tryAgain') + ` (${(similarity * 100).toFixed(0)}% match)${sentenceInfo}`;
        const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
        currentLineEl.classList.remove('active');
        void currentLineEl.offsetWidth;
        currentLineEl.classList.add('active');
        currentLineEl.style.borderColor = '#f87171'; // red-400

        setTimeout(() => {
            if (currentSentences.length > 1) {
                enableUserMicForSentence();
            } else {
                micStatus.textContent = translateText('tryAgainStatus');
            }
            currentLineEl.style.borderColor = '';
        }, 4000); // CHANGED FROM 3000
    }

    function toggleSpeechRecognition() {
        if (isRecognizing) {
            recognition.stop();
        } else {
            // Always set the correct language right before starting recognition.
            try {
                // REPLACE these two lines
                const selectedOption = languageSelect.options[languageSelect.selectedIndex];
                const langKey = selectedOption.getAttribute('data-translate');

                const langCode = getLangCode(langKey); // This now works correctly
                recognition.lang = langCode; 
                console.log(`Setting speech recognition language to: ${langCode}`);
                recognition.start(); 
            } catch (error) {
                console.error('Speech recognition failed to start:', error);
                micStatus.textContent = 'Speech recognition is not supported for this language in your browser.';
            }
        }
    }


    async function fetchPartnerAudio(text) {
        const currentLanguage = languageSelect.value;
        const voiceConfig = getVoiceConfig(currentLanguage);
        
        // Strip parentheses and content before sending to TTS
        const cleanText = removeParentheses(text);

        const response = await fetch(TTS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer wsec_81c54a71adb28dff26425889f84fbdfee3b446707529b33bd0e2a54eb3a43944',
                'Origin': 'https://rolelang.xyz'
            },
            body: JSON.stringify({
                text: cleanText,
                voice_id: voiceConfig.voice_id,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.0,
                    use_speaker_boost: true
                },
                language_code: voiceConfig.language_code
            }),
        });
        if (!response.ok) throw new Error(`TTS API error: ${response.statusText}`);
        return response.blob();
    }

    async function generateImage(prompt, options = {}) {
        const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                imageSize: options.imageSize || 'square_hd',
                numInferenceSteps: options.numInferenceSteps || 60,
                guidanceScale: options.guidanceScale || 12,
                ...options
            })
        });
        const result = await response.json();

        if (result.success) {
            return result;
        } else {
            throw new Error(result.message || 'Image generation failed');
        }
    }

    async function fetchAndDisplayIllustration(prompt) {
        try {
            illustrationPlaceholder.classList.add('hidden');
            imageLoader.classList.remove('hidden');

            // Use enhanced image generation with better options
            const result = await generateImage(`${prompt}, digital art, minimalist, educational illustration`, {
                imageSize: 'square_hd',
                numInferenceSteps: 50,
                guidanceScale: 10
            });

            if (result.imageUrl) {
                console.log('Generated image with seed:', result.seed);

                // Save image URL to lesson plan for state persistence
                if (lessonPlan) {
                    lessonPlan.illustration_url = result.imageUrl;
                    saveState();
                }

                illustrationImg.src = result.imageUrl;
                illustrationImg.onload = () => {
                    imageLoader.classList.add('hidden');
                    illustrationImg.classList.remove('hidden');
                };
                illustrationImg.onerror = () => {
                    showFallbackIllustration();
                };
            } else {
                throw new Error("No image URL returned from API.");
            }
        } catch (error) {
            console.error("Failed to fetch illustration:", error);
            showFallbackIllustration();
        }
    }

    function showFallbackIllustration() {
        imageLoader.classList.add('hidden');
        illustrationPlaceholder.innerHTML = `
          <div class="text-center text-gray-400">
              <i class="fas fa-comments text-6xl mb-4"></i>
              <p class="text-lg">${translateText('roleplayScenario')}</p>
              <p class="text-sm mt-2">${translateText('imageUnavailable')}</p>
          </div>
      `;
        illustrationPlaceholder.classList.remove('hidden');
    }

    function showExplanation(content) {
        modalBody.innerHTML = `<h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3><p class="text-gray-300">${content.body}</p>`;
        modal.classList.remove('hidden');
    }

    // --- Helper Functions ---

    function getLangCode(langKey) {
        return langKeyToCode[langKey] || 'en-US';
    }

    // Function to test voice IDs
    async function testVoiceId(voiceId, languageCode) {
        try {
            const response = await fetch(TTS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer wsec_81c54a71adb28dff26425889f84fbdfee3b446707529b33bd0e2a54eb3a43944',
                    'Origin': 'https://rolelang.xyz'
                },
                body: JSON.stringify({
                    text: "Hello, this is a test.",
                    voice_id: voiceId,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    },
                    language_code: languageCode
                }),
            });
            return response.ok;
        } catch (error) {
            console.error(`Error testing voice ID ${voiceId}:`, error);
            return false;
        }
    }

    // Function to test all voice IDs
    async function testAllVoiceIds() {
        const voiceConfigs = {
            'English': { voice_id: "pNInz6obpgDQGcFmaJgB", language_code: "en" },
            'Spanish': { voice_id: "XrExE9yKIg1WjnnlVkGX", language_code: "es" },
            'French': { voice_id: "ThT5KcBeYPX3keUQqHPh", language_code: "fr" },
            'German': { voice_id: "pNInz6obpgDQGcFmaJgB", language_code: "de" },
            'Italian': { voice_id: "XB0fDUnXU5powFXDhCwa", language_code: "it" },
            'Japanese': { voice_id: "jBpfuIE2acCO8z3wKNLl", language_code: "ja" },
            'Chinese': { voice_id: "2EiwWnXFnvU5JabPnv8n", language_code: "zh" },
            'Korean': { voice_id: "bVMeCyTHy58xNoL34h3p", language_code: "ko" } // Updated Korean voice ID
        };

        console.log("Testing all voice IDs...");
        for (const [language, config] of Object.entries(voiceConfigs)) {
            const isValid = await testVoiceId(config.voice_id, config.language_code);
            console.log(`${language} (${config.voice_id}): ${isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!isValid) {
                console.warn(`Voice ID ${config.voice_id} for ${language} is invalid and needs to be updated`);
            }
        }
    }

    function getVoiceConfig(language) {
        // Updated voice configurations with tested valid IDs
        const voiceConfigs = {
            'English': {
                voice_id: "pNInz6obpgDQGcFmaJgB", // Male English voice
                language_code: "en"
            },
            'Spanish': {
                voice_id: "XrExE9yKIg1WjnnlVkGX", // Male Spanish voice
                language_code: "es"
            },
            'French': {
                voice_id: "ThT5KcBeYPX3keUQqHPh", // Male French voice
                language_code: "fr"
            },
            'German': {
                voice_id: "pNInz6obpgDQGcFmaJgB", // Using reliable English voice for German (multilingual)
                language_code: "de"
            },
            'Italian': {
                voice_id: "XB0fDUnXU5powFXDhCwa", // Male Italian voice
                language_code: "it"
            },
            'Japanese': {
                voice_id: "jBpfuIE2acCO8z3wKNLl", // Male Japanese voice
                language_code: "ja"
            },
            'Chinese': {
                voice_id: "2EiwWnXFnvU5JabPnv8n", // Male Chinese voice
                language_code: "zh"
            },
            'Korean': {
                voice_id: "bVMeCyTHy58xNoL34h3p", // Updated valid Korean voice ID
                language_code: "ko"
            }
        };

        // Return language-specific config or default English voice
        return voiceConfigs[language] || {
            voice_id: "pNInz6obpgDQGcFmaJgB", // Default English voice
            language_code: "en"
        };
    }

    // Add testing function to window for console access
    window.testAllVoiceIds = testAllVoiceIds;

    function createGeminiPrompt(language, topic) {
        const isEnglish = language === 'English';
        const translationInstruction = isEnglish
            ? "The 'display' text should not contain any parenthetical translations."
            : `The 'display' text MUST include a brief, parenthetical English translation. Example: "Bonjour (Hello)".`;

        let lineObjectStructure = `
              - "display": The line of dialogue in ${language}. ${translationInstruction}
              - "clean_text": The line of dialogue in ${language} WITHOUT any parenthetical translations. THIS IS FOR SPEECH RECOGNITION. It must be identical to the "display" text, just without the translation part.
          `;

        if (language === 'Japanese') {
            // Japanese gets a third field for hiragana
            lineObjectStructure += `
              - "hiragana": A pure hiragana version of "clean_text".`;
        }

        // Get user's native language for explanations
        const nativeLangCode = nativeLang || 'en';
        const langCodeToName = {
            'en': 'English',
            'es': 'Spanish', 
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean'
        };
        const nativeLangName = langCodeToName[nativeLangCode] || 'English';

        return `
    You are a language tutor creating a lesson for a web application. Your task is to generate a single, complete, structured lesson plan in JSON format. Do not output any text or explanation outside of the single JSON object.

    The user wants to learn: **${language}**
    The user's native language is: **${nativeLangName}**
    The user-provided topic for the roleplay is: **"${topic}"**

    Follow these steps precisely:

    **STEP 1: Understand the Topic**
    The user's topic above might not be in English. First, internally translate this topic to English to ensure you understand the user's intent. Do not show this translation in your output.

    **STEP 2: Generate the JSON Lesson Plan**
    Now, using your English understanding of the topic, create the lesson plan. The entire generated output must be only the JSON object.

    **JSON STRUCTURE REQUIREMENTS:**

    1.  **Top-Level Keys:** The JSON object must contain these keys: "scenario", "language", "illustration_prompt", "dialogue".

    2.  **Dialogue Object:** Each object in the "dialogue" array must contain:
        - "party": "A" (the user) or "B" (the partner).
        - "line": An object containing the text for the dialogue.
        - "explanation" (optional): An object with a "title" and "body" for grammar tips. IMPORTANT: Both "title" and "body" must be written in the user's native language (${nativeLangName}).

    3.  **Line Object:** The "line" object must contain these exact fields:
        ${lineObjectStructure}

    4.  **Character Names:** You MUST invent realistic, culturally-appropriate fake names for the characters in the dialogue (e.g., "Maria", "Kenji", "Klaus").

    5.  **NO PLACEHOLDERS:** This is a critical rule. Under no circumstances should you use placeholders like "[USER NAME]", "(YOUR NAME)", "<NAME>", or any similar variants. You must use the fake names you chose in RULE 4 instead.

    6.  **EXPLANATION LANGUAGE:** All explanations (title and body) must be written in ${nativeLangName}, not English.

    Now, generate the complete JSON lesson plan.`;
    }

    // Initialize native language detection
    const initializeNativeLanguage = () => {
        // Check if native language is already stored
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
    };

    // Debounce utility
    function debounce(func, wait) {
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

    // Reset lesson to beginning
    function resetLesson() {
        if (!lessonPlan) return;

        // Reset turn index to beginning
        currentTurnIndex = 0;

        // Clear any active states and reset dialogue lines
        document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.dialogue-line').forEach(el => {
            el.style.borderColor = '';
        });

        // Reset mic button state
        micBtn.disabled = false;
        micBtn.classList.remove('bg-green-600');
        micBtn.classList.add('bg-red-600');

        // Reset status message
        micStatus.textContent = translateText('micStatus');

        // Stop any ongoing speech recognition
        if (isRecognizing && recognition) {
            recognition.stop();
        }

        // Save state and restart conversation
        saveState();
        advanceTurn();
    }

    // Add back to landing button functionality
    function addBackToLandingButton() {
        // Check if button already exists
        if (document.getElementById('back-to-landing-btn')) return;

        const backBtn = document.createElement('button');
        backBtn.id = 'back-to-landing-btn';
        backBtn.className = 'absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm';
        backBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i>Back';
        backBtn.onclick = () => {
            // Clear lesson state and return to landing
            clearState();
            lessonPlan = null;
            currentTurnIndex = 0;
            landingScreen.classList.remove('hidden');
            lessonScreen.classList.add('hidden');
            startTopicRotations();
        };

        lessonScreen.appendChild(backBtn);
    }

    // Initialize everything
    initializeNativeLanguage();
    updateTranslations(); // Initial translation update

    // Load saved state
    const savedState = loadState();
    if (savedState) {
        restoreState(savedState);
        if (savedState.currentScreen === 'lesson') {
            addBackToLandingButton();
        }
    } else {
        startTopicRotations();
    }
});
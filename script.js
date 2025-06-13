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

  // --- API & State ---
  // IMPORTANT: Replace with your actual Gemini API Key.
  // It's highly recommended to use a backend proxy to protect this key in a real application.
  const GEMINI_API_KEY = 'AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA'; 
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${GEMINI_API_KEY}`;
  const TTS_API_URL = 'https://langcamp.us/elevenlbs-exchange-audio/exchange-audio';
  const IMAGE_API_URL = 'https://ainovel.site/api/generate-image';

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
          micStatus.textContent = translateText('micStatus');
      };

      recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);

          // Special handling for Japanese and other languages that may not be supported
          const currentLanguage = languageSelect.value;
          if (currentLanguage === 'Japanese' && (event.error === 'language-not-supported' || event.error === 'no-speech')) {
              micStatus.textContent = `Japanese speech recognition unavailable. Compare your speech visually with the text.`;
          } else {
              micStatus.textContent = `Error: ${event.error}. Try again.`;
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
    button.className = `lesson-btn bg-${level === 'beginner' ? 'green' : level === 'intermediate' ? 'yellow' : 'red'}-600/20 hover:bg-${level === 'beginner' ? 'green' : level === 'intermediate' ? 'yellow' : 'red'}-600/30 text-${level === 'beginner' ? 'green' : level === 'intermediate' ? 'yellow' : 'red'}-300 text-xs py-2 px-3 rounded-md transition-all border border-${level === 'beginner' ? 'green' : level === 'intermediate' ? 'yellow' : 'red'}-600/30`;
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

  function stopTopicRotations() {
    topicRotationIntervals.forEach(interval => clearInterval(interval));
    topicRotationIntervals = [];
  }

  // --- Core Functions ---

  async function initializeLesson() {
      const language = languageSelect.value;
      const topic = topicInput.value;

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
            const langCode = getLangCode(language);
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

          let lineContent = `<strong>${turn.party}:</strong> ${turn.line} <i class="fas fa-volume-up text-gray-400 ml-2 hover:text-sky-300"></i>`;

          lineDiv.innerHTML = lineContent;

          if (turn.party === 'A') {
              lineDiv.classList.add('user-line');
          } else {
              lineDiv.classList.add('partner-line');
          }

          // Add debounced click listener for audio playback
          let audioTimeout;
          lineDiv.addEventListener('click', (e) => {
              // Prevent multiple rapid clicks
              if (audioTimeout) return;

              audioTimeout = setTimeout(() => {
                  audioTimeout = null;
              }, 1000);

              playLineAudio(turn.line);
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

  async function playLineAudio(text) {
      try {
          const cleanText = removeParentheses(text);
          const audioBlob = await fetchPartnerAudio(cleanText);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.playbackRate = parseFloat(audioSpeedSelect.value);
          audio.play().catch(error => {
              console.error("Audio playback failed:", error);
          });
      } catch (error) {
          console.error("Failed to fetch audio for playback:", error);
      }
  }

  // Add variables to track sentence-by-sentence recording
  let currentSentences = [];
  let currentSentenceIndex = 0;

  // Helper function to split text into sentences
  function splitIntoSentences(text) {
      // Split by common sentence endings including CJK punctuation, but keep the punctuation
      // Western: .!? | Chinese/Japanese: 。！？ | Korean: .!?
      const sentences = text.split(/([.!?。！？]+\s*)/).filter(s => s.trim().length > 0);
      const result = [];

      for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i];
          const punctuation = sentences[i + 1] || '';
          if (sentence.trim()) {
              result.push((sentence + punctuation).trim());
          }
      }

      return result.length > 0 ? result : [text];
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

      document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
      const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
      currentLineEl.classList.add('active');
      currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Save state after turn advance
      saveState();

      if (currentTurnData.party === 'A') { // User's turn
          // Split the line into sentences for sentence-by-sentence recording
          const cleanText = removeParentheses(currentTurnData.line);
          currentSentences = splitIntoSentences(cleanText);
          currentSentenceIndex = 0;

          micBtn.disabled = true;
          micStatus.textContent = translateText('listenFirst');

          try {
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

              audio.addEventListener('ended', () => {
                  enableUserMicForSentence();
              });

              audio.addEventListener('error', (e) => {
                  console.error("Audio error:", e);
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
              const cleanText = removeParentheses(currentTurnData.line);
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

              audio.addEventListener('ended', () => {
                  micStatus.textContent = translateText('audioFinished');
                  setTimeout(() => {
                      currentTurnIndex++;
                      advanceTurn();
                  }, 500);
              });

              audio.addEventListener('error', (e) => {
                  console.error("Audio error:", e);
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
      if (currentSentences.length > 1) {
          micStatus.textContent = `${translateText('recordSentence')} ${currentSentenceIndex + 1}/${currentSentences.length}: "${currentSentences[currentSentenceIndex]}"`;
      } else {
          micStatus.textContent = translateText('yourTurn');
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
      // Determine what text to compare against
      let requiredText;
      if (currentSentences.length > 1) {
          // Multi-sentence mode: compare against current sentence
          requiredText = currentSentences[currentSentenceIndex];
      } else {
          // Single sentence mode: compare against full line
          requiredText = lessonPlan.dialogue[currentTurnIndex].line.split('(')[0]; // Ignore translation
      }

      const currentLanguage = languageSelect.value;

      // Enhanced normalization function with Gemini conversion for Japanese
      const normalize = async (text) => {
          let normalized = text.trim().toLowerCase()
              .replace(/[.,!?;:"'`´''""。！？]/g, '') // Remove punctuation including Japanese
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/[àáâãäå]/g, 'a')
              .replace(/[èéêë]/g, 'e')
              .replace(/[ìíîï]/g, 'i')
              .replace(/[òóôõö]/g, 'o')
              .replace(/[ùúûü]/g, 'u')
              .replace(/[ñ]/g, 'n')
              .replace(/[ç]/g, 'c');

          // Use Gemini for comprehensive Japanese hiragana conversion
          if (currentLanguage === 'Japanese') {
              normalized = await convertJapaneseToHiraganaWithGemini(normalized);
          }

          return normalized;
      };

      try {
          const normalizedSpoken = await normalize(spokenText);
          const normalizedRequired = await normalize(requiredText);

          // Calculate similarity using Levenshtein distance
          function levenshteinDistance(str1, str2) {
              const matrix = [];
              for (let i = 0; i <= str2.length; i++) {
                  matrix[i] = [i];
              }
              for (let j = 0; j <= str1.length; j++) {
                  matrix[0][j] = j;
              }
              for (let i = 1; i <= str2.length; i++) {
                  for (let j = 1; j <= str1.length; j++) {
                      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                          matrix[i][j] = matrix[i - 1][j - 1];
                  } else {
                      matrix[i][j] = Math.min(
                          matrix[i - 1][j - 1] + 1,
                          matrix[i][j - 1] + 1,
                          matrix[i - 1][j] + 1
                      );
                  }
              }
          }
          return matrix[str2.length][str1.length];
      }

      // Check for exact match first
      if (normalizedSpoken === normalizedRequired) {
          handleCorrectSpeech();
          return;
      }

      // Check for substring match (original logic)
      if (normalizedSpoken.includes(normalizedRequired) || normalizedRequired.includes(normalizedSpoken)) {
          handleCorrectSpeech();
          return;
      }

      // Check similarity using Levenshtein distance
      const distance = levenshteinDistance(normalizedSpoken, normalizedRequired);
      const maxLength = Math.max(normalizedSpoken.length, normalizedRequired.length);
      const similarity = 1 - (distance / maxLength);

      // Accept if similarity is 75% or higher
      if (similarity >= 0.75) {
          handleCorrectSpeech();
      } else {
          handleIncorrectSpeech(similarity, normalizedRequired, normalizedSpoken);
      }
  } catch (error) {
      console.error("Error in verifyUserSpeech:", error);
      micStatus.textContent = translateText('errorVerifying');
  }
  }

  async function convertJapaneseToHiraganaWithGemini(text) {
      try {
          const prompt = `Convert the following Japanese text to hiragana: "${text}". If it's already in hiragana, just return it.`;
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
          const hiraganaText = data.candidates[0].content.parts[0].text.trim();
          return hiraganaText;
      } catch (error) {
          console.error("Failed to convert to hiragana:", error);
          return text; // Return original text on failure
      }
  }

  function handleCorrectSpeech() {
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
              }, 1500);
          } else {
              // Move to next sentence
              micStatus.textContent = translateText('sentenceCorrect');
              setTimeout(() => {
                  enableUserMicForSentence();
              }, 1000);
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
          }, 1500);
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
      }, 3000);
  }

  function toggleSpeechRecognition() {
      if (isRecognizing) {
          recognition.stop();
      } else {
          const currentLanguage = languageSelect.value;

          // Test if the language is supported before starting
          if (currentLanguage === 'Japanese') {
              try {
                  recognition.lang = 'ja';
                  recognition.start();
              } catch (error) {
                  console.error('Japanese speech recognition failed to start:', error);
                  micStatus.textContent = 'Japanese speech recognition not supported in this browser. Use visual comparison.';
                  return;
              }
          } else {
              recognition.start();
          }
      }
  }

  async function fetchPartnerAudio(text) {
      const currentLanguage = languageSelect.value;
      const voiceConfig = getVoiceConfig(currentLanguage);

      const response = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer wsec_81c54a71adb28dff26425889f84fbdfee3b446707529b33bd0e2a54eb3a43944',
              'Origin': 'https://rolelang.xyz'
          },
          body: JSON.stringify({ 
              text: text,
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

  function getLangCode(language) {
      const langCodes = {
          'English': 'en-US',
          'Spanish': 'es-ES', 
          'French': 'fr-FR', 
          'German': 'de-DE',
          'Italian': 'it-IT', 
          'Japanese': 'ja', // Fixed: Use 'ja' instead of 'ja-JP' for better compatibility
          'Chinese': 'zh-CN', 
          'Korean': 'ko-KR'
      };
      return langCodes[language] || 'en-US';
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
          ? "For the user's lines (party A), do not include translations since this is English practice."
          : `For the user's lines (party A), also include the English translation in parentheses. Example: "Bonjour (Hello)".`;

      // Special Japanese script instructions based on difficulty level
      let japaneseScriptInstruction = '';
      if (language === 'Japanese') {
          // Determine difficulty level based on topic
          const topicPools = getTopicPools();
          const beginnerTopics = topicPools.beginner || [];
          const intermediateTopics = topicPools.intermediate || [];

          const isBeginnerTopic = beginnerTopics.some(t => t.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(t.toLowerCase()));
          const isIntermediateTopic = intermediateTopics.some(t => t.toLowerCase().includes(topic.toLowerCase()));

          if (isBeginnerTopic) {
              japaneseScriptInstruction = `
IMPORTANT JAPANESE SCRIPT REQUIREMENTS:
- Write ALL Japanese dialogue using HIRAGANA and KATAKANA only (no kanji, no romaji)
- Use hiragana for native Japanese words
- Use katakana for foreign loanwords
- Example: "こんにちは。コーヒーをください。" NOT "Konnichiwa. Koohii wo kudasai."
- This is a beginner lesson, so keep it simple with kana only.`;
          } else if (isIntermediateTopic) {
              japaneseScriptInstruction = `
IMPORTANT JAPANESE SCRIPT REQUIREMENTS:
- Write Japanese dialogue using appropriate mix of HIRAGANA, KATAKANA, and BASIC KANJI
- Use common kanji for intermediate level (numbers, days, basic verbs/nouns)
- Use hiragana for grammatical particles and verb endings
- Use katakana for foreign loanwords
- Example: "今日はコーヒーを飲みます。" NOT "Kyou wa koohii wo nomimasu."
- NO ROMAJI - only use Japanese scripts.`;
          } else {
              // Advanced
              japaneseScriptInstruction = `
IMPORTANT JAPANESE SCRIPT REQUIREMENTS:
- Write Japanese dialogue using full HIRAGANA, KATAKANA, and KANJI as appropriate for advanced level
- Use complex kanji, compound words, and formal expressions
- Use hiragana for grammatical particles and okurigana
- Use katakana for foreign loanwords and emphasis
- Example: "申し訳ございませんが、今日は営業時間外です。" NOT romaji
- NO ROMAJI - only use Japanese scripts with proper kanji usage.`;
          }
      }

      return `
You are a language tutor creating a lesson for a web application named "RoleLang".
Your task is to generate a complete, structured lesson plan in JSON format. Do not include any explanatory text outside of the JSON structure itself.

The user wants to ${isEnglish ? 'practice' : 'learn'} ${language}.
The roleplaying scenario is: "${topic}".
${japaneseScriptInstruction}

Please generate a JSON object with the following structure:
1.  "scenario": A brief, one-sentence description of the lesson's context.
2.  "language": The language being taught (e.g., "${language}").
3.  "illustration_prompt": A simple, descriptive prompt (5-10 words) for an AI image generator that captures the essence of the lesson. Example: "Two people ordering coffee at a cafe counter".
4.  "dialogue": An array of turn-based dialogue objects.
  - The conversation must involve at least two parties, 'A' (the user) and 'B' (the partner).
  - Each object in the array must have two properties:
      - "party": "A" or "B"
      - "line": The line of dialogue in the target language (${language}). ${language === 'Japanese' ? 'MUST use proper Japanese scripts (hiragana/katakana/kanji) - NO ROMAJI.' : ''} ${translationInstruction}
      - "explanation" (optional): An object with "title" and "body" properties. Include this ONLY when a specific grammar rule, vocabulary word, or cultural note in that line is important to explain. The title should be the concept (e.g., "Gender of Nouns"), and the body should be a concise, simple explanation (1-2 sentences).

Example of required JSON output format:

{
"scenario": "A customer orders a coffee and a croissant at a French café.",
"language": "French",
"illustration_prompt": "Customer at a Parisian cafe counter ordering coffee",
"dialogue": [
  {
    "party": "B",
    "line": "Bonjour! Qu'est-ce que je vous sers?",
    "explanation": {
      "title": "Formal vs. Informal 'You'",
      "body": "In French, 'vous' is the formal way to say 'you', used with strangers or in professional settings. 'Tu' is the informal version for friends and family."
    }
  },
  {
    "party": "A",
    "line": "Bonjour. Je voudrais un café, s'il vous plaît. (Hello. I would like a coffee, please.)"
  },
  {
    "party": "B",
    "line": "Un café. Et avec ceci?"
  },
  {
    "party": "A",
    "line": "Je vais prendre aussi un croissant. (I will also have a croissant.)"
  },
  {
    "party": "B",
    "line": "Très bien. Ça fera 4 euros 50."
  }
]
}

Now, please generate the JSON for the ${language} lesson about "${topic}".`;
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
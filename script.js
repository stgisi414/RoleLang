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

  const modal = document.getElementById('explanation-modal');
  const modalBody = document.getElementById('modal-body');
  const closeModalBtn = document.getElementById('close-modal-btn');

  // Native language dropdown elements
  const nativeLangBtn = document.getElementById('native-lang-btn');
  const nativeLangDropdown = document.getElementById('native-lang-dropdown');
  const nativeFlagEl = document.getElementById('native-flag');
  const nativeLangTextEl = document.getElementById('native-lang-text');

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
      'pt': { code: 'pt', flag: '🇵🇹', name: 'Português' },
      'ru': { code: 'ru', flag: '🇷🇺', name: 'Русский' },
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
    
    // Store in localStorage for persistence
    localStorage.setItem('rolelang_native_lang', JSON.stringify({ code: langCode, flag, name }));
  };

  // Topic pools for each difficulty level
  const topicPools = {
    beginner: [
      "Introducing yourself", "Ordering food at a restaurant", "Asking for directions", "Shopping for clothes",
      "Buying groceries", "Making small talk", "Greeting someone", "Saying goodbye",
      "Asking for the time", "Counting numbers", "Describing the weather", "Talking about family",
      "Ordering coffee", "Buying a bus ticket", "Checking into a hotel", "Asking for help",
      "Exchanging money", "Finding a bathroom", "Ordering at a fast food restaurant", "Buying souvenirs",
      "Asking about prices", "Getting a taxi", "Booking a table", "Asking for WiFi password",
      "Buying medicine", "Getting directions to airport", "Ordering ice cream", "Asking about opening hours",
      "Paying the bill", "Asking for recommendations", "Buying a phone card", "Getting a haircut",
      "Asking about local customs", "Buying flowers", "Getting a newspaper", "Asking for a map",
      "Ordering pizza delivery", "Buying train tickets", "Getting tourist information", "Asking about the menu",
      "Buying postcards", "Getting directions to hospital", "Asking about wi-fi", "Buying shoes",
      "Getting a receipt", "Asking for water", "Buying candy", "Getting help with luggage",
      "Asking about the weather", "Buying a gift", "Getting a room key", "Asking for salt and pepper",
      "Learning basic Chinese greetings", "Ordering dim sum", "Taking a taxi in Beijing", "Buying tea",
      "Asking for Korean BBQ menu", "Learning Korean honorifics", "Using Seoul subway", "Buying kimchi"
    ],
    intermediate: [
      "Job interview conversation", "Making a doctor appointment", "Discussing weekend plans", "Renting an apartment",
      "Complaining about service", "Negotiating prices", "Planning a vacation", "Discussing hobbies",
      "Talking about work", "Making new friends", "Discussing movies", "Planning a party",
      "Talking about health issues", "Discussing education", "Making restaurant reservations", "Talking about sports",
      "Discussing technology", "Planning a business trip", "Talking about relationships", "Discussing current events",
      "Making travel arrangements", "Talking about food preferences", "Discussing cultural differences", "Planning a date",
      "Talking about career goals", "Discussing environmental issues", "Making bank transactions", "Talking about music",
      "Discussing fashion trends", "Planning a move", "Talking about stress", "Discussing exercise routines",
      "Making insurance claims", "Talking about social media", "Discussing home repairs", "Planning a wedding",
      "Talking about investments", "Discussing parenting", "Making hotel complaints", "Talking about photography",
      "Discussing cooking recipes", "Planning retirement", "Talking about mental health", "Discussing online shopping",
      "Making school applications", "Talking about volunteer work", "Discussing transportation", "Planning a reunion",
      "Talking about gardening", "Discussing language learning", "Making warranty claims", "Talking about pets",
      "Discussing Chinese business culture", "Planning Lunar New Year celebration", "Talking about Traditional Chinese Medicine", "Discussing Chinese calligraphy",
      "Learning about Korean work culture", "Discussing K-pop and Korean entertainment", "Talking about Korean festivals", "Planning a trip to Jeju Island"
    ],
    advanced: [
      "Negotiating a business deal", "Discussing politics and current events", "Explaining a complex technical problem", "Debating philosophical concepts",
      "Mediating a workplace conflict", "Presenting a research proposal", "Discussing economic policies", "Analyzing literature",
      "Debating ethical dilemmas", "Explaining scientific theories", "Discussing legal matters", "Analyzing market trends",
      "Debating social issues", "Explaining medical procedures", "Discussing international relations", "Analyzing historical events",
      "Debating environmental policies", "Explaining psychological concepts", "Discussing technological ethics", "Analyzing artistic movements",
      "Debating educational reforms", "Explaining financial strategies", "Discussing cultural anthropology", "Analyzing political systems",
      "Debating healthcare policies", "Explaining quantum physics", "Discussing urban planning", "Analyzing diplomatic negotiations",
      "Debating immigration policies", "Explaining biotechnology", "Discussing sustainable development", "Analyzing corporate governance",
      "Debating artificial intelligence ethics", "Explaining climate science", "Discussing global trade", "Analyzing constitutional law",
      "Debating social justice", "Explaining neuroscience", "Discussing geopolitics", "Analyzing economic inequality",
      "Debating media manipulation", "Explaining genetic engineering", "Discussing space exploration", "Analyzing cultural imperialism",
      "Debating privacy rights", "Explaining renewable energy", "Discussing post-colonial theory", "Analyzing financial derivatives",
      "Debating automation impact", "Explaining machine learning", "Discussing existentialism", "Analyzing global governance",
      "Analyzing Chinese economic development", "Discussing Confucian philosophy", "Debating One Belt One Road initiative", "Explaining Traditional Chinese Medicine principles",
      "Discussing Korean reunification", "Analyzing the Korean Wave (Hallyu)", "Debating Korean chaebols", "Explaining Korean technological advancement"
    ]
  };

  const animationClasses = [
    'topic-animate-in-1', 'topic-animate-in-2', 'topic-animate-in-3', 'topic-animate-in-4',
    'topic-animate-in-5', 'topic-animate-in-6', 'topic-animate-in-7', 'topic-animate-in-8'
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
      micStatus.textContent = "Speech recognition not supported in this browser.";
      micBtn.disabled = true;
  }

  // --- Event Listeners ---
  startLessonBtn.addEventListener('click', initializeLesson);
  micBtn.addEventListener('click', toggleSpeechRecognition);

  // Add event listeners for lesson buttons
  document.addEventListener('click', (event) => {
      if (event.target.classList.contains('lesson-btn')) {
          const topic = event.target.getAttribute('data-topic');
          topicInput.value = topic;
          // Visual feedback
          event.target.style.transform = 'scale(0.95)';
          setTimeout(() => {
              event.target.style.transform = '';
          }, 150);
      }
  });
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
          micStatus.textContent = "Listening...";
      };

      recognition.onend = () => {
          isRecognizing = false;
          micBtn.classList.remove('bg-green-600');
          micBtn.classList.add('bg-red-600');
          micStatus.textContent = "Press the mic and read the highlighted line.";
      };

      recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          micStatus.textContent = `Error: ${event.error}. Try again.`;
      };

      recognition.onresult = (event) => {
          const spokenText = event.results[0][0].transcript;
          micStatus.textContent = `You said: "${spokenText}"`;
          verifyUserSpeech(spokenText);
      };
  }

  // --- Topic Rotation Functions ---
  
  function getRandomTopics(pool, count = 4) {
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
    topics.forEach((topic, index) => {
      setTimeout(() => {
        const button = createTopicButton(topic, level);
        const randomAnimation = animationClasses[Math.floor(Math.random() * animationClasses.length)];
        button.classList.add(randomAnimation);
        container.appendChild(button);
      }, index * 200);
    });
  }
  
  function animateTopicsOut(container) {
    const buttons = container.querySelectorAll('.lesson-btn');
    buttons.forEach((button, index) => {
      setTimeout(() => {
        button.classList.add('topic-animate-out');
        setTimeout(() => {
          if (button.parentNode) {
            button.parentNode.removeChild(button);
          }
        }, 400);
      }, index * 100);
    });
  }
  
  function rotateTopics() {
    const containers = {
      beginner: document.getElementById('beginner-container'),
      intermediate: document.getElementById('intermediate-container'),
      advanced: document.getElementById('advanced-container')
    };
    
    Object.entries(containers).forEach(([level, container]) => {
      animateTopicsOut(container);
      
      setTimeout(() => {
        const newTopics = getRandomTopics(topicPools[level], 4);
        animateTopicsIn(container, newTopics, level);
      }, 800);
    });
  }
  
  function startTopicRotations() {
    // Initial population
    rotateTopics();
    
    // Set up intervals for each level (7.5 seconds)
    topicRotationIntervals.push(setInterval(rotateTopics, 7500));
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
          alert('Please enter a roleplay topic.');
          return;
      }

      if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
          alert('Please replace "YOUR_GEMINI_API_KEY_HERE" in script.js with your actual Gemini API key.');
          return;
      }


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
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
          recognition.lang = getLangCode(language);

          // Stop topic rotations when lesson starts
          stopTopicRotations();

          landingScreen.classList.add('hidden');
          lessonScreen.classList.remove('hidden');

          fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
          startConversation();

      } catch (error) {
          console.error("Failed to initialize lesson:", error);
          alert(`Error loading lesson. Please check the console for details. Error: ${error.message}`);
          landingScreen.classList.remove('hidden');
          lessonScreen.classList.add('hidden');
      } finally {
          loadingSpinner.classList.add('hidden');
      }
  }

  function startConversation() {
      currentTurnIndex = 0;
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
            explanationSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300"></i>`;
            explanationSpan.classList.add('explanation-link');
            explanationSpan.onclick = (e) => {
                e.stopPropagation(); // Prevent audio playback
                showExplanation(turn.explanation);
            };
            lineDiv.appendChild(explanationSpan);
          }

          conversationContainer.appendChild(lineDiv);
      });
      advanceTurn();
  }

  async function playLineAudio(text) {
      try {
          const cleanText = removeParentheses(text);
          const audioBlob = await fetchPartnerAudio(cleanText);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play().catch(error => {
              console.error("Audio playback failed:", error);
          });
      } catch (error) {
          console.error("Failed to fetch audio for playback:", error);
      }
  }

  async function advanceTurn() {
      if (currentTurnIndex >= lessonPlan.dialogue.length) {
          micStatus.textContent = "Lesson complete! 🎉";
          micBtn.disabled = true;
          return;
      }

      const currentTurnData = lessonPlan.dialogue[currentTurnIndex];

      document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));
      const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
      currentLineEl.classList.add('active');
      currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (currentTurnData.party === 'A') { // User's turn
          micBtn.disabled = true;
          micStatus.textContent = "Listen to the example first...";

          try {
              // Play user's line first for them to hear
              const cleanText = removeParentheses(currentTurnData.line);
              const audioBlob = await fetchPartnerAudio(cleanText);
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              audio.addEventListener('loadeddata', () => {
                  audio.play().catch(error => {
                      console.error("Audio play failed:", error);
                      enableUserMic();
                  });
              });

              audio.addEventListener('ended', () => {
                  enableUserMic();
              });

              audio.addEventListener('error', (e) => {
                  console.error("Audio error:", e);
                  enableUserMic();
              });

          } catch (error) {
              console.error("Failed to fetch user audio:", error);
              enableUserMic();
          }
      } else { // Partner's turn
          micBtn.disabled = true;
          micStatus.textContent = "Partner is speaking...";
          try {
              const cleanText = removeParentheses(currentTurnData.line);
              const audioBlob = await fetchPartnerAudio(cleanText);
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              // Ensure audio loads before playing
              audio.addEventListener('loadeddata', () => {
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
                  micStatus.textContent = "Audio finished.";
                  setTimeout(() => {
                      currentTurnIndex++;
                      advanceTurn();
                  }, 500);
              });

              audio.addEventListener('error', (e) => {
                  console.error("Audio error:", e);
                  micStatus.textContent = "Audio error, continuing...";
                  setTimeout(() => {
                      currentTurnIndex++;
                      advanceTurn();
                  }, 1000);
              });

          } catch (error) {
              console.error("Failed to fetch partner audio:", error);
              micStatus.textContent = "Audio unavailable, continuing...";
              setTimeout(() => {
                  currentTurnIndex++;
                  advanceTurn();
              }, 1500);
          }
      }
  }

  function enableUserMic() {
      micBtn.disabled = false;
      micStatus.textContent = "Your turn. Press the mic and read the line.";
  }

  function removeParentheses(text) {
      return text.replace(/\s*\([^)]*\)/g, '').trim();
  }

  function verifyUserSpeech(spokenText) {
      const requiredText = lessonPlan.dialogue[currentTurnIndex].line.split('(')[0]; // Ignore translation
      const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;]/g, '');

      if (normalize(spokenText).includes(normalize(requiredText))) {
          micStatus.textContent = "Correct! Well done.";
          const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
          currentLineEl.style.borderColor = '#4ade80'; // green-400
          micBtn.disabled = true; // Disable mic while transitioning
          currentTurnIndex++;
          setTimeout(() => {
              advanceTurn();
          }, 1500);
      } else {
          micStatus.textContent = "Not quite. Try reading the line again.";
          const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
          currentLineEl.classList.remove('active');
          void currentLineEl.offsetWidth; // Trigger reflow
          currentLineEl.classList.add('active');
          currentLineEl.style.borderColor = '#f87171'; // red-400
          // Allow user to try again immediately
          setTimeout(() => {
              micStatus.textContent = "Press the mic and try again.";
              currentLineEl.style.borderColor = ''; // Reset border color
          }, 2000);
      }
  }

  function toggleSpeechRecognition() {
      if (isRecognizing) {
          recognition.stop();
      } else {
          recognition.start();
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
              <p class="text-lg">Roleplay Scenario</p>
              <p class="text-sm mt-2">Image generation temporarily unavailable</p>
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
          'English': 'en-US', 'Spanish': 'es-ES', 'French': 'fr-FR', 'German': 'de-DE',
          'Italian': 'it-IT', 'Japanese': 'ja-JP', 'Chinese': 'zh-CN', 'Korean': 'ko-KR',
      };
      return langCodes[language] || 'en-US';
  }

  function getVoiceConfig(language) {
      // Language-specific voice configurations for ElevenLabs multilingual_v2
      const voiceConfigs = {
          'English': {
              voice_id: "pNInz6obpgDQGcFmaJgB", // Male English voice
              language_code: "en"
              // Alternative: "EXAVITQu4vr4xnSDxMaL" - Female English voice
          },
          'Spanish': {
              voice_id: "XrExE9yKIg1WjnnlVkGX", // Male Spanish voice
              language_code: "es"
              // Alternative: "VR6AewLTigWG4xSOukaG" - Female Spanish voice
          },
          'French': {
              voice_id: "ThT5KcBeYPX3keUQqHPh", // Male French voice
              language_code: "fr"
              // Alternative: "Xb7hH8MSUJpSbSDYk0k2" - Female French voice
          },
          'German': {
              voice_id: "1VxqO5bMEfZrTtfKpKwa", // Male German voice
              language_code: "de"
              // Alternative: "nPczCjzI2devNBz1zQrb" - Female German voice
          },
          'Italian': {
              voice_id: "XB0fDUnXU5powFXDhCwa", // Male Italian voice
              language_code: "it"
              // Alternative: "jsCqWAovK2LkecY7zXl4" - Female Italian voice
          },
          'Japanese': {
              voice_id: "jBpfuIE2acCO8z3wKNLl", // Male Japanese voice
              language_code: "ja"
              // Alternative: "EXAVITQu4vr4xnSDxMaL" - Female Japanese voice
          },
          'Chinese': {
              voice_id: "2EiwWnXFnvU5JabPnv8n", // Male Chinese voice
              language_code: "zh"
              // Alternative: "AZnzlk1XvdvUeBnXmlld" - Female Chinese voice
          },
          'Korean': {
              voice_id: "0YYGYz8RYnCMXjx9TZE6", // Male Korean voice
              language_code: "ko"
              // Alternative: "ODq5zmih8GrVes37Dizd" - Female Korean voice
          }
      };

      // Return language-specific config or default English voice
      return voiceConfigs[language] || {
          voice_id: "pNInz6obpgDQGcFmaJgB", // Default English voice
          language_code: "en"
      };
  }

  function createGeminiPrompt(language, topic) {
      const isEnglish = language === 'English';
      const translationInstruction = isEnglish 
          ? "For the user's lines (party A), do not include translations since this is English practice."
          : `For the user's lines (party A), also include the English translation in parentheses. Example: "Bonjour (Hello)".`;
      
      return `
You are a language tutor creating a lesson for a web application named "RoleLang".
Your task is to generate a complete, structured lesson plan in JSON format. Do not include any explanatory text outside of the JSON structure itself.

The user wants to ${isEnglish ? 'practice' : 'learn'} ${language}.
The roleplaying scenario is: "${topic}".

Please generate a JSON object with the following structure:
1.  "scenario": A brief, one-sentence description of the lesson's context.
2.  "language": The language being taught (e.g., "${language}").
3.  "illustration_prompt": A simple, descriptive prompt (5-10 words) for an AI image generator that captures the essence of the lesson. Example: "Two people ordering coffee at a cafe counter".
4.  "dialogue": An array of turn-based dialogue objects.
  - The conversation must involve at least two parties, 'A' (the user) and 'B' (the partner).
  - Each object in the array must have two properties:
      - "party": "A" or "B"
      - "line": The line of dialogue in the target language (${language}). ${translationInstruction}
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

  // Initialize everything
  initializeNativeLanguage();
  startTopicRotations();
});
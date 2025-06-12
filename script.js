document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const landingScreen = document.getElementById('landing-screen');
  const lessonScreen = document.getElementById('lesson-screen');
  const startLessonBtn = document.getElementById('start-lesson-btn');
  const languageSelect = document.getElementById('language-select');
  const topicInput = document.getElementById('topic-input');

  const illustrationImg = document.getElementById('lesson-illustration');
  const imageLoader = document.getElementById('image-loader');
  const conversationContainer = document.getElementById('conversation-container');
  const micBtn = document.getElementById('mic-btn');
  const micStatus = document.getElementById('mic-status');
  const loadingSpinner = document.getElementById('loading-spinner');

  const modal = document.getElementById('explanation-modal');
  const modalBody = document.getElementById('modal-body');
  const closeModalBtn = document.querySelector('.close-btn');

  // --- API & State ---
  const GEMINI_API_KEY = 'AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA'; // <-- IMPORTANT: Replace with your key
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${GEMINI_API_KEY}`;
  const TTS_API_URL = 'https://langcamp.us/elevenlbs-exchange-audio/exchange-audio';
  const IMAGE_API_URL = 'https://ainovel.site/api/generate-image';

  let lessonPlan = null;
  let currentTurnIndex = 0;
  let isRecognizing = false;

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
  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', (event) => {
      if (event.target === modal) {
          modal.classList.add('hidden');
      }
  });

  if (recognition) {
      recognition.onstart = () => {
          isRecognizing = true;
          micBtn.classList.add('listening');
          micStatus.textContent = "Listening...";
      };

      recognition.onend = () => {
          isRecognizing = false;
          micBtn.classList.remove('listening');
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

  // --- Core Functions ---

  /**
   * Fetches the lesson plan from Gemini and starts the lesson.
   */
  async function initializeLesson() {
      const language = languageSelect.value;
      const topic = topicInput.value;

      if (!topic) {
          alert('Please enter a roleplay topic.');
          return;
      }

      // Update UI
      landingScreen.classList.add('hidden');
      lessonScreen.classList.remove('hidden');
      loadingSpinner.classList.remove('hidden');
      conversationContainer.innerHTML = '';
      illustrationImg.style.display = 'none';
      imageLoader.style.display = 'block';

      const prompt = createGeminiPrompt(language, topic);

      try {
          const response = await fetch(GEMINI_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          });

          if (!response.ok) {
              throw new Error(`Gemini API error: ${response.statusText}`);
          }

          const data = await response.json();
          const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
          lessonPlan = JSON.parse(jsonString);

          // Set speech recognition language
          recognition.lang = getLangCode(language);

          await fetchAndDisplayIllustration(lessonPlan.illustration_prompt);
          startConversation();

      } catch (error) {
          console.error("Failed to initialize lesson:", error);
          lessonScreen.innerHTML = `<p>Error loading lesson. Please try again. Details: ${error.message}</p>`;
      } finally {
          loadingSpinner.classList.add('hidden');
      }
  }

  /**
   * Starts and displays the conversation from the fetched lesson plan.
   */
  function startConversation() {
      currentTurnIndex = 0;
      lessonPlan.dialogue.forEach((turn, index) => {
          const lineDiv = document.createElement('div');
          lineDiv.classList.add('dialogue-line');
          lineDiv.id = `turn-${index}`;
          lineDiv.innerHTML = `<strong>${turn.party}:</strong> ${turn.line}`;

          if (turn.party === 'A') {
              lineDiv.classList.add('user-line');
          } else {
              lineDiv.classList.add('partner-line');
          }
          conversationContainer.appendChild(lineDiv);
      });
      advanceTurn();
  }

  /**
   * Manages the progression of the conversation.
   */
  async function advanceTurn() {
      if (currentTurnIndex >= lessonPlan.dialogue.length) {
          micStatus.textContent = "Lesson complete! 🎉";
          micBtn.disabled = true;
          return;
      }

      const currentTurnData = lessonPlan.dialogue[currentTurnIndex];

      // Deactivate all previous lines
      document.querySelectorAll('.dialogue-line.active').forEach(el => el.classList.remove('active'));

      // Activate the current line
      const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
      currentLineEl.classList.add('active');
      currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Check for an explanation popup trigger
      if (currentTurnData.explanation) {
          showExplanation(currentTurnData.explanation);
      }

      if (currentTurnData.party === 'A') {
          // It's the user's turn
          micBtn.disabled = false;
          micStatus.textContent = "Your turn. Press the mic and read the line.";
      } else {
          // It's the partner's turn
          micBtn.disabled = true;
          micStatus.textContent = "Partner is speaking...";
          try {
              const audioBlob = await fetchPartnerAudio(currentTurnData.line);
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              audio.play();
              audio.onended = () => {
                  currentTurnIndex++;
                  advanceTurn();
              };
          } catch (error) {
              console.error("Failed to play partner audio:", error);
              // If audio fails, proceed after a short delay
              setTimeout(() => {
                  currentTurnIndex++;
                  advanceTurn();
              }, 1000);
          }
      }
  }

  /**
   * Verifies the user's spoken words against the required text.
   */
  function verifyUserSpeech(spokenText) {
      const requiredText = lessonPlan.dialogue[currentTurnIndex].line;

      // Simple normalization for comparison
      const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;]/g, '');

      if (normalize(spokenText).includes(normalize(requiredText))) {
          micStatus.textContent = "Correct! Well done.";
          currentTurnIndex++;
          setTimeout(advanceTurn, 1500); // Give user time to read feedback
      } else {
          micStatus.textContent = "Not quite. Try reading the line again.";
          const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
          currentLineEl.style.transition = 'none';
          currentLineEl.style.backgroundColor = '#ffcdd2'; // Highlight error
          setTimeout(() => {
              currentLineEl.style.backgroundColor = '';
              currentLineEl.style.transition = 'background-color 0.3s';
          }, 1000);
      }
  }

  /**
   * Starts or stops the speech recognition service.
   */
  function toggleSpeechRecognition() {
      if (isRecognizing) {
          recognition.stop();
      } else {
          recognition.start();
      }
  }

  /**
   * Fetches the partner's line as audio from the TTS API.
   */
  async function fetchPartnerAudio(text) {
      const response = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
      });
      if (!response.ok) {
          throw new Error(`TTS API error: ${response.statusText}`);
      }
      return response.blob();
  }

  /**
   * Fetches an illustration from the image generation API.
   */
  async function fetchAndDisplayIllustration(prompt) {
      try {
          imageLoader.style.display = 'block';
          illustrationImg.style.display = 'none';
          const response = await fetch(IMAGE_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: `${prompt}, digital art` }),
          });
          if (!response.ok) throw new Error(`Image API error: ${response.statusText}`);
          const data = await response.json();
          if (data.imageUrl) {
              illustrationImg.src = data.imageUrl;
              illustrationImg.onload = () => {
                  imageLoader.style.display = 'none';
                  illustrationImg.style.display = 'block';
              }
          } else {
               throw new Error("No image URL returned from API.");
          }
      } catch (error) {
          console.error("Failed to fetch illustration:", error);
          imageLoader.style.display = 'none'; // Hide loader even if it fails
      }
  }

  /**
   * Displays the explanation modal with content from Gemini.
   */
  function showExplanation(content) {
      modalBody.innerHTML = `<h3>${content.title}</h3><p>${content.body}</p>`;
      modal.classList.remove('hidden');
  }

  // --- Helper Functions ---

  /**
   * Gets the BCP 47 language code for the Web Speech API.
   */
  function getLangCode(language) {
      const langCodes = {
          'Spanish': 'es-ES',
          'French': 'fr-FR',
          'German': 'de-DE',
          'Italian': 'it-IT',
          'Japanese': 'ja-JP',
      };
      return langCodes[language] || 'en-US';
  }

  /**
   * Creates the structured prompt for the Gemini API.
   */
  function createGeminiPrompt(language, topic) {
      return `
You are a language tutor creating a lesson for a web application named "RoleLang".
Your task is to generate a complete, structured lesson plan in JSON format. Do not include any explanatory text outside of the JSON structure itself.

The user wants to learn ${language}.
The roleplaying scenario is: "${topic}".

Please generate a JSON object with the following structure:
1.  "scenario": A brief, one-sentence description of the lesson's context.
2.  "language": The language being taught (e.g., "${language}").
3.  "illustration_prompt": A simple, descriptive prompt (5-10 words) for an AI image generator that captures the essence of the lesson. This will be used to create a visual aid. Example: "Two people ordering coffee at a cafe counter".
4.  "dialogue": An array of turn-based dialogue objects.
  - The conversation must involve at least two parties, 'A' (the user) and 'B' (the partner). It can sometimes include 'C' or 'D'.
  - Each object in the array represents one line of dialogue and must have three properties:
      - "party": "A", "B", "C", etc.
      - "line": The line of dialogue in the target language (${language}). For the user's lines (party A), also include the English translation in parentheses. Example: "Bonjour (Hello)".
      - "explanation" (optional): An object with "title" and "body" properties. Include this ONLY when a specific grammar rule, vocabulary word, or cultural note in that line is important to explain. The title should be the concept (e.g., "Gender of Nouns"), and the body should be a concise, simple explanation (1-2 sentences). Trigger this on the line where the concept is first introduced.

Here is an example of the required JSON output format:

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
    "line": "Je vais prendre aussi un croissant. (I will also have a croissant.)",
    "explanation": {
      "title": "Vocabulary: 'un croissant'",
      "body": "'Un' is the masculine singular article for 'a' or 'an'. 'Croissant' is a masculine noun, so we use 'un croissant'."
    }
  },
  {
    "party": "B",
    "line": "Très bien. Ça fera 4 euros 50."
  }
]
}

Now, please generate the JSON for the ${language} lesson about "${topic}".
`;
  }
});
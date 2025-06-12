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

  // --- API & State ---
  // IMPORTANT: Replace with your actual Gemini API Key.
  // It's highly recommended to use a backend proxy to protect this key in a real application.
  const GEMINI_API_KEY = 'AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA'; 
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
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
  modal.addEventListener('click', (event) => {
      // Close modal if clicking on the backdrop
      if (event.target === modal) {
          modal.classList.add('hidden');
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
          lineDiv.classList.add('dialogue-line', 'text-white');
          lineDiv.id = `turn-${index}`;

          let lineContent = `<strong>${turn.party}:</strong> ${turn.line}`;

          lineDiv.innerHTML = lineContent;

          if (turn.party === 'A') {
              lineDiv.classList.add('user-line');
          } else {
              lineDiv.classList.add('partner-line');
          }

          // Add click listener for explanations
          if (turn.explanation) {
            const explanationSpan = document.createElement('span');
            explanationSpan.innerHTML = ` <i class="fas fa-info-circle text-sky-300"></i>`;
            explanationSpan.classList.add('explanation-link');
            explanationSpan.onclick = () => showExplanation(turn.explanation);
            lineDiv.appendChild(explanationSpan);
          }

          conversationContainer.appendChild(lineDiv);
      });
      advanceTurn();
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
          micBtn.disabled = false;
          micStatus.textContent = "Your turn. Press the mic and read the line.";
      } else { // Partner's turn
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
              setTimeout(() => {
                  currentTurnIndex++;
                  advanceTurn();
              }, 1000);
          }
      }
  }

  function verifyUserSpeech(spokenText) {
      const requiredText = lessonPlan.dialogue[currentTurnIndex].line.split('(')[0]; // Ignore translation
      const normalize = (text) => text.trim().toLowerCase().replace(/[.,!?;]/g, '');

      if (normalize(spokenText).includes(normalize(requiredText))) {
          micStatus.textContent = "Correct! Well done.";
          document.getElementById(`turn-${currentTurnIndex}`).style.borderColor = '#4ade80'; // green-400
          currentTurnIndex++;
          setTimeout(advanceTurn, 1500);
      } else {
          micStatus.textContent = "Not quite. Try reading the line again.";
          const currentLineEl = document.getElementById(`turn-${currentTurnIndex}`);
          currentLineEl.classList.remove('active');
          void currentLineEl.offsetWidth; // Trigger reflow
          currentLineEl.classList.add('active');
          currentLineEl.style.borderColor = '#f87171'; // red-400
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
      const response = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
      });
      if (!response.ok) throw new Error(`TTS API error: ${response.statusText}`);
      return response.blob();
  }

  async function fetchAndDisplayIllustration(prompt) {
      try {
          illustrationPlaceholder.classList.add('hidden');
          imageLoader.classList.remove('hidden');
          const response = await fetch(IMAGE_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: `${prompt}, digital art, minimalist` }),
          });
          if (!response.ok) throw new Error(`Image API error: ${response.statusText}`);
          const data = await response.json();
          if (data.imageUrl) {
              illustrationImg.src = data.imageUrl;
              illustrationImg.onload = () => {
                  imageLoader.classList.add('hidden');
                  illustrationImg.classList.remove('hidden');
              }
          } else {
               throw new Error("No image URL returned from API.");
          }
      } catch (error) {
          console.error("Failed to fetch illustration:", error);
          imageLoader.classList.add('hidden');
          illustrationPlaceholder.classList.remove('hidden');
      }
  }

  function showExplanation(content) {
      modalBody.innerHTML = `<h3 class="text-xl font-bold mb-2 text-cyan-300">${content.title}</h3><p class="text-gray-300">${content.body}</p>`;
      modal.classList.remove('hidden');
  }

  // --- Helper Functions ---

  function getLangCode(language) {
      const langCodes = {
          'Spanish': 'es-ES', 'French': 'fr-FR', 'German': 'de-DE',
          'Italian': 'it-IT', 'Japanese': 'ja-JP',
      };
      return langCodes[language] || 'en-US';
  }

  function createGeminiPrompt(language, topic) {
      return `
You are a language tutor creating a lesson for a web application named "RoleLang".
Your task is to generate a complete, structured lesson plan in JSON format. Do not include any explanatory text outside of the JSON structure itself.

The user wants to learn ${language}.
The roleplaying scenario is: "${topic}".

Please generate a JSON object with the following structure:
1.  "scenario": A brief, one-sentence description of the lesson's context.
2.  "language": The language being taught (e.g., "${language}").
3.  "illustration_prompt": A simple, descriptive prompt (5-10 words) for an AI image generator that captures the essence of the lesson. Example: "Two people ordering coffee at a cafe counter".
4.  "dialogue": An array of turn-based dialogue objects.
  - The conversation must involve at least two parties, 'A' (the user) and 'B' (the partner).
  - Each object in the array must have two properties:
      - "party": "A" or "B"
      - "line": The line of dialogue in the target language (${language}). For the user's lines (party A), also include the English translation in parentheses. Example: "Bonjour (Hello)".
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
});
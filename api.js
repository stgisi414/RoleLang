// --- API & State ---
// IMPORTANT: Replace with your actual Gemini API Key.
const GEMINI_API_KEY = 'AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA';
const GEMINI_MODELS = {
    'ultra': 'gemini-2.5-flash-preview-05-20',
    'super': 'gemini-2.0-flash',
    'pro': 'gemini-2.0-flash-thinking-exp-01-21',
    'lite': 'gemini-2.0-flash-lite'
};
const TTS_API_URL = 'https://langcamp.us/elevenlbs-exchange-audio/exchange-audio';
const IMAGE_API_URL = 'https://ainovel.site/api/generate-image';

/**
 * A robust, central function for calling the Gemini API with retries and model fallbacks.
 * @param {string} prompt The prompt to send to the API.
 * @param {object} options Configuration options for the API call.
 * @returns {Promise<object>} The JSON response from the API.
 */
export async function callGeminiAPI(prompt, options = {}) {
    const {
        modelPreference = 'pro',
        retryAttempts = 3,
        safetySettings = [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    } = options;

    const modelPriority = [
        modelPreference,
        ...Object.keys(GEMINI_MODELS).filter(key => key !== modelPreference)
    ];

    let lastError = null;

    for (const modelKey of modelPriority) {
        const modelName = GEMINI_MODELS[modelKey];
        if (!modelName) continue;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        safetySettings: safetySettings
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                    throw new Error('Invalid response structure from Gemini API');
                }
                return data;
            } catch (error) {
                console.warn(`Attempt ${attempt} failed for model ${modelName}:`, error.message);
                lastError = error;
                if (attempt < retryAttempts) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
    }
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fetches audio from the ElevenLabs TTS API.
 * @param {string} text The text to convert to speech.
 * @param {object} voiceConfig The voice configuration object.
 * @returns {Promise<Blob>} The audio data as a Blob.
 */
export async function fetchPartnerAudio(text, voiceConfig) {
    const cleanText = text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer wsec_81c54a71adb28dff26425889f84fbdfee3b446707529b33bd0e2a54eb3a43944', // Replace with your key
            'Origin': 'https://rolelang.xyz'
        },
        body: JSON.stringify({
            text: cleanText,
            voice_id: voiceConfig.voice_id,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
            language_code: voiceConfig.language_code
        }),
    });
    if (!response.ok) throw new Error(`TTS API error: ${response.statusText}`);
    return response.blob();
}

/**
 * Generates an image using your custom image generation API.
 * @param {string} prompt The prompt for the image.
 * @param {object} options Additional options for image generation.
 * @returns {Promise<object>} The JSON response from the image API.
 */
export async function generateImage(prompt, options = {}) {
    const response = await fetch(IMAGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: prompt,
            imageSize: options.imageSize || 'square_hd',
            numInferenceSteps: options.numInferenceSteps || 50,
            guidanceScale: options.guidanceScale || 10,
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
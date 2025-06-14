
// Skip words configuration for all supported languages
// These are short interjections that should be grouped with the next sentence
const skipWords = {
  'English': [
    'oh', 'ah', 'um', 'uh', 'wow', 'hey', 'yes', 'no', 'ok', 'okay', 'well', 'so', 'but', 'and', 'or', 'hmm', 'hm', 'eh', 'er', 'erm'
  ],
  'Spanish': [
    'oh', 'ah', 'eh', 'ay', 'uy', 'sí', 'no', 'pues', 'pero', 'y', 'o', 'bueno', 'vale', 'oye', 'vaya', 'mmm', 'em', 'este', 'ese'
  ],
  'French': [
    'oh', 'ah', 'eh', 'euh', 'heu', 'oui', 'non', 'bon', 'alors', 'mais', 'et', 'ou', 'bah', 'bof', 'hein', 'tiens', 'voilà', 'pfff'
  ],
  'German': [
    'oh', 'ah', 'eh', 'äh', 'ähm', 'ja', 'nein', 'nun', 'also', 'aber', 'und', 'oder', 'so', 'na', 'naja', 'ach', 'tja', 'hmm'
  ],
  'Italian': [
    'oh', 'ah', 'eh', 'ehm', 'sì', 'no', 'beh', 'boh', 'ma', 'e', 'o', 'allora', 'però', 'ecco', 'dai', 'mah', 'mmm', 'bene'
  ],
  'Japanese': [
    'あ', 'ああ', 'え', 'ええ', 'う', 'うん', 'はい', 'いいえ', 'そう', 'でも', 'えと', 'あの', 'その', 'まあ', 'へえ', 'ほう', 'ふーん'
  ],
  'Chinese': [
    '啊', '哦', '嗯', '呃', '额', '是', '不', '但是', '还有', '那个', '这个', '嗯嗯', '呵呵', '哈哈', '唉', '咦', '哇', '嗨'
  ],
  'Korean': [
    '아', '어', '음', '네', '예', '아니', '그런데', '하지만', '그리고', '또', '이제', '그럼', '뭐', '좀', '참', '와', '어머'
  ]
};

// Function to check if a spoken text is a skip word
function isSkipWord(text, language) {
  if (!skipWords[language]) return false;
  
  const normalizedText = text.trim().toLowerCase();
  const languageSkipWords = skipWords[language].map(word => word.toLowerCase());
  
  return languageSkipWords.includes(normalizedText);
}

// Function to check if text should be grouped with next sentence
function shouldGroupWithNext(text, language) {
  // Check if it's a skip word
  if (isSkipWord(text, language)) return true;
  
  // Check if it's very short (1-3 characters for most languages)
  const trimmed = text.trim();
  if (trimmed.length <= 3) return true;
  
  // For Asian languages, check character count differently
  if (['Japanese', 'Chinese', 'Korean'].includes(language)) {
    // For CJK languages, 1-2 characters might be skip words
    if (trimmed.length <= 2) return true;
  }
  
  return false;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { skipWords, isSkipWord, shouldGroupWithNext };
}

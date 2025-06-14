
// Stop words for different languages - short interjections that should be grouped with the next sentence
const STOP_WORDS = {
  en: [
    // English interjections and short words
    'oh', 'ah', 'um', 'uh', 'hmm', 'wow', 'hey', 'hi', 'yes', 'no', 'ok', 'okay', 'well', 'so', 'but', 'and',
    'the', 'a', 'an', 'i', 'you', 'we', 'he', 'she', 'it', 'my', 'me', 'us', 'to', 'is', 'am', 'are', 'was',
    'ooh', 'ahh', 'huh', 'eh', 'yo', 'bye', 'see', 'go', 'up', 'on', 'in', 'at', 'of', 'or', 'if', 'be'
  ],
  es: [
    // Spanish interjections and short words
    'ah', 'oh', 'eh', 'ay', 'uy', 'hm', 'mm', 'sí', 'no', 'ya', 'pues', 'pero', 'que', 'qué', 'como', 'cómo',
    'el', 'la', 'un', 'una', 'yo', 'tú', 'él', 'por', 'con', 'del', 'los', 'las', 'mis', 'sus', 'nos', 'les',
    'oye', 'ey', 'aja', 'ajá', 'ujú', 'ups', 'ay no', 'órale', 'ey', 'va', 'es', 'son', 'era', 'fue', 'ser'
  ],
  fr: [
    // French interjections and short words
    'ah', 'oh', 'eh', 'hm', 'mm', 'euh', 'bah', 'bon', 'ben', 'oui', 'non', 'si', 'ça', 'que', 'qui', 'où',
    'le', 'la', 'un', 'une', 'je', 'tu', 'il', 'de', 'du', 'des', 'les', 'mes', 'ses', 'nos', 'vous', 'ils',
    'hélas', 'zut', 'tut', 'hop', 'hep', 'hé', 'ho', 'ha', 'hi', 'hu', 'et', 'ou', 'au', 'aux', 'ce', 'se'
  ],
  de: [
    // German interjections and short words
    'ah', 'oh', 'eh', 'äh', 'öh', 'hm', 'mm', 'ja', 'nein', 'na', 'so', 'nun', 'und', 'der', 'die', 'das',
    'ein', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mit', 'von', 'den', 'dem', 'des', 'zu', 'im', 'am',
    'ach', 'aha', 'huch', 'ups', 'hm', 'tja', 'puh', 'hui', 'hei', 'au', 'ei', 'ui', 'oj', 'bei', 'für'
  ],
  it: [
    // Italian interjections and short words
    'ah', 'oh', 'eh', 'beh', 'mah', 'boh', 'uhm', 'ehm', 'sì', 'no', 'che', 'chi', 'cosa', 'dove', 'quando',
    'il', 'la', 'un', 'una', 'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'del', 'dei', 'con', 'per', 'tra', 'fra',
    'ahi', 'uff', 'ops', 'uau', 'wow', 'hey', 'ciao', 'dai', 'su', 'giù', 'qua', 'qui', 'là', 'lì', 'ma', 'se'
  ],
  ja: [
    // Japanese interjections and particles
    'あ', 'ああ', 'うん', 'はい', 'いいえ', 'ええ', 'うーん', 'あの', 'その', 'この', 'どの', 'まあ', 'ねえ',
    'は', 'が', 'を', 'に', 'で', 'と', 'か', 'も', 'の', 'へ', 'や', 'よ', 'ね', 'な', 'だ', 'です', 'である',
    'えー', 'あー', 'うー', 'おー', 'わー', 'へー', 'ほー', 'ふー', 'ひー', 'そう', 'はあ', 'ほう', 'ふむ'
  ],
  zh: [
    // Chinese interjections and particles
    '啊', '哦', '呃', '嗯', '哼', '呢', '吧', '了', '的', '是', '在', '有', '个', '我', '你', '他', '她', '它',
    '这', '那', '什么', '怎么', '为什么', '哪里', '谁', '和', '或', '但', '如果', '因为', '所以', '然后', '还有',
    '哎', '哇', '嘿', '喂', '唉', '咦', '哟', '嗨', '额', '呀', '哈', '嘻', '呵', '咳', '嗤', '嘘', '吁'
  ],
  ko: [
    // Korean interjections and particles
    '아', '어', '오', '우', '에', '음', '네', '예', '아니', '그', '이', '저', '요', '는', '은', '이', '가', '을',
    '를', '에', '서', '로', '으로', '와', '과', '나', '이나', '든지', '거나', '도', '만', '부터', '까지', '한테',
    '아이고', '어머', '이런', '저런', '그런', '어떤', '무슨', '뭔', '언제', '어디', '누구', '뭐', '왜', '어떻게'
  ]
};

// Function to check if a sentence is a stop word or very short
function isStopWord(sentence, language) {
  if (!sentence || sentence.length === 0) return false;
  
  const langCode = getLanguageCode(language);
  const stopWords = STOP_WORDS[langCode] || STOP_WORDS.en;
  
  // Normalize the sentence for comparison
  const normalized = sentence.toLowerCase().replace(/[.,!?;:"'`´''""。！？]/g, '').trim();
  
  // Check if it's a stop word
  if (stopWords.includes(normalized)) return true;
  
  // Check if it's very short (1-3 characters for most languages, 1-2 for CJK)
  const maxLength = (langCode === 'ja' || langCode === 'zh' || langCode === 'ko') ? 2 : 3;
  return normalized.length <= maxLength;
}

// Helper function to get language code from language name
function getLanguageCode(language) {
  const langMap = {
    'English': 'en',
    'Spanish': 'es', 
    'French': 'fr',
    'German': 'de',
    'Italian': 'it',
    'Japanese': 'ja',
    'Chinese': 'zh',
    'Korean': 'ko'
  };
  return langMap[language] || 'en';
}

// Function to group stop words with following sentences
function groupStopWordsWithNext(sentences, language) {
  if (sentences.length <= 1) return sentences;
  
  const grouped = [];
  let i = 0;
  
  while (i < sentences.length) {
    let currentSentence = sentences[i];
    
    // If current sentence is a stop word and there's a next sentence, combine them
    if (isStopWord(currentSentence, language) && i + 1 < sentences.length) {
      currentSentence += ' ' + sentences[i + 1];
      i += 2; // Skip the next sentence since we combined it
    } else {
      i += 1;
    }
    
    grouped.push(currentSentence);
  }
  
  return grouped;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STOP_WORDS, isStopWord, getLanguageCode, groupStopWordsWithNext };
}


// Skip words configuration for RoleLang
// These are short interjections that should be grouped with the next sentence
// because microphone/speech recognition often fails to pick them up properly

const skipWords = {
  English: [
    // Common interjections
    "oh", "ah", "um", "uh", "er", "eh", "hm", "mm", "hmm",
    // Exclamations
    "wow", "hey", "hi", "yo", "ok", "no", "yes", "well",
    // Sounds
    "shh", "pst", "tsk", "huh", "duh", "bah", "meh", "pfft",
    // Short responses
    "so", "but", "and", "or", "if", "as", "to", "in", "at", "on"
  ],
  
  Spanish: [
    // Spanish interjections
    "oh", "ah", "eh", "ay", "uy", "ey", "mm", "hm", "em",
    // Exclamations
    "oye", "hola", "sí", "no", "ya", "pues", "bueno", "vale",
    // Sounds
    "tsk", "bah", "uf", "pfft", "shh", "pst", "auch",
    // Short connectors
    "y", "o", "pero", "si", "que", "de", "en", "por", "con", "sin"
  ],
  
  French: [
    // French interjections
    "oh", "ah", "euh", "heu", "hm", "mm", "eh", "bah", "tsk",
    // Exclamations
    "bon", "oui", "non", "ben", "bof", "ouais", "salut", "hé",
    // Sounds
    "pfft", "chut", "aïe", "ouf", "zut", "tiens", "dis",
    // Short connectors
    "et", "ou", "si", "mais", "de", "le", "la", "en", "du", "au"
  ],
  
  German: [
    // German interjections
    "oh", "ah", "äh", "ähm", "hm", "mm", "eh", "na", "tja",
    // Exclamations
    "ja", "nein", "gut", "hallo", "hey", "so", "nun", "also",
    // Sounds
    "ach", "och", "oje", "huch", "ups", "pst", "shh", "bah",
    // Short connectors
    "und", "oder", "aber", "wenn", "als", "zu", "in", "an", "auf", "mit"
  ],
  
  Italian: [
    // Italian interjections
    "oh", "ah", "eh", "mh", "hm", "mm", "boh", "beh", "mah",
    // Exclamations
    "sì", "no", "ciao", "ehi", "dai", "bene", "ecco", "allora",
    // Sounds
    "uffa", "bah", "tsk", "shh", "pst", "ahimè", "ahi", "ohi",
    // Short connectors
    "e", "o", "ma", "se", "che", "di", "in", "con", "per", "da"
  ],
  
  Japanese: [
    // Japanese interjections
    "あ", "え", "お", "う", "ん", "んー", "えー", "あー", "おー",
    // Exclamations
    "はい", "いえ", "そう", "ええ", "うん", "まあ", "じゃあ", "では",
    // Sounds
    "えと", "あの", "その", "この", "どの", "へえ", "ほお", "ふう",
    // Particles (often missed)
    "は", "が", "を", "に", "で", "と", "や", "か", "も", "の"
  ],
  
  Chinese: [
    // Chinese interjections
    "哦", "啊", "呃", "嗯", "唔", "嘿", "咦", "哎", "诶",
    // Exclamations
    "是", "不", "好", "对", "嗯", "哈", "喂", "嘛", "呀",
    // Sounds
    "哼", "呸", "嘘", "切", "哟", "嗨", "噢", "唉", "嗳",
    // Short connectors
    "和", "或", "但", "如", "若", "就", "都", "也", "还", "又"
  ],
  
  Korean: [
    // Korean interjections
    "아", "어", "오", "우", "으", "음", "응", "에", "이",
    // Exclamations
    "네", "아니", "그래", "좋아", "와", "어머", "아이고", "어라",
    // Sounds
    "흠", "음", "어", "에", "헉", "아", "오", "우", "어이",
    // Particles (often missed)
    "은", "는", "이", "가", "을", "를", "에", "의", "도", "만"
  ]
};

// Function to check if a sentence is a skip word
function isSkipWord(sentence, language) {
  if (!sentence || !language) return false;
  
  const languageSkipWords = skipWords[language] || skipWords.English;
  const cleanSentence = sentence.trim().toLowerCase()
    .replace(/[.,!?;:"'`´''""。！？]/g, '')
    .replace(/\s+/g, ' ');
  
  return languageSkipWords.includes(cleanSentence);
}

// Function to group skip words with the next sentence
function groupSkipWords(sentences, language) {
  if (!sentences || sentences.length === 0) return sentences;
  
  const grouped = [];
  let i = 0;
  
  while (i < sentences.length) {
    let currentSentence = sentences[i];
    
    // Check if current sentence is a skip word
    if (isSkipWord(currentSentence, language) && i + 1 < sentences.length) {
      // Combine with next sentence
      const nextSentence = sentences[i + 1];
      currentSentence = `${currentSentence} ${nextSentence}`;
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
  module.exports = { skipWords, isSkipWord, groupSkipWords };
}

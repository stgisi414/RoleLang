
// Stop words for RoleLang - Short interjections that should be grouped with following sentences
// These are typically 1-3 character words that microphones have trouble detecting on their own

const stopWords = {
  English: [
    // Basic interjections
    'oh', 'ah', 'uh', 'um', 'eh', 'mm', 'hm', 'so', 'no', 'hi', 'yo', 'ok',
    // Expressions
    'wow', 'yes', 'yep', 'nah', 'huh', 'hey', 'hmm', 'ooh', 'aww', 'oop',
    // Hesitations
    'er', 'erm', 'uhh', 'umm', 'aah', 'eeh', 'oho', 'aha', 'hah', 'psh',
    // Short responses
    'meh', 'bah', 'ugh', 'gah', 'pfft', 'tsk', 'shh', 'psst', 'phew'
  ],
  
  Spanish: [
    // Basic interjections  
    'oh', 'ah', 'eh', 'ay', 'uy', 'mm', 'hm', 'so', 'no', 'sí', 'ya', 'qué',
    // Expressions
    'wow', 'ups', 'uff', 'bah', 'puf', 'oye', 'ojo', 'ole', 'aha', 'ajá',
    // Hesitations
    'em', 'eh', 'mm', 'hmm', 'este', 'pues', 'bueno', 'a ver', 'vamos',
    // Short responses
    'meh', 'ugh', 'pfff', 'tsk', 'shh', 'psst', 'guau', 'auch', 'uy', 'ay'
  ],
  
  French: [
    // Basic interjections
    'oh', 'ah', 'eh', 'euh', 'heu', 'mm', 'hm', 'si', 'non', 'oui', 'bon', 'ben',
    // Expressions  
    'wow', 'ouah', 'waou', 'bah', 'pff', 'pfft', 'ouf', 'aïe', 'ouille', 'hep',
    // Hesitations
    'euh', 'heu', 'hmm', 'mm', 'alors', 'donc', 'enfin', 'voilà', 'tiens',
    // Short responses
    'meh', 'bof', 'ugh', 'pfff', 'tsk', 'chut', 'psst', 'hein', 'dis', 'hop'
  ],
  
  German: [
    // Basic interjections
    'oh', 'ah', 'eh', 'äh', 'öh', 'hm', 'mm', 'so', 'na', 'ja', 'nö', 'ach',
    // Expressions
    'wow', 'ups', 'huch', 'uff', 'bah', 'pff', 'autsch', 'aua', 'hoppla', 'hui',
    // Hesitations  
    'äh', 'öh', 'hmm', 'mm', 'also', 'nun', 'tja', 'naja', 'halt', 'eben',
    // Short responses
    'meh', 'ugh', 'pfff', 'tsk', 'pst', 'hush', 'och', 'oje', 'herrje', 'mann'
  ],
  
  Italian: [
    // Basic interjections
    'oh', 'ah', 'eh', 'mm', 'hm', 'sì', 'no', 'ma', 'che', 'dai', 'boh', 'veh',
    // Expressions
    'wow', 'uff', 'bah', 'pff', 'ops', 'ahi', 'aua', 'ehi', 'aho', 'beh',
    // Hesitations
    'ehm', 'mm', 'hmm', 'beh', 'mah', 'boh', 'ecco', 'allora', 'dunque',
    // Short responses  
    'meh', 'ugh', 'pfff', 'tsk', 'shh', 'psst', 'uffa', 'azzo', 'accidenti'
  ],
  
  Japanese: [
    // Basic interjections
    'あ', 'え', 'お', 'う', 'ん', 'ああ', 'ええ', 'うう', 'おお', 'はい', 'いえ',
    // Expressions  
    'わあ', 'うわ', 'きゃ', 'やあ', 'へえ', 'ほお', 'ふう', 'はあ', 'げえ', 'うげ',
    // Hesitations
    'あの', 'えと', 'その', 'まあ', 'なんか', 'ちょっと', 'えー', 'あー', 'うー',
    // Short responses
    'ふん', 'へん', 'ちっ', 'ふっ', 'はっ', 'ほっ', 'むー', 'うーん', 'んー'
  ],
  
  Chinese: [
    // Basic interjections  
    '啊', '哦', '呃', '嗯', '唔', '呢', '哎', '诶', '嘿', '咦', '哟', '喔',
    // Expressions
    '哇', '咦', '嘻', '哈', '呵', '嗨', '喂', '唉', '嘘', '嗳', '哟', '咯',
    // Hesitations
    '嗯', '呃', '那个', '这个', '就是', '然后', '所以', '因为', '但是', '不过',
    // Short responses
    '切', '哼', '呸', '哧', '噗', '嘁', '嗤', '嗯哼', '呵呵', '哈哈'
  ],
  
  Korean: [
    // Basic interjections
    '아', '어', '오', '우', '음', '네', '예', '응', '글쎄', '뭐', '그', '저',
    // Expressions  
    '와', '워', '웩', '악', '앗', '엥', '헉', '헐', '어머', '아이고', '어어',
    // Hesitations
    '음', '어', '그', '저', '뭐', '그냥', '좀', '막', '약간', '진짜', '정말',
    // Short responses
    '흠', '하', '휴', '쯧', '치', '어휴', '에이', '아니', '뭐야', '하여튼'
  ]
};

// Function to get stop words for a specific language
function getStopWords(language) {
  return stopWords[language] || stopWords.English;
}

// Function to check if a word is a stop word
function isStopWord(word, language) {
  const stopWordsList = getStopWords(language);
  const cleanWord = word.toLowerCase().trim().replace(/[.,!?;:"'`´''""。！？]/g, '');
  return stopWordsList.includes(cleanWord);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { stopWords, getStopWords, isStopWord };
}

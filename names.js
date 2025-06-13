
// Character naming system for RoleLang
// Provides culturally appropriate names for each supported language

const characterNames = {
  English: {
    female: [
      ["Emma", "Johnson"], ["Olivia", "Smith"], ["Ava", "Williams"], ["Isabella", "Brown"],
      ["Sophia", "Jones"], ["Charlotte", "Garcia"], ["Mia", "Miller"], ["Amelia", "Davis"],
      ["Harper", "Rodriguez"], ["Evelyn", "Martinez"], ["Abigail", "Hernandez"], ["Emily", "Lopez"],
      ["Elizabeth", "Gonzalez"], ["Mila", "Wilson"], ["Ella", "Anderson"], ["Avery", "Thomas"],
      ["Sofia", "Taylor"], ["Camila", "Moore"], ["Aria", "Jackson"], ["Scarlett", "Martin"]
    ],
    male: [
      ["Liam", "Johnson"], ["Noah", "Smith"], ["Oliver", "Williams"], ["Elijah", "Brown"],
      ["William", "Jones"], ["James", "Garcia"], ["Benjamin", "Miller"], ["Lucas", "Davis"],
      ["Henry", "Rodriguez"], ["Alexander", "Martinez"], ["Mason", "Hernandez"], ["Michael", "Lopez"],
      ["Ethan", "Gonzalez"], ["Daniel", "Wilson"], ["Jacob", "Anderson"], ["Logan", "Thomas"],
      ["Jackson", "Taylor"], ["Levi", "Moore"], ["Sebastian", "Jackson"], ["Mateo", "Martin"]
    ]
  },
  Spanish: {
    female: [
      ["María", "García"], ["Carmen", "Rodríguez"], ["Josefa", "González"], ["Isabel", "Fernández"],
      ["Ana", "López"], ["Dolores", "Martínez"], ["Antonia", "Sánchez"], ["Francisca", "Pérez"],
      ["Laura", "Gómez"], ["Teresa", "Martín"], ["Pilar", "Jiménez"], ["Mercedes", "Ruiz"],
      ["Julia", "Hernández"], ["Rosario", "Díaz"], ["Concepción", "Moreno"], ["Esperanza", "Muñoz"],
      ["Ángeles", "Álvarez"], ["Milagros", "Romero"], ["Cristina", "Alonso"], ["Encarnación", "Gutierrez"]
    ],
    male: [
      ["Antonio", "García"], ["José", "Rodríguez"], ["Manuel", "González"], ["Francisco", "Fernández"],
      ["Juan", "López"], ["David", "Martínez"], ["José Antonio", "Sánchez"], ["José Luis", "Pérez"],
      ["Jesús", "Gómez"], ["Javier", "Martín"], ["Francisco Javier", "Jiménez"], ["Rafael", "Ruiz"],
      ["Miguel", "Hernández"], ["Ángel", "Díaz"], ["José Manuel", "Moreno"], ["Vicente", "Muñoz"],
      ["Alejandro", "Álvarez"], ["Ignacio", "Romero"], ["Alfonso", "Alonso"], ["Adrián", "Gutierrez"]
    ]
  },
  French: {
    female: [
      ["Marie", "Martin"], ["Françoise", "Bernard"], ["Monique", "Thomas"], ["Catherine", "Petit"],
      ["Nathalie", "Robert"], ["Isabelle", "Richard"], ["Sylvie", "Durand"], ["Jacqueline", "Dubois"],
      ["Chantal", "Moreau"], ["Martine", "Laurent"], ["Nicole", "Simon"], ["Brigitte", "Michel"],
      ["Annie", "Lefebvre"], ["Christiane", "Leroy"], ["Véronique", "Roux"], ["Dominique", "David"],
      ["Christine", "Bertrand"], ["Sandrine", "Morel"], ["Valérie", "Fournier"], ["Céline", "Girard"]
    ],
    male: [
      ["Jean", "Martin"], ["Pierre", "Bernard"], ["Michel", "Thomas"], ["André", "Petit"],
      ["Philippe", "Robert"], ["Alain", "Richard"], ["Bernard", "Durand"], ["Christian", "Dubois"],
      ["Daniel", "Moreau"], ["Patrick", "Laurent"], ["François", "Simon"], ["Jacques", "Michel"],
      ["Gérard", "Lefebvre"], ["Yves", "Leroy"], ["Marcel", "Roux"], ["Robert", "David"],
      ["Roger", "Bertrand"], ["Henri", "Morel"], ["Louis", "Fournier"], ["Paul", "Girard"]
    ]
  },
  German: {
    female: [
      ["Maria", "Müller"], ["Elisabeth", "Schmidt"], ["Anna", "Schneider"], ["Katharina", "Fischer"],
      ["Margarete", "Weber"], ["Barbara", "Meyer"], ["Christine", "Wagner"], ["Ruth", "Becker"],
      ["Ursula", "Schulz"], ["Monika", "Hoffmann"], ["Helga", "Schäfer"], ["Ingrid", "Koch"],
      ["Christa", "Bauer"], ["Gisela", "Richter"], ["Sabine", "Klein"], ["Petra", "Wolf"],
      ["Brigitte", "Schröder"], ["Andrea", "Neumann"], ["Gabriele", "Schwarz"], ["Claudia", "Zimmermann"]
    ],
    male: [
      ["Hans", "Müller"], ["Karl", "Schmidt"], ["Heinrich", "Schneider"], ["Franz", "Fischer"],
      ["Josef", "Weber"], ["Wilhelm", "Meyer"], ["Georg", "Wagner"], ["Johann", "Becker"],
      ["Friedrich", "Schulz"], ["Paul", "Hoffmann"], ["Peter", "Schäfer"], ["Werner", "Koch"],
      ["Herbert", "Bauer"], ["Helmut", "Richter"], ["Gerhard", "Klein"], ["Walter", "Wolf"],
      ["Klaus", "Schröder"], ["Günter", "Neumann"], ["Rudolf", "Schwarz"], ["Wolfgang", "Zimmermann"]
    ]
  },
  Italian: {
    female: [
      ["Maria", "Rossi"], ["Anna", "Russo"], ["Giuseppina", "Ferrari"], ["Rosa", "Esposito"],
      ["Angela", "Bianchi"], ["Giovanna", "Romano"], ["Teresa", "Colombo"], ["Lucia", "Ricci"],
      ["Carmela", "Marino"], ["Caterina", "Greco"], ["Francesca", "Bruno"], ["Antonietta", "Gallo"],
      ["Concetta", "Conti"], ["Elisabetta", "De Luca"], ["Paola", "Mancini"], ["Antonella", "Costa"],
      ["Rita", "Giordano"], ["Patrizia", "Rizzo"], ["Carla", "Lombardi"], ["Giulia", "Moretti"]
    ],
    male: [
      ["Giuseppe", "Rossi"], ["Antonio", "Russo"], ["Mario", "Ferrari"], ["Francesco", "Esposito"],
      ["Giovanni", "Bianchi"], ["Salvatore", "Romano"], ["Angelo", "Colombo"], ["Vincenzo", "Ricci"],
      ["Pietro", "Marino"], ["Pasquale", "Greco"], ["Luigi", "Bruno"], ["Franco", "Gallo"],
      ["Nicola", "Conti"], ["Domenico", "De Luca"], ["Bruno", "Mancini"], ["Paolo", "Costa"],
      ["Michele", "Giordano"], ["Stefano", "Rizzo"], ["Andrea", "Lombardi"], ["Marco", "Moretti"]
    ]
  },
  Japanese: {
    female: [
      ["Yuki", "Tanaka"], ["Akiko", "Watanabe"], ["Hiroko", "Ito"], ["Kazuko", "Yamamoto"],
      ["Toshiko", "Nakamura"], ["Michiko", "Kobayashi"], ["Sachiko", "Kato"], ["Masako", "Yoshida"],
      ["Keiko", "Yamada"], ["Noriko", "Sasaki"], ["Yukiko", "Yamaguchi"], ["Kimiko", "Matsumoto"],
      ["Emiko", "Inoue"], ["Reiko", "Kimura"], ["Naoko", "Hayashi"], ["Mariko", "Shimizu"],
      ["Takako", "Yamazaki"], ["Yoko", "Mori"], ["Shizuko", "Abe"], ["Fumiko", "Ikeda"]
    ],
    male: [
      ["Hiroshi", "Tanaka"], ["Takeshi", "Watanabe"], ["Kazuo", "Ito"], ["Minoru", "Yamamoto"],
      ["Akira", "Nakamura"], ["Toshio", "Kobayashi"], ["Masahiro", "Kato"], ["Takashi", "Yoshida"],
      ["Kenji", "Yamada"], ["Satoshi", "Sasaki"], ["Yoshio", "Yamaguchi"], ["Shinji", "Matsumoto"],
      ["Koji", "Inoue"], ["Makoto", "Kimura"], ["Tetsuya", "Hayashi"], ["Hideki", "Shimizu"],
      ["Osamu", "Yamazaki"], ["Masaki", "Mori"], ["Kenichi", "Abe"], ["Ryoichi", "Ikeda"]
    ]
  },
  Chinese: {
    female: [
      ["李梅", "Li"], ["王芳", "Wang"], ["张丽", "Zhang"], ["刘静", "Liu"],
      ["陈敏", "Chen"], ["杨红", "Yang"], ["赵莉", "Zhao"], ["黄燕", "Huang"],
      ["周玲", "Zhou"], ["吴娟", "Wu"], ["徐艳", "Xu"], ["朱琳", "Zhu"],
      ["马丹", "Ma"], ["胡蓉", "Hu"], ["郭萍", "Guo"], ["林慧", "Lin"],
      ["何晶", "He"], ["高洁", "Gao"], ["罗娜", "Luo"], ["宋雪", "Song"]
    ],
    male: [
      ["李伟", "Li"], ["王强", "Wang"], ["张磊", "Zhang"], ["刘军", "Liu"],
      ["陈杰", "Chen"], ["杨涛", "Yang"], ["赵勇", "Zhao"], ["黄鹏", "Huang"],
      ["周斌", "Zhou"], ["吴峰", "Wu"], ["徐明", "Xu"], ["朱刚", "Zhu"],
      ["马超", "Ma"], ["胡龙", "Hu"], ["郭亮", "Guo"], ["林海", "Lin"],
      ["何东", "He"], ["高飞", "Gao"], ["罗凯", "Luo"], ["宋波", "Song"]
    ]
  },
  Korean: {
    female: [
      ["김민서", "Kim"], ["이서연", "Lee"], ["박지우", "Park"], ["최하은", "Choi"],
      ["정지민", "Jung"], ["강서현", "Kang"], ["조예은", "Jo"], ["윤채원", "Yoon"],
      ["장다은", "Jang"], ["임소율", "Lim"], ["한지유", "Han"], ["오서윤", "Oh"],
      ["신지아", "Shin"], ["권가은", "Kwon"], ["황시은", "Hwang"], ["안유진", "Ahn"],
      ["송혜인", "Song"], ["홍서아", "Hong"], ["김나은", "Kim"], ["이유나", "Lee"]
    ],
    male: [
      ["김민준", "Kim"], ["이도윤", "Lee"], ["박서준", "Park"], ["최예준", "Choi"],
      ["정시우", "Jung"], ["강하준", "Kang"], ["조주원", "Jo"], ["윤지호", "Yoon"],
      ["장건우", "Jang"], ["임우진", "Lim"], ["한현우", "Han"], ["오준서", "Oh"],
      ["신도현", "Shin"], ["권민재", "Kwon"], ["황연우", "Hwang"], ["안지훈", "Ahn"],
      ["송선우", "Song"], ["홍지안", "Hong"], ["김태윤", "Kim"], ["이승민", "Lee"]
    ]
  }
};

// Function to get random names for a specific language
function getRandomNames(language, count = 5) {
  const langNames = characterNames[language];
  if (!langNames) {
    // Fallback to English if language not found
    return getRandomNames('English', count);
  }
  
  const allNames = [...langNames.female, ...langNames.male];
  const shuffled = [...allNames].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Function to get random names by gender
function getRandomNamesByGender(language, gender, count = 3) {
  const langNames = characterNames[language];
  if (!langNames) {
    return getRandomNamesByGender('English', gender, count);
  }
  
  const genderNames = langNames[gender] || langNames.male;
  const shuffled = [...genderNames].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { characterNames, getRandomNames, getRandomNamesByGender };
}

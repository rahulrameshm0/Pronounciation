/** Starter practice words keyed by base language; any other language uses typed text. */
export const STARTER_WORDS: Record<string, string[]> = {
  en: ["water", "comfortable", "squirrel", "thought", "rural", "vegetable", "schedule", "world",
       "particularly", "think", "very", "February", "Wednesday", "sixth", "clothes", "jewelry",
       "anemone", "through", "colonel", "pronunciation"],
  es: ["perro", "ferrocarril", "trabajar", "gracias", "murciélago", "desarrollar", "jugar",
       "hoja", "ciudad", "llave", "cerrar", "huevo", "año", "mañana", "zapato"],
  fr: ["bonjour", "grenouille", "écureuil", "serrurerie", "heureux", "oiseau", "fauteuil",
       "accueil", "rue", "roue", "beurre", "vieux", "pneu", "chirurgien", "feuille"],
  de: ["Eichhörnchen", "Brötchen", "Streichholzschächtelchen", "schön", "Zwiebel", "Mädchen",
       "Ich", "Bücher", "Würstchen", "Quatsch", "Rührei", "Pfannkuchen", "Glück", "Übung"],
  it: ["gnocchi", "aglio", "sciarpa", "famiglia", "ghiaccio", "zucchero", "anno",
       "pizza", "chiave", "bicchiere", "scegliere"],
  pt: ["obrigado", "pão", "coração", "trabalho", "lhe", "chuva", "olho", "avô", "avó", "maçã"],
  hi: ["नमस्ते", "धन्यवाद", "पानी", "किताब", "दोस्त", "खाना", "घर", "स्कूल", "प्यार", "ज़िन्दगी"],
  ml: ["നമസ്കാരം", "നന്ദി", "വെള്ളം", "പുസ്തകം", "കേരളം", "അമ്മ", "മഴ", "പഴം", "വീട്", "സന്തോഷം"],
  ta: ["வணக்கம்", "நன்றி", "தண்ணீர்", "புத்தகம்", "அம்மா", "வீடு", "மழை", "பழம்"],
  te: ["నమస్కారం", "ధన్యవాదాలు", "నీళ్ళు", "పుస్తకం", "అమ్మ", "ఇల్లు"],
  kn: ["ನಮಸ್ಕಾರ", "ಧನ್ಯವಾದ", "ನೀರು", "ಪುಸ್ತಕ", "ಅಮ್ಮ", "ಮನೆ"],
  bn: ["নমস্কার", "ধন্যবাদ", "জল", "বই", "মা", "বাড়ি"],
  ar: ["مرحبا", "شكرا", "ماء", "كتاب", "صديق", "بيت", "قلب", "حب"],
  ja: ["こんにちは", "ありがとう", "水", "本", "友達", "日本語", "おいしい", "さようなら"],
  zh: ["你好", "谢谢", "水", "书", "朋友", "中国", "妈妈", "马"],
  ko: ["안녕하세요", "감사합니다", "물", "책", "친구", "사랑해요", "한국어"],
  ru: ["здравствуйте", "спасибо", "вода", "книга", "друг", "достопримечательность", "щи"],
};

export const starterFor = (lang: string) => STARTER_WORDS[lang.split("-")[0]] ?? [];

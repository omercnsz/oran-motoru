import type { Messages } from './en';

const hi: Messages = {
  tabs: { matches: 'मैच', coupons: 'बेट स्लिप', games: 'गेम', savings: 'गुल्लक' },
  nav: { match: 'मैच', live: 'लाइव', coupon: 'बेट स्लिप', settings: 'सेटिंग्स', back: 'मैच' },
  common: { dataError: 'डेटा लोड नहीं हो सका', dbError: 'डेटाबेस तैयार नहीं हो सका: %{message}', comingSoon: 'चरण %{n}' },
  matches: {
    title: 'मैच', subtitle: 'असली मैच, असली ऑड्स। पैसा नकली है।', preMatch: 'मैच से पहले', live: 'लाइव',
    none14: 'इस प्रतियोगिता में अगले 14 दिनों में कोई मैच नहीं है।',
    notSoon: '%{league} में आज और कल कोई मैच नहीं है; अगले मैच %{date} को हैं।',
    soonLeagues: 'आज और कल मैच वाली प्रतियोगिताएँ:', allBets: 'सभी दांव ›', notFound: 'मैच नहीं मिला',
  },
  live: {
    noneNow: 'अभी कोई मैच नहीं चल रहा है।', next: 'अगला: %{home} – %{away}, %{time} (%{league})।',
    error: 'लाइव स्कोर लोड नहीं हो सके: %{message}', inPlay: 'चल रहा है', soon: 'जल्द शुरू होगा', finished: 'समाप्त',
    sourceCache: 'स्रोत: ESPN (कैश)', sourceDirect: 'स्रोत: ESPN', updated: '%{time} पर अपडेट हुआ', allLiveBets: 'सभी लाइव दांव ›',
    redCards: 'रेड कार्ड: %{home} %{homeCount}, %{away} %{awayCount}', computing: 'लाइव ऑड्स की गणना हो रही है…',
    onlyInPlay: 'लाइव दांव केवल मैच के दौरान खुले रहते हैं।', notInList: 'यह मैच लाइव सूची में नहीं है',
    notStarted: 'शुरू नहीं हुआ', finishedScore: 'समाप्त · %{score}', halfTime: 'हाफ़ टाइम', fullTime: 'पूर्ण समय',
  },
  slip: {
    title: 'आपकी बेट स्लिप', subtitle: 'आप यह पैसा सच में नहीं लगा रहे हैं। राशि आपकी गुल्लक में जाती है।',
    empty: 'आपकी बेट स्लिप खाली है। मैच से ऑड्स चुनें।', bar: 'बेट स्लिप · %{count} मैच', barOdds: 'ऑड्स %{odds}',
    remove: 'स्लिप से हटाएँ', live: 'लाइव', stake: 'राशि', totalOdds: 'कुल ऑड्स', potential: 'संभावित वापसी',
    create: 'बेट स्लिप बनाएँ · %{amount} गुल्लक में',
    errors: {
      invalidAmount: 'सही राशि लिखें (जैसे %{example})', empty: 'कम से कम एक मैच जोड़ें',
      tooMany: 'एक स्लिप में अधिकतम %{max} मैच हो सकते हैं', sameMatch: 'एक ही मैच से दो विकल्प नहीं जोड़ सकते',
      unknownBet: 'अज्ञात दांव', closed: '%{match} पर दांव बंद है',
      started: '%{match} शुरू हो गया है; मैच से पहले के दांव बंद हैं', postponed: '%{match} स्थगित या रद्द हो गया',
      minStake: 'न्यूनतम राशि %{min} है', staleLive: '%{match} के लाइव ऑड्स एक मिनट से पुराने हैं; हटाकर फिर से चुनें',
    },
  },
  coupons: {
    title: 'बेट स्लिप', subtitle: 'आपकी छाया बेट स्लिप: असली मैच, नकली पैसा।', none: 'अभी कोई बेट स्लिप नहीं है। मैच में ऑड्स चुनकर शुरू करें।',
    open: 'खुली', won: 'जीती', lost: 'हारी', stakeOdds: 'राशि %{stake} · ऑड्स %{odds}', potential: 'संभावित %{amount}',
  },
  savings: {
    title: 'गुल्लक', subtitle: 'जो भी पैसा आपने दांव पर नहीं लगाया, वह यहाँ है।', inBank: 'आपकी गुल्लक में',
    notToBookie: 'यह पैसा किसी सट्टेबाज़ के पास नहीं गया। अगर आपने इसे सच में अलग रखा है, तो यह आपका है।',
    allTime: 'शुरुआत से', coupons: 'बेट स्लिप', couponsValue: '%{count} (%{open} खुली)', staked: 'आप दांव पर लगाते',
    wonLost: 'जीती / हारी', ifReal: 'अगर आप असली पैसे से खेलते',
    noSettled: 'जब कोई स्लिप तय हो जाएगी, तो यहाँ दिखेगा कि असली पैसे से क्या होता।',
    houseEdge: 'ऑड्स में असली सट्टेबाज़ी साइटों की तरह मार्जिन शामिल है: लंबे समय में जीत हमेशा हाउस की होती है।',
    houseEdgeYours: 'ये आँकड़े आपकी अपनी स्लिप से यही दिखाते हैं।', help: 'क्या आप किसी से बात करना चाहते हैं? %{name}: %{contact}',
    otherCurrencies: 'दूसरी मुद्राओं की स्लिप शामिल नहीं हैं।',
  },
  games: { title: 'गेम', subtitle: 'केवल नकली चिप्स। कोई खरीदारी नहीं, कोई निकासी नहीं।', crash: 'क्रैश', roulette: 'रूले', slot: 'स्लॉट' },
  settings: {
    title: 'सेटिंग्स', language: 'भाषा', deviceLanguage: 'डिवाइस की भाषा', currency: 'मुद्रा', automatic: 'स्वचालित (%{value})',
    oddsFormat: 'ऑड्स का प्रारूप', decimal: 'दशमलव', fractional: 'भिन्न', american: 'अमेरिकी',
    restartForRtl: 'टेक्स्ट की दिशा बदलने के लिए ऐप फिर से शुरू करें।',
    translationNote: 'अंग्रेज़ी और तुर्की के अलावा बाकी अनुवाद मशीन अनुवाद की मदद से बने हैं और मूल वक्ताओं की जाँच का इंतज़ार कर रहे हैं।',
  },
  markets: { '1X2': 'मैच का नतीजा', DC: 'डबल चांस', OU: 'ओवर/अंडर %{line}', BTTS: 'दोनों टीमें गोल करेंगी', TG: 'कुल गोल', HC: 'हैंडीकैप (%{hc})', CS: 'सटीक स्कोर' },
  outcomes: { under: 'अंडर', over: 'ओवर', yes: 'हाँ', no: 'नहीं', other: 'अन्य' },
};
export default hi;

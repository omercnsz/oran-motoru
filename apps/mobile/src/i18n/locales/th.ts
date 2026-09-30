import type { Messages } from './en';

const th: Messages = {
  tabs: { matches: 'การแข่งขัน', coupons: 'บิล', games: 'เกม', savings: 'กระปุกออมสิน' },
  nav: { match: 'การแข่งขัน', live: 'สด', coupon: 'บิล', settings: 'การตั้งค่า', back: 'การแข่งขัน' },
  common: { dataError: 'โหลดข้อมูลไม่ได้', dbError: 'เตรียมฐานข้อมูลไม่ได้: %{message}', comingSoon: 'ระยะที่ %{n}' },
  matches: {
    title: 'การแข่งขัน', subtitle: 'แมตช์จริง ราคาจริง เงินปลอม', preMatch: 'ก่อนแข่ง', live: 'สด',
    none14: 'รายการนี้ไม่มีแมตช์ใน 14 วันข้างหน้า', notSoon: '%{league} ไม่มีแมตช์วันนี้และพรุ่งนี้ แมตช์ถัดไปคือ %{date}',
    soonLeagues: 'รายการที่มีแมตช์วันนี้และพรุ่งนี้:', allBets: 'การเดิมพันทั้งหมด ›', notFound: 'ไม่พบแมตช์',
  },
  live: {
    noneNow: 'ตอนนี้ไม่มีแมตช์ที่กำลังแข่ง', next: 'ถัดไป: %{home} – %{away}, %{time} (%{league})',
    error: 'โหลดผลสดไม่ได้: %{message}', inPlay: 'กำลังแข่ง', soon: 'เริ่มเร็ว ๆ นี้', finished: 'จบแล้ว',
    sourceCache: 'แหล่งข้อมูล: ESPN (แคช)', sourceDirect: 'แหล่งข้อมูล: ESPN', updated: 'อัปเดตเมื่อ %{time}', allLiveBets: 'เดิมพันสดทั้งหมด ›',
    redCards: 'ใบแดง: %{home} %{homeCount}, %{away} %{awayCount}', computing: 'กำลังคำนวณราคาสด…',
    onlyInPlay: 'เดิมพันสดเปิดเฉพาะระหว่างการแข่งขัน', notInList: 'แมตช์นี้ไม่อยู่ในรายการสด',
    notStarted: 'ยังไม่เริ่ม', finishedScore: 'จบแล้ว · %{score}', halfTime: 'พักครึ่ง', fullTime: 'จบเกม',
  },
  slip: {
    title: 'บิลของคุณ', subtitle: 'คุณไม่ได้เดิมพันเงินนี้จริง ๆ จำนวนเงินจะเข้ากระปุกออมสินของคุณ',
    empty: 'บิลว่างอยู่ เลือกราคาจากหน้าการแข่งขัน', bar: 'บิล · %{count} แมตช์', barOdds: 'ราคา %{odds}',
    remove: 'ลบออกจากบิล', live: 'สด', stake: 'จำนวนเงิน', totalOdds: 'ราคารวม', potential: 'เงินที่อาจได้',
    create: 'สร้างบิล · %{amount} เข้ากระปุก',
    errors: {
      invalidAmount: 'กรอกจำนวนเงินที่ถูกต้อง (เช่น %{example})', empty: 'เพิ่มอย่างน้อยหนึ่งแมตช์',
      tooMany: 'บิลหนึ่งใบมีได้สูงสุด %{max} แมตช์', sameMatch: 'เลือกสองตัวเลือกจากแมตช์เดียวกันไม่ได้',
      unknownBet: 'ไม่รู้จักการเดิมพันนี้', closed: 'ปิดรับเดิมพัน %{match} แล้ว',
      started: '%{match} เริ่มแล้ว ปิดรับเดิมพันก่อนแข่งแล้ว', postponed: '%{match} ถูกเลื่อนหรือยกเลิก',
      minStake: 'จำนวนเงินขั้นต่ำคือ %{min}', staleLive: 'ราคาสดของ %{match} เก่ากว่าหนึ่งนาที ลบแล้วเลือกใหม่',
    },
  },
  coupons: {
    title: 'บิล', subtitle: 'บิลเงาของคุณ: แมตช์จริง เงินปลอม', none: 'ยังไม่มีบิล เริ่มด้วยการเลือกราคาจากหน้าการแข่งขัน',
    open: 'รอผล', won: 'ชนะ', lost: 'แพ้', stakeOdds: 'จำนวนเงิน %{stake} · ราคา %{odds}', potential: 'อาจได้ %{amount}',
  },
  savings: {
    title: 'กระปุกออมสิน', subtitle: 'ทุกบาทที่คุณไม่ได้เดิมพันอยู่ที่นี่', inBank: 'ในกระปุกของคุณ',
    notToBookie: 'เงินนี้ไม่ได้ไปถึงเว็บพนัน ถ้าคุณเก็บมันไว้จริง ๆ มันคือเงินของคุณ',
    allTime: 'ตั้งแต่เริ่มต้น', coupons: 'บิล', couponsValue: '%{count} (รอผล %{open})', staked: 'เงินที่คุณจะเดิมพัน',
    wonLost: 'ชนะ / แพ้', ifReal: 'ถ้าคุณเล่นด้วยเงินจริง',
    noSettled: 'เมื่อบิลมีผลแล้ว คุณจะเห็นที่นี่ว่าจะเกิดอะไรขึ้นถ้าใช้เงินจริง',
    houseEdge: 'ราคามีค่าต๋งรวมอยู่ เหมือนเว็บพนันจริง: ในระยะยาวเจ้ามือชนะเสมอ',
    houseEdgeYours: 'ตัวเลขเหล่านี้แสดงให้เห็นด้วยบิลของคุณเอง', help: 'อยากคุยกับใครสักคนไหม? %{name}: %{contact}',
    otherCurrencies: 'ไม่รวมบิลในสกุลเงินอื่น',
  },
  games: { title: 'เกม', subtitle: 'ใช้ชิปปลอมเท่านั้น ไม่มีการซื้อ ไม่มีการถอนเงิน', crash: 'Crash', roulette: 'รูเล็ต', slot: 'สล็อต' },
  settings: {
    title: 'การตั้งค่า', language: 'ภาษา', deviceLanguage: 'ภาษาของอุปกรณ์', currency: 'สกุลเงิน', automatic: 'อัตโนมัติ (%{value})',
    oddsFormat: 'รูปแบบราคา', decimal: 'ทศนิยม', fractional: 'เศษส่วน', american: 'แบบอเมริกัน',
    restartForRtl: 'เริ่มแอปใหม่เพื่อเปลี่ยนทิศทางข้อความ',
    translationNote: 'คำแปลนอกเหนือจากภาษาอังกฤษและภาษาตุรกีทำขึ้นโดยใช้การแปลด้วยเครื่องช่วย และกำลังรอเจ้าของภาษาตรวจสอบ',
  },
  markets: { '1X2': 'ผลการแข่งขัน', DC: 'ดับเบิลชานซ์', OU: 'สูง/ต่ำ %{line}', BTTS: 'ทั้งสองทีมยิงประตู', TG: 'จำนวนประตูรวม', HC: 'แฮนดิแคป (%{hc})', CS: 'สกอร์ที่ถูกต้อง' },
  outcomes: { under: 'ต่ำ', over: 'สูง', yes: 'ใช่', no: 'ไม่', other: 'อื่น ๆ' },
};
export default th;

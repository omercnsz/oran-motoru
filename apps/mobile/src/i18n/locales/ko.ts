import type { Messages } from './en';

const ko: Messages = {
  tabs: { matches: '경기', coupons: '베팅 슬립', games: '게임', savings: '저금통' },
  nav: { match: '경기', live: '라이브', coupon: '베팅 슬립', settings: '설정', back: '경기' },
  common: { dataError: '데이터를 불러올 수 없습니다', dbError: '데이터베이스를 준비할 수 없습니다: %{message}', comingSoon: '%{n}단계' },
  matches: {
    title: '경기', subtitle: '진짜 경기, 진짜 배당. 돈은 가상입니다.', preMatch: '경기 전', live: '라이브',
    none14: '이 대회에는 앞으로 14일 동안 경기가 없습니다.', notSoon: '%{league}는 오늘과 내일 경기가 없습니다. 다음 경기는 %{date}입니다.',
    soonLeagues: '오늘과 내일 경기가 있는 대회:', allBets: '전체 베팅 ›', notFound: '경기를 찾을 수 없습니다',
  },
  live: {
    noneNow: '지금 진행 중인 경기가 없습니다.', next: '다음 경기: %{home} – %{away}, %{time} (%{league}).',
    error: '실시간 점수를 불러올 수 없습니다: %{message}', inPlay: '진행 중', soon: '곧 시작', finished: '종료',
    sourceCache: '출처: ESPN (캐시)', sourceDirect: '출처: ESPN', updated: '%{time} 업데이트', allLiveBets: '전체 라이브 베팅 ›',
    redCards: '레드카드: %{home} %{homeCount}, %{away} %{awayCount}', computing: '라이브 배당 계산 중…',
    onlyInPlay: '라이브 베팅은 경기 중에만 가능합니다.', notInList: '이 경기는 라이브 목록에 없습니다',
    notStarted: '시작 전', finishedScore: '종료 · %{score}', halfTime: '하프타임', fullTime: '경기 종료',
  },
  slip: {
    title: '내 베팅 슬립', subtitle: '실제로 이 돈을 거는 것이 아닙니다. 금액은 저금통에 들어갑니다.',
    empty: '베팅 슬립이 비어 있습니다. 경기에서 배당을 선택하세요.', bar: '베팅 슬립 · %{count}경기', barOdds: '배당 %{odds}',
    remove: '슬립에서 삭제', live: '라이브', stake: '금액', totalOdds: '총 배당', potential: '예상 적중금',
    create: '베팅 슬립 만들기 · %{amount} 저금통으로',
    errors: {
      invalidAmount: '올바른 금액을 입력하세요 (예: %{example})', empty: '최소 한 경기를 추가하세요',
      tooMany: '한 슬립에는 최대 %{max}경기까지 넣을 수 있습니다', sameMatch: '같은 경기에서 두 가지를 선택할 수 없습니다',
      unknownBet: '알 수 없는 베팅', closed: '%{match} 베팅이 마감되었습니다',
      started: '%{match} 경기가 시작되어 경기 전 베팅이 마감되었습니다', postponed: '%{match} 경기가 연기되거나 취소되었습니다',
      minStake: '최소 금액은 %{min}입니다', staleLive: '%{match}의 라이브 배당이 1분 넘게 지났습니다. 삭제하고 다시 선택하세요',
    },
  },
  coupons: {
    title: '베팅 슬립', subtitle: '나의 그림자 베팅: 진짜 경기, 가상의 돈.', none: '아직 베팅 슬립이 없습니다. 경기에서 배당을 선택해 시작하세요.',
    open: '진행 중', won: '적중', lost: '미적중', stakeOdds: '금액 %{stake} · 배당 %{odds}', potential: '예상 %{amount}',
  },
  savings: {
    title: '저금통', subtitle: '걸지 않은 모든 돈이 여기에 있습니다.', inBank: '저금통 안',
    notToBookie: '이 돈은 도박 사이트로 가지 않았습니다. 정말로 모아 두었다면 당신의 돈입니다.',
    allTime: '전체 기간', coupons: '베팅 슬립', couponsValue: '%{count} (진행 중 %{open})', staked: '걸었을 금액',
    wonLost: '적중 / 미적중', ifReal: '진짜 돈으로 했다면',
    noSettled: '베팅 슬립이 정산되면 진짜 돈이었다면 어땠을지 여기에서 볼 수 있습니다.',
    houseEdge: '배당에는 실제 도박 사이트처럼 수수료가 포함되어 있습니다. 길게 보면 결국 하우스가 이깁니다.',
    houseEdgeYours: '이 숫자가 당신의 베팅 슬립으로 그것을 보여 줍니다.', help: '누군가와 이야기하고 싶나요? %{name}: %{contact}',
    otherCurrencies: '다른 통화의 베팅 슬립은 포함되지 않습니다.',
  },
  games: { title: '게임', subtitle: '가상 칩만 사용합니다. 구매도, 환전도 없습니다.', crash: '크래시', roulette: '룰렛', slot: '슬롯' },
  settings: {
    title: '설정', language: '언어', deviceLanguage: '기기 언어', currency: '통화', automatic: '자동 (%{value})',
    oddsFormat: '배당 표시 형식', decimal: '소수', fractional: '분수', american: '미국식',
    restartForRtl: '글자 방향을 바꾸려면 앱을 다시 시작하세요.',
    translationNote: '영어와 터키어를 제외한 번역은 기계 번역의 도움을 받아 만들었으며 원어민 검토를 기다리고 있습니다.',
  },
  markets: { '1X2': '경기 결과', DC: '더블 찬스', OU: '오버/언더 %{line}', BTTS: '양 팀 득점', TG: '총 골 수', HC: '핸디캡 (%{hc})', CS: '정확한 스코어' },
  outcomes: { under: '언더', over: '오버', yes: '예', no: '아니요', other: '기타' },
};
export default ko;

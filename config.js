module.exports = {
  // API 설정
  apiUrl: 'http://rcheck.techb.kr/api/topr',
  
  // 브라우저 설정
  browser: {
    headless: true,  // headless 모드 (테스트용)
    viewport: { width: 1200, height: 800 },
    args: []  // WebKit은 Chrome 옵션을 지원하지 않음
  },
  
  // 딜레이 설정 (밀리초)
  delays: {
    afterProcess: 3000,    // 처리 완료 후 대기 시간
    pageLoad: 2000,        // 페이지 로드 후 대기
    searchInput: 300,      // 검색어 입력 간 딜레이
    pageNavigation: 1500,  // 페이지 이동 후 대기
    errorRetry: 3000       // 에러 발생 시 재시도 대기
  },
  
  // 크롤링 설정
  crawler: {
    maxPages: 10,           // 최대 검색 페이지 수
    timeout: 40000,        // 페이지 로드 타임아웃
    waitTimeout: 10000     // 요소 대기 타임아웃
  },
  
  // 로깅 설정
  logging: {
    enabled: true,
    level: 'info'  // 'debug', 'info', 'warn', 'error'
  }
};
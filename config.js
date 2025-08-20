module.exports = {
  // API 설정
  apiUrl: 'http://rcheck.techb.kr/api/topr',
  
  // 브라우저 설정
  browser: {
    headless: true,  // headless 모드 (서버용)
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
  },
  
  // 리소스 필터링 설정 (트래픽 최적화)
  resourceFiltering: {
    enabled: true,              // 리소스 필터링 활성화
    targetTrafficKB: 500,       // 목표 트래픽 (KB)
    
    // 허용된 도메인 (와일드카드 지원)
    allowedDomains: [
      'www.coupang.com',
      '*.coupang.com',
      'mkt.techb.kr'
    ],
    
    // 차단된 도메인 (이미지/CSS 서버)
    blockedDomains: [
      'image*.coupangcdn.com',
      'thumbnail*.coupangcdn.com', 
      'static.coupangcdn.com',
      'mercury.coupang.com'
    ],
    
    // 차단할 리소스 타입
    blockedResourceTypes: [
      'image',          // 이미지 파일
      'stylesheet',     // CSS 파일  
      'font',          // 폰트 파일
      'media'          // 비디오/오디오
    ],
    
    // 차단할 파일 확장자
    blockedExtensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.css', '.scss', '.less',
      '.woff', '.woff2', '.ttf', '.otf',
      '.mp4', '.mp3', '.avi'
    ],
    
    // 교체 응답 (차단된 리소스 대신 반환)
    replacements: {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      stylesheet: '/* blocked */',
      script: '// blocked',
      font: ''
    }
  }
};
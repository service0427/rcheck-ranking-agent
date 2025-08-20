// 색상 코드 정의
const colors = {
  GREEN: '\x1b[0;32m',
  RED: '\x1b[0;31m',
  YELLOW: '\x1b[1;33m',
  BLUE: '\x1b[0;34m',
  CYAN: '\x1b[0;36m',
  MAGENTA: '\x1b[0;35m',
  NC: '\x1b[0m'  // No Color
};

// 로그 함수
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  
  let color = colors.NC;
  let prefix = '';
  
  switch(type) {
    case 'success':
      color = colors.GREEN;
      prefix = '✅';
      break;
    case 'error':
      color = colors.RED;
      prefix = '❌';
      break;
    case 'warning':
      color = colors.YELLOW;
      prefix = '⚠️';
      break;
    case 'info':
      color = colors.BLUE;
      prefix = '📌';
      break;
    case 'search':
      color = colors.CYAN;
      prefix = '🔍';
      break;
    default:
      prefix = '📝';
  }
  
  console.log(`${color}[${timestamp}] ${prefix} ${message}${colors.NC}`);
}

// 카운트다운 표시 함수
function countdown(seconds, message = '다음 실행까지') {
  return new Promise((resolve) => {
    let remaining = seconds;
    
    const interval = setInterval(() => {
      // 커서를 줄 시작으로 이동하고 현재 줄 지우기
      process.stdout.write('\r\x1b[K');
      
      if (remaining > 0) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        process.stdout.write(`${colors.YELLOW}💤 ${message}: ${timeStr}${colors.NC}`);
        remaining--;
      } else {
        process.stdout.write('\r\x1b[K'); // 마지막 줄 지우기
        clearInterval(interval);
        resolve();
      }
    }, 1000);
    
    // Ctrl+C 처리
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.stdout.write('\r\x1b[K');
      log('사용자에 의해 중단됨', 'warning');
      process.exit(0);
    });
  });
}

// sleep 함수
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 에러 타입 판별 함수
function getErrorType(errorMessage) {
  // 차단 패턴
  const blockPatterns = [
    'ERR_HTTP2_PROTOCOL_ERROR',
    'ERR_CONNECTION_CLOSED',
    'NS_ERROR_NET_INTERRUPT',
    'HTTP/2 Error: INTERNAL_ERROR',
    'Stream error in the HTTP/2 framing layer',
    'WebKit search navigation failed',
    'infinite loading suspected',
    'net::ERR_FAILED',
    '403 Forbidden',
    'blocked',
    'Bot Detection',
    'Security Challenge',
    'BLOCKED'
  ];
  
  // 타임아웃 패턴
  const timeoutPatterns = [
    'Timeout',
    'timeout',
    'TimeoutError',
    'exceeded',
    'waitForSelector',
    'waitForFunction',
    'PAGE_NAVIGATION_TIMEOUT'
  ];
  
  // 네트워크 에러 패턴
  const networkPatterns = [
    'Network',
    'net::',
    'HTTP',
    'getaddrinfo',
    'ENOTFOUND',
    'ECONNREFUSED'
  ];
  
  // 패턴 매칭
  if (blockPatterns.some(pattern => errorMessage.includes(pattern))) {
    return 'BLOCKED';
  }
  
  if (timeoutPatterns.some(pattern => errorMessage.includes(pattern))) {
    return 'TIMEOUT';
  }
  
  if (networkPatterns.some(pattern => errorMessage.includes(pattern))) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

// 에러 메시지 포맷팅
function formatError(error) {
  const errorType = getErrorType(error.message);
  
  switch(errorType) {
    case 'BLOCKED':
      return `🚫 차단 감지: ${error.message}`;
    case 'TIMEOUT':
      return `⏱️ 타임아웃: ${error.message}`;
    case 'NETWORK_ERROR':
      return `🌐 네트워크 오류: ${error.message}`;
    default:
      return `❗ 오류: ${error.message}`;
  }
}

// 진행 표시
function showProgress(current, total, message = '진행 중') {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  process.stdout.write('\r\x1b[K');
  process.stdout.write(`${colors.CYAN}${message}: [${bar}] ${percentage}% (${current}/${total})${colors.NC}`);
  
  if (current === total) {
    process.stdout.write('\n');
  }
}

// 도메인 매칭 함수 (와일드카드 지원)
function matchesDomain(url, patterns) {
  try {
    const hostname = new URL(url).hostname;
    
    return patterns.some(pattern => {
      // 정확한 매치
      if (pattern === hostname) {
        return true;
      }
      
      // 와일드카드 매치 (*.)
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      
      // 앞/뒤 와일드카드
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(hostname);
      }
      
      return false;
    });
  } catch (error) {
    return false;
  }
}

// URL 확장자 체크
function hasBlockedExtension(url, extensions) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return extensions.some(ext => pathname.endsWith(ext.toLowerCase()));
  } catch (error) {
    return false;
  }
}

module.exports = {
  colors,
  log,
  countdown,
  sleep,
  getErrorType,
  formatError,
  showProgress,
  matchesDomain,
  hasBlockedExtension
};
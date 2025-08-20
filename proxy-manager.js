const axios = require('axios');
const { log } = require('./utils');

/**
 * 프록시 관리 클래스
 * local(직접 연결) ↔ 프록시 자동 전환 관리
 */
class ProxyManager {
  constructor(apiUrl, rotateOnSuccess = true) {
    this.apiUrl = apiUrl || 'http://mkt.techb.kr:3001/api/proxy/lists';
    this.mode = 'local';              // 시작은 항상 직접 연결
    this.currentProxy = null;        // 현재 사용 중인 프록시
    this.proxyList = [];            // 캐시된 프록시 목록
    this.proxyUseCount = 0;         // 프록시 연속 사용 횟수
    this.maxProxyUses = 5;          // 프록시 최대 연속 사용 횟수
    this.rotateOnSuccess = rotateOnSuccess;  // 성공 시에도 프록시 변경 여부
    this.stats = {
      localAttempts: 0,
      proxyAttempts: 0,
      localSuccess: 0,
      proxySuccess: 0,
      switches: 0
    };
  }

  /**
   * 프록시 목록을 API에서 가져오기
   */
  async fetchProxies() {
    try {
      log('프록시 목록 조회 중...', 'info');
      const response = await axios.get(this.apiUrl, { timeout: 10000 });
      
      if (response.data.success && response.data.proxies) {
        this.proxyList = response.data.proxies;
        log(`프록시 ${this.proxyList.length}개 로드 완료`, 'success');
        return true;
      } else {
        log('프록시 목록 응답 형식 오류', 'error');
        return false;
      }
    } catch (error) {
      log(`프록시 목록 조회 실패: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 랜덤 프록시 선택
   */
  getRandomProxy() {
    if (this.proxyList.length === 0) {
      throw new Error('사용 가능한 프록시가 없습니다');
    }
    
    const randomIndex = Math.floor(Math.random() * this.proxyList.length);
    const selectedProxy = this.proxyList[randomIndex];
    
    log(`랜덤 프록시 선택: ${selectedProxy}`, 'info');
    return selectedProxy;
  }

  /**
   * 차단 감지 시 프록시 모드로 전환
   */
  async switchToProxy() {
    log('local → 프록시 모드 전환', 'warning');
    
    // 프록시 목록이 없으면 새로 가져오기
    if (this.proxyList.length === 0) {
      const success = await this.fetchProxies();
      if (!success) {
        throw new Error('프록시 목록을 가져올 수 없습니다');
      }
    }
    
    this.mode = 'proxy';
    this.currentProxy = this.getRandomProxy();
    this.proxyUseCount = 0;  // 프록시 사용 카운터 초기화 (나중에 증가)
    this.stats.switches++;
    
    log(`프록시 설정: ${this.currentProxy}`, 'info');
  }

  /**
   * 프록시 사용 후 처리 (5번 사용 후 local 재시도)
   */
  shouldRetryLocal() {
    if (this.mode === 'proxy' && this.proxyUseCount >= this.maxProxyUses) {
      log(`프록시 ${this.maxProxyUses}번 사용 완료 - local 재시도 예정`, 'info');
      return true;
    }
    return false;
  }

  /**
   * local로 전환 (5번 프록시 사용 후)
   */
  switchToLocal() {
    log(`프록시 → local 모드 전환 (${this.proxyUseCount}번 사용 후)`, 'success');
    this.mode = 'local';
    this.currentProxy = null;
    this.proxyUseCount = 0;
    this.stats.switches++;
    return true; // 브라우저 재시작 필요
  }

  /**
   * 프록시 실패 시 다른 프록시로 전환
   */
  async switchToAnotherProxy() {
    if (this.mode === 'proxy') {
      // 실패 시에는 여기서 카운터 증가 (성공 시는 markSuccess에서 증가)
      log(`프록시 실패 - 다른 프록시로 전환`, 'warning');
      this.currentProxy = this.getRandomProxy();
      log(`새 프록시: ${this.currentProxy}`, 'info');
      return true; // 브라우저 재시작 필요
    }
    return false;
  }

  /**
   * 현재 브라우저 설정 반환
   */
  getBrowserOptions(baseOptions = {}) {
    const options = { ...baseOptions };
    
    if (this.mode === 'proxy' && this.currentProxy) {
      options.proxy = {
        server: this.currentProxy
      };
    }
    
    return options;
  }

  /**
   * HTTP/2 차단 에러인지 확인
   */
  isBlockedError(error) {
    const message = error.message || '';
    const isBlocked = message.includes('HTTP/2 Error: INTERNAL_ERROR') ||
                     message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
                     message.includes('NS_ERROR_NET_INTERRUPT') ||
                     message.includes('Stream error in the HTTP/2 framing layer');
    
    if (isBlocked) {
      log(`HTTP/2 차단 감지: ${message}`, 'error');
    }
    
    return isBlocked;
  }

  /**
   * 프록시 관련 에러인지 확인 (타임아웃 포함)
   */
  isProxyError(error) {
    const message = error.message || '';
    const isProxyError = message.includes('Page navigation timeout') ||
                         message.includes('Timeout') && this.mode === 'proxy' ||
                         message.includes('ERR_PROXY_CONNECTION_FAILED') ||
                         message.includes('ERR_SOCKS_CONNECTION_FAILED');
    
    if (isProxyError && this.mode === 'proxy') {
      log(`프록시 오류 감지: ${message}`, 'error');
    }
    
    return isProxyError;
  }

  /**
   * 시도 횟수 증가 (작업 시작 시 호출)
   */
  incrementAttempt() {
    if (this.mode === 'local') {
      this.stats.localAttempts++;
    } else {
      this.stats.proxyAttempts++;
      this.proxyUseCount++;  // 프록시 사용 시 카운터 증가
      log(`프록시 사용 중 (${this.proxyUseCount}/${this.maxProxyUses})`, 'info');
    }
  }

  /**
   * 매 작업 전 프록시 로테이션 확인
   */
  shouldRotateProxy() {
    // 프록시 모드이고, rotateOnSuccess가 true이고, 이미 한 번 이상 사용했으면 변경
    return this.mode === 'proxy' && this.rotateOnSuccess && this.proxyUseCount > 0;
  }

  /**
   * 다음 프록시로 로테이션 (브라우저 재시작 필요 여부 반환)
   */
  rotateProxy() {
    if (this.mode === 'proxy' && this.proxyList.length > 0) {
      const oldProxy = this.currentProxy;
      this.currentProxy = this.getRandomProxy();
      
      if (oldProxy !== this.currentProxy) {
        log(`프록시 로테이션: ${oldProxy} → ${this.currentProxy}`, 'info');
        return true;  // 브라우저 재시작 필요
      }
    }
    return false;
  }

  /**
   * 성공 처리
   */
  markSuccess() {
    if (this.mode === 'local') {
      this.stats.localSuccess++;
      log('local 연결 성공', 'success');
    } else {
      this.stats.proxySuccess++;
      // 카운터는 이미 incrementAttempt에서 증가했으므로 여기서는 상태만 표시
      log(`프록시 성공 (${this.proxyUseCount}/${this.maxProxyUses})`, 'success');
    }
  }

  /**
   * 현재 상태 정보 반환
   */
  getStatus() {
    return {
      mode: this.mode,
      proxy: this.currentProxy,
      proxyUseCount: this.proxyUseCount,
      maxProxyUses: this.maxProxyUses,
      proxyCount: this.proxyList.length,
      stats: this.stats
    };
  }

  /**
   * 통계 정보 로깅
   */
  logStats() {
    const status = this.getStatus();
    log(`연결 모드: ${status.mode === 'local' ? 'local (직접)' : '프록시'}`, 'info');
    
    if (status.mode === 'proxy') {
      log(`현재 프록시: ${status.proxy}`, 'info');
    }
    
    log(`통계 - local: ${status.stats.localSuccess}/${status.stats.localAttempts}, ` +
        `프록시: ${status.stats.proxySuccess}/${status.stats.proxyAttempts}, ` +
        `전환: ${status.stats.switches}회`, 'info');
  }

  /**
   * 프록시 목록 새로고침
   */
  async refreshProxyList() {
    log('프록시 목록 새로고침...', 'info');
    const success = await this.fetchProxies();
    if (success) {
      log(`프록시 목록 업데이트 완료: ${this.proxyList.length}개`, 'success');
    }
    return success;
  }
}

module.exports = ProxyManager;
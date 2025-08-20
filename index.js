#!/usr/bin/env node

const { webkit } = require('playwright');
const config = require('./config');
const { getKeyword, sendResult } = require('./api');
const { searchCoupang } = require('./crawler');
const { log, countdown, formatError, colors, matchesDomain, hasBlockedExtension, parseCliOptions } = require('./utils');
const ProxyManager = require('./proxy-manager');

// 전역 인스턴스들
let browser = null;
let proxyManager = null;

// 대기 시간 관리 변수
let currentDelay = 3000;  // 현재 대기 시간 (밀리초)
const BASE_DELAY = 3000;  // 기본 대기 시간 (3초)
const DELAY_INCREMENT = 10000;  // 증가 단위 (10초)
const MAX_DELAY = 300000;  // 최대 대기 시간 (300초 = 5분)

/**
 * 시스템 초기화 (브라우저 + 프록시 매니저)
 */
async function initSystem() {
  // 프록시 매니저 초기화
  if (config.proxy.enabled) {
    proxyManager = new ProxyManager(config.proxy.apiUrl, config.proxy.rotateOnSuccess);
    log('프록시 시스템 초기화 완료', 'success');
  } else {
    log('프록시 시스템 비활성화', 'info');
  }
  
  // 브라우저 초기화
  await initBrowser();
}

/**
 * 브라우저 초기화 (프록시 설정 포함)
 */
async function initBrowser() {
  // CLI 옵션 파싱
  const cliOptions = parseCliOptions();
  const baseOptions = { 
    headless: cliOptions.headless
  };
  
  // 프록시 설정 적용
  const browserOptions = proxyManager ? 
    proxyManager.getBrowserOptions(baseOptions) : 
    baseOptions;
  
  log('WebKit 브라우저 초기화 중...', 'info');
  
  browser = await webkit.launch(browserOptions);
  
  const modeText = cliOptions.headless ? 'Headless 모드' : 'GUI 모드';
  const connectionText = proxyManager && proxyManager.getStatus().mode === 'proxy' ? 
    `프록시 (${proxyManager.getStatus().proxy})` : 'local (직접 연결)';
    
  log(`WebKit 브라우저 시작 완료 (${modeText}, ${connectionText})`, 'success');
  return browser;
}

/**
 * 브라우저 재시작 (프록시 설정 변경 시)
 */
async function restartBrowser() {
  log('브라우저 재시작 중...', 'warning');
  
  // 기존 브라우저 종료
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      log(`브라우저 종료 실패: ${error.message}`, 'warning');
    }
  }
  
  // 새 브라우저 시작
  await initBrowser();
}

/**
 * 리소스 필터링 설정
 */
async function setupResourceFiltering(page) {
  if (!config.resourceFiltering.enabled) {
    return;
  }

  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    const resourceType = request.resourceType();
    
    // 차단된 도메인 체크
    if (matchesDomain(url, config.resourceFiltering.blockedDomains)) {
      return route.fulfill({
        status: 200,
        contentType: getContentType(resourceType),
        body: getReplacementContent(resourceType)
      });
    }
    
    // 차단된 리소스 타입 체크
    if (config.resourceFiltering.blockedResourceTypes.includes(resourceType)) {
      return route.fulfill({
        status: 200,
        contentType: getContentType(resourceType),
        body: getReplacementContent(resourceType)
      });
    }
    
    // 차단된 확장자 체크
    if (hasBlockedExtension(url, config.resourceFiltering.blockedExtensions)) {
      return route.fulfill({
        status: 200,
        contentType: getContentType(resourceType),
        body: getReplacementContent(resourceType)
      });
    }
    
    // 허용된 요청 계속 진행
    route.continue();
  });
}

/**
 * 리소스 타입별 Content-Type 반환
 */
function getContentType(resourceType) {
  switch (resourceType) {
    case 'image': return 'image/png';
    case 'stylesheet': return 'text/css';
    case 'script': return 'application/javascript';
    case 'font': return 'font/woff2';
    default: return 'text/plain';
  }
}

/**
 * 리소스 타입별 대체 콘텐츠 반환
 */
function getReplacementContent(resourceType) {
  const replacements = config.resourceFiltering.replacements;
  
  switch (resourceType) {
    case 'image': return Buffer.from(replacements.image.split(',')[1], 'base64');
    case 'stylesheet': return replacements.stylesheet;
    case 'script': return replacements.script;
    case 'font': return replacements.font;
    default: return '';
  }
}

/**
 * 단일 키워드 처리 (프록시 로직 포함)
 */
async function processKeyword(keywordData, retryCount = 0) {
  let page = null;
  const startTime = Date.now();
  
  // 프록시 매니저가 있으면 시도 횟수 증가
  if (proxyManager) {
    proxyManager.incrementAttempt();
  }
  
  try {
    // 새 페이지 생성
    page = await browser.newPage({
      viewport: config.browser.viewport
    });
    
    // 리소스 필터링 설정
    await setupResourceFiltering(page);
    
    // 크롤링 수행
    const result = await searchCoupang(page, keywordData.keyword, keywordData.productCode);
    
    // 처리 시간 계산
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 결과 데이터 준비
    const resultData = {
      id: keywordData.id,
      rank: result.rank,
      productName: result.productName,
      thumbnailUrl: result.thumbnailUrl,
      rating: result.rating,
      reviewCount: result.reviewCount,
      // 추가 상품 정보
      beforePrice: result.beforePrice,
      salePrice: result.salePrice,
      discountPercent: result.discountPercent,
      unitLabel: result.unitLabel,
      unitPrice: result.unitPrice,
      freeShip: result.freeShip,
      freeReturn: result.freeReturn,
      coupangPick: result.coupangPick,
      discountTypes: result.discountTypes,
      pointBenefit: result.pointBenefit,
      deliveryInfo: result.deliveryInfo,
      deliveryKeys: result.deliveryKeys,
      isSoldout: result.isSoldout,
      soldoutText: result.soldoutText,
      productUrl: result.productUrl
    };
    
    // 결과 전송 (실제로는 전송하지 않음)
    await sendResult(resultData);
    
    // 성공 처리
    if (proxyManager) {
      proxyManager.markSuccess();
    }
    
    // 결과 표시
    if (result.rank > 0) {
      log(`✅ 완료: 순위=${result.rank}, 시간=${elapsedTime}초`, 'success');
    } else {
      log(`❌ 완료: 상품 없음, 시간=${elapsedTime}초`, 'warning');
    }
    
    return { success: true, ...result };
    
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // HTTP/2 차단 감지 및 프록시 전환 처리
    if (proxyManager && proxyManager.isBlockedError(error)) {
      log(`HTTP/2 차단 감지, 시간=${elapsedTime}초`, 'error');
      
      // 재시도 횟수 제한
      if (retryCount >= config.proxy.maxRetries) {
        log(`최대 재시도 횟수 초과 (${retryCount}/${config.proxy.maxRetries})`, 'error');
        return { success: false, error: '최대 재시도 초과' };
      }
      
      try {
        let needRestart = false;
        
        if (proxyManager.getStatus().mode === 'local') {
          // local → 프록시로 전환
          await proxyManager.switchToProxy();
          needRestart = true;
        } else {
          // 프록시 → 다른 프록시로 전환
          needRestart = await proxyManager.switchToAnotherProxy();
        }
        
        if (needRestart) {
          await restartBrowser();
        }
        
        // 재시도
        log(`재시도 중... (${retryCount + 1}/${config.proxy.maxRetries})`, 'info');
        return await processKeyword(keywordData, retryCount + 1);
        
      } catch (proxyError) {
        log(`프록시 전환 실패: ${proxyError.message}`, 'error');
        // 프록시 전환 실패 시 원래 에러로 처리
      }
    }
    
    // 프록시 타임아웃 등의 오류 처리
    if (proxyManager && proxyManager.isProxyError(error)) {
      log(`프록시 연결 오류, 시간=${elapsedTime}초`, 'error');
      
      // 재시도 횟수 제한
      if (retryCount >= config.proxy.maxRetries) {
        log(`최대 재시도 횟수 초과 (${retryCount}/${config.proxy.maxRetries})`, 'error');
        return { success: false, error: '최대 재시도 초과' };
      }
      
      try {
        // 다른 프록시로 전환
        const needRestart = await proxyManager.switchToAnotherProxy();
        if (needRestart) {
          await restartBrowser();
        }
        
        // 재시도
        log(`다른 프록시로 재시도 중... (${retryCount + 1}/${config.proxy.maxRetries})`, 'info');
        return await processKeyword(keywordData, retryCount + 1);
        
      } catch (proxyError) {
        log(`프록시 전환 실패: ${proxyError.message}`, 'error');
      }
    }
    
    // 일반 오류 처리
    log(`${formatError(error)}, 시간=${elapsedTime}초`, 'error');
    log('⚠️ 오류로 인해 API 전송 안함', 'warning');
    
    return { success: false, error: error.message };
    
  } finally {
    // 페이지 정리
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // 페이지 닫기 실패 무시
      }
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  // EventEmitter 최대 리스너 수 증가 (메모리 누수 경고 방지)
  process.setMaxListeners(20);
  
  console.log(`${colors.CYAN}${'='.repeat(50)}${colors.NC}`);
  console.log(`${colors.CYAN}       WebKit Agent for Coupang Crawler${colors.NC}`);
  console.log(`${colors.CYAN}${'='.repeat(50)}${colors.NC}`);
  console.log('');
  
  try {
    // 시스템 초기화 (브라우저 + 프록시)
    await initSystem();
    
    // 무한 루프
    while (true) {
      try {
        // 1. 프록시 5번 사용 후 local 재시도 확인
        if (proxyManager && proxyManager.shouldRetryLocal()) {
          const needRestart = proxyManager.switchToLocal();
          if (needRestart) {
            await restartBrowser();
          }
        }
        
        // 2. 프록시 로테이션 확인 (매 작업마다 프록시 변경)
        if (proxyManager && proxyManager.shouldRotateProxy()) {
          const needRestart = proxyManager.rotateProxy();
          if (needRestart) {
            await restartBrowser();
          }
        }
        
        // 3. 키워드 가져오기
        const keywordData = await getKeyword();
        
        if (!keywordData) {
          // 키워드 없음 - 대기 시간 증가
          currentDelay = Math.min(currentDelay + DELAY_INCREMENT, MAX_DELAY);
          const seconds = Math.floor(currentDelay / 1000);
          
          // 대기 시간 상태 표시
          if (currentDelay >= MAX_DELAY) {
            log(`처리할 키워드가 없습니다. 최대 대기 시간 ${seconds}초 유지 중...`, 'warning');
          } else {
            log(`처리할 키워드가 없습니다. 대기 시간 증가: ${seconds}초`, 'warning');
          }
          
          await countdown(seconds, '다음 시도까지');
          continue;
        }
        
        // 키워드 있음 - 대기 시간 초기화
        currentDelay = BASE_DELAY;
        
        // 구분선
        console.log(`${colors.BLUE}${'─'.repeat(50)}${colors.NC}`);
        log(`작업 시작: "${keywordData.keyword}"`, 'info');
        
        // 키워드 처리
        const result = await processKeyword(keywordData);
        
        // 프록시 통계 로깅 (5번마다)
        if (proxyManager && (proxyManager.getStatus().stats.localAttempts + proxyManager.getStatus().stats.proxyAttempts) % 5 === 0) {
          proxyManager.logStats();
        }
        
        // 결과에 따른 대기 시간 조정
        if (result && result.success) {
          // 성공 - 기본 대기 시간
          currentDelay = BASE_DELAY;
          log(`✅ 작업 완료. ${BASE_DELAY/1000}초 후 다음 작업...`, 'success');
        } else {
          // 실패 - 대기 시간 증가
          currentDelay = Math.min(currentDelay + DELAY_INCREMENT, MAX_DELAY);
          const nextSeconds = Math.floor(currentDelay / 1000);
          
          if (currentDelay >= MAX_DELAY) {
            log(`⚠️ 작업 실패. 최대 대기 시간 ${nextSeconds}초 유지...`, 'warning');
          } else {
            log(`⚠️ 작업 실패. 대기 시간 증가: ${nextSeconds}초`, 'warning');
          }
        }
        
        // 대기 (카운트다운 표시)
        const waitSeconds = Math.floor(currentDelay / 1000);
        await countdown(waitSeconds, '다음 작업까지');
        
      } catch (error) {
        // API 오류 등 처리 - 대기 시간 증가
        currentDelay = Math.min(currentDelay + DELAY_INCREMENT, MAX_DELAY);
        const seconds = Math.floor(currentDelay / 1000);
        
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
          log(`API 서버 연결 실패. ${seconds}초 후 재시도...`, 'error');
        } else {
          log(formatError(error), 'error');
          log(`${seconds}초 후 재시도...`, 'info');
        }
        
        await countdown(seconds, '재시도까지');
      }
    }
    
  } catch (error) {
    log(`치명적 오류: ${error.message}`, 'error');
    process.exit(1);
    
  } finally {
    // 종료 시 브라우저 정리
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 종료 시그널 처리
 */
process.on('SIGINT', async () => {
  console.log('');
  log('사용자에 의해 종료 중...', 'warning');
  
  if (browser) {
    await browser.close();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('시스템 종료 신호 수신...', 'warning');
  
  if (browser) {
    await browser.close();
  }
  
  process.exit(0);
});

// 처리되지 않은 Promise 거부 처리
process.on('unhandledRejection', (reason) => {
  log(`처리되지 않은 Promise 거부: ${reason}`, 'error');
});

// 메인 함수 실행
if (require.main === module) {
  main().catch(error => {
    log(`시작 오류: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  initBrowser,
  processKeyword,
  main
};
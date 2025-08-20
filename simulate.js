#!/usr/bin/env node

/**
 * WebKit Agent 시뮬레이션 스크립트
 * 실제 API 호출 없이 테스트 데이터로 크롤링 동작 확인
 */

const { webkit } = require('playwright');
const config = require('./config');
const { searchCoupang } = require('./crawler');
const { log, countdown, sleep, colors } = require('./utils');

// 테스트 데이터 (실제 쿠팡 상품 - API 형식과 동일)
const TEST_DATA = [
  {
    id: 1,
    keyword: '삼성 갤럭시버즈',
    product_id: '6403686318',  // product_id 사용
    item_id: '17738274085',
    vendor_item_id: '79520677967'
  },
  {
    id: 2,
    keyword: '에어팟 프로',
    product_id: '6587959920',  // product_id 사용
    item_id: null,
    vendor_item_id: null
  },
  {
    id: 3,
    keyword: 'c타입케이블',
    product_id: '8491054718',  // 실제 API 예시 데이터
    item_id: '24575039429',
    vendor_item_id: '4104448300'
  },
  {
    id: 4,
    keyword: '무선이어폰',
    product_id: '7279806373',  // product_id 사용
    item_id: '19410495858',
    vendor_item_id: '85802089656'
  }
];

let currentIndex = 0;
let browser = null;

/**
 * 시뮬레이션용 키워드 가져오기
 */
function getSimulatedKeyword() {
  const data = TEST_DATA[currentIndex % TEST_DATA.length];
  currentIndex++;
  
  // product_code 또는 product_id 사용
  const productCode = data.product_code || data.product_id;
  
  log(`[시뮬레이션] 키워드 할당: "${data.keyword}" (ID: ${data.id}, 상품코드: ${productCode})`, 'info');
  
  return {
    id: data.id,
    keyword: data.keyword,
    productCode: productCode,
    itemId: data.item_id,
    vendorItemId: data.vendor_item_id
  };
}

/**
 * 시뮬레이션용 결과 전송
 */
function sendSimulatedResult(data) {
  console.log('');
  console.log(`${colors.CYAN}${'='.repeat(50)}${colors.NC}`);
  console.log(`${colors.GREEN}📤 결과 전송 (시뮬레이션)${colors.NC}`);
  console.log(`${colors.CYAN}${'='.repeat(50)}${colors.NC}`);
  
  console.log(`ID: ${data.id}`);
  console.log(`순위: ${data.rank}`);
  
  if (data.rank > 0 && data.product_data) {
    console.log('product_data:');
    Object.entries(data.product_data).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  } else {
    console.log('product_data: {}');
  }
  
  console.log(`${colors.CYAN}${'='.repeat(50)}${colors.NC}`);
  console.log('');
}

/**
 * 단일 키워드 처리
 */
async function processKeyword(keywordData) {
  let page = null;
  const startTime = Date.now();
  
  try {
    // 새 페이지 생성
    page = await browser.newPage({
      viewport: config.browser.viewport
    });
    
    // 크롤링 수행
    log(`🔍 크롤링 시작: "${keywordData.keyword}"`, 'search');
    const result = await searchCoupang(page, keywordData.keyword, keywordData.productCode);
    
    // 처리 시간 계산
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 결과 데이터 준비
    const resultData = {
      id: keywordData.id,
      rank: result.rank || 0,
      product_data: {}
    };
    
    // rank > 0인 경우 product_data 추가
    if (result.rank > 0) {
      resultData.product_data = {
        product_name: result.productName,
        thumbnail_url: result.thumbnailUrl,
        rating: result.rating,
        review_count: result.reviewCount,
        // 가격 정보
        before_price: result.beforePrice,
        sale_price: result.salePrice,
        discount_percent: result.discountPercent,
        // 단가 정보
        unit_label: result.unitLabel,
        unit_price: result.unitPrice,
        // 배송 정보
        free_ship: result.freeShip,
        free_return: result.freeReturn,
        delivery_info: result.deliveryInfo,
        // 추가 정보
        coupang_pick: result.coupangPick,
        discount_types: result.discountTypes,
        point_benefit: result.pointBenefit,
        delivery_keys: result.deliveryKeys ? result.deliveryKeys.join(',') : null,
        is_soldout: result.isSoldout,
        soldout_text: result.soldoutText,
        product_url: result.productUrl,
        // 메타데이터
        elapsed_time: parseFloat(elapsedTime),
        search_keyword: keywordData.keyword,
        product_code: keywordData.productCode
      };
    }
    
    // 결과 전송 (시뮬레이션)
    sendSimulatedResult(resultData);
    
    // 결과 표시
    if (result.rank > 0) {
      log(`✅ 완료: 순위=${result.rank}, 상품명="${result.productName}", 시간=${elapsedTime}초`, 'success');
    } else {
      log(`❌ 완료: 상품 없음, 시간=${elapsedTime}초`, 'warning');
    }
    
    return { success: true, ...result };
    
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`❌ 오류: ${error.message}, 시간=${elapsedTime}초`, 'error');
    
    // 오류 발생 시 결과 전송하지 않음
    log('⚠️ 오류로 인해 결과 전송 안함', 'warning');
    
    return { success: false, error: error.message };
    
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // 무시
      }
    }
  }
}

/**
 * 메인 시뮬레이션 함수
 */
async function simulate() {
  console.log(`${colors.YELLOW}${'='.repeat(50)}${colors.NC}`);
  console.log(`${colors.YELLOW}    🧪 WebKit Agent 시뮬레이션 모드${colors.NC}`);
  console.log(`${colors.YELLOW}${'='.repeat(50)}${colors.NC}`);
  console.log('');
  console.log(`${colors.CYAN}테스트 데이터: ${TEST_DATA.length}개${colors.NC}`);
  console.log(`${colors.CYAN}브라우저: WebKit (GUI 모드)${colors.NC}`);
  console.log('');
  
  try {
    // 브라우저 초기화
    log('WebKit 브라우저 초기화 중...', 'info');
    browser = await webkit.launch({
      headless: config.browser.headless
      // WebKit은 args를 지원하지 않음
    });
    log('WebKit 브라우저 시작 완료', 'success');
    
    // 시뮬레이션 루프
    let runCount = 0;
    const maxRuns = TEST_DATA.length * 2; // 각 데이터를 2번씩 테스트
    
    while (runCount < maxRuns) {
      runCount++;
      
      console.log('');
      console.log(`${colors.BLUE}${'━'.repeat(50)}${colors.NC}`);
      console.log(`${colors.BLUE}실행 #${runCount}/${maxRuns}${colors.NC}`);
      console.log(`${colors.BLUE}${'━'.repeat(50)}${colors.NC}`);
      
      // 키워드 가져오기 (시뮬레이션)
      const keywordData = getSimulatedKeyword();
      
      // 키워드 처리
      await processKeyword(keywordData);
      
      // 마지막 실행이 아니면 카운트다운
      if (runCount < maxRuns) {
        await countdown(3, '다음 테스트까지');
      }
    }
    
    // 완료
    console.log('');
    console.log(`${colors.GREEN}${'='.repeat(50)}${colors.NC}`);
    console.log(`${colors.GREEN}✅ 시뮬레이션 완료!${colors.NC}`);
    console.log(`${colors.GREEN}총 ${maxRuns}개 테스트 완료${colors.NC}`);
    console.log(`${colors.GREEN}${'='.repeat(50)}${colors.NC}`);
    
  } catch (error) {
    log(`치명적 오류: ${error.message}`, 'error');
    
  } finally {
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  }
}

// Ctrl+C 처리
process.on('SIGINT', async () => {
  console.log('');
  log('시뮬레이션 중단...', 'warning');
  
  if (browser) {
    await browser.close();
  }
  
  process.exit(0);
});

// 메인 실행
if (require.main === module) {
  simulate().catch(error => {
    log(`시뮬레이션 시작 오류: ${error.message}`, 'error');
    process.exit(1);
  });
}
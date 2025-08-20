const axios = require('axios');
const config = require('./config');
const { log, formatError } = require('./utils');

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: config.apiUrl,
  timeout: 20000,
  headers: {
    'User-Agent': 'WebKit-Agent/1.0',
    'Content-Type': 'application/json'
  }
});

/**
 * API에서 키워드 가져오기
 * @returns {Promise<Object>} 키워드 데이터
 */
async function getKeyword() {
  try {
    log('API에서 키워드 요청 중...', 'info');
    
    const response = await apiClient.get('/assign');
    
    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      // product_code가 없으면 product_id 사용
      const productCode = data.product_code || data.product_id;
      log(`키워드 수신: "${data.keyword}" (상품코드: ${productCode})`, 'success');
      
      return {
        id: data.id,
        keyword: data.keyword,
        productCode: productCode,
        itemId: data.item_id,
        vendorItemId: data.vendor_item_id
      };
    } else {
      throw new Error('Invalid API response format');
    }
    
  } catch (error) {
    if (error.response) {
      // 서버가 응답을 반환한 경우
      if (error.response.status === 404) {
        log('처리할 키워드가 없습니다', 'warning');
        return null;
      }
      log(`API 오류: ${error.response.status} - ${error.response.statusText}`, 'error');
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못한 경우
      log('API 서버에 연결할 수 없습니다', 'error');
    } else {
      // 요청 설정 중 오류 발생
      log(formatError(error), 'error');
    }
    
    throw error;
  }
}

/**
 * 결과를 API로 전송 (정상 케이스만)
 * @param {Object} result - 전송할 결과 데이터
 */
async function sendResult(result) {
  try {
    // 오류가 있는 경우 전송하지 않음
    if (result.error) {
      log('⚠️ 오류 발생 - API 전송 안함', 'warning');
      return { success: false, reason: 'ERROR_SKIP' };
    }
    
    // 결과 데이터 검증
    if (!result || !result.id || result.rank === undefined) {
      log('❌ 필수 데이터 누락 - API 전송 안함', 'error');
      return { success: false, reason: 'INVALID_DATA' };
    }
    
    // 전송할 데이터 준비 (새로운 형식)
    const data = {
      id: result.id,
      rank: result.rank || 0,
      product_data: {}  // JSONB로 저장될 자유 형식 객체
    };
    
    // rank > 0인 경우에만 product_data 추가
    if (result.rank > 0) {
      // 기본 상품 정보
      if (result.productName) data.product_data.product_name = result.productName;
      if (result.thumbnailUrl) data.product_data.thumbnail_url = result.thumbnailUrl;
      if (result.rating !== null && result.rating !== undefined) {
        data.product_data.rating = result.rating;
      }
      if (result.reviewCount !== null && result.reviewCount !== undefined) {
        data.product_data.review_count = result.reviewCount;
      }
      
      // 가격 정보
      if (result.beforePrice !== null && result.beforePrice !== undefined) {
        data.product_data.before_price = result.beforePrice;
      }
      if (result.salePrice !== null && result.salePrice !== undefined) {
        data.product_data.sale_price = result.salePrice;
      }
      if (result.discountPercent !== null && result.discountPercent !== undefined) {
        data.product_data.discount_percent = result.discountPercent;
      }
      
      // 단가 정보
      if (result.unitLabel) data.product_data.unit_label = result.unitLabel;
      if (result.unitPrice !== null && result.unitPrice !== undefined) {
        data.product_data.unit_price = result.unitPrice;
      }
      
      // 배송 정보
      if (result.freeShip !== null && result.freeShip !== undefined) {
        data.product_data.free_ship = result.freeShip;
      }
      if (result.freeReturn !== null && result.freeReturn !== undefined) {
        data.product_data.free_return = result.freeReturn;
      }
      if (result.deliveryInfo) data.product_data.delivery_info = result.deliveryInfo;
      
      // 추가 정보
      if (result.coupangPick !== null && result.coupangPick !== undefined) {
        data.product_data.coupang_pick = result.coupangPick;
      }
      if (result.discountTypes && result.discountTypes.length > 0) {
        data.product_data.discount_types = result.discountTypes;
      }
      if (result.pointBenefit) data.product_data.point_benefit = result.pointBenefit;
      if (result.deliveryKeys && result.deliveryKeys.length > 0) {
        // 배열을 쉼표로 구분된 문자열로 변환
        data.product_data.delivery_keys = result.deliveryKeys.join(',');
      }
      
      // 품절 정보
      if (result.isSoldout) {
        data.product_data.is_soldout = true;
        data.product_data.soldout_text = result.soldoutText;
      }
      
      // 상품 URL
      if (result.productUrl) data.product_data.product_url = result.productUrl;
    }
    
    // POST 데이터 확인 (전송 직전)
    console.log('');
    console.log('=' .repeat(50));
    console.log('📤 POST 데이터 확인:');
    console.log('=' .repeat(50));
    console.log(JSON.stringify(data, null, 2));
    console.log('=' .repeat(50));
    console.log('');
    
    // 결과 로깅
    if (result.rank > 0) {
      log(`✅ 상품 찾음: 순위=${data.rank}, 상품명="${data.product_data.product_name || 'N/A'}"`, 'success');
    } else {
      log(`📭 전체 페이지 검색 완료: 상품 없음`, 'warning');
    }
    
    // 실제 전송
    log('API로 결과 전송 중...', 'info');
    const response = await apiClient.post('/result', data);
    
    if (response.data && response.data.success) {
      log('결과 전송 성공', 'success');
      return response.data;
    } else {
      throw new Error('Result submission failed');
    }
    
  } catch (error) {
    log(`결과 전송 실패: ${error.message}`, 'error');
    return { success: false, reason: 'EXCEPTION' };
  }
}

/**
 * 에러 로깅 (사용 안함)
 * @deprecated 오류 시 API 전송하지 않음
 */
// async function logError(errorData) {
//   // 오류는 API로 전송하지 않음
// }

module.exports = {
  getKeyword,
  sendResult
  // logError - 제거됨
};
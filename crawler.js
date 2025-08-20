const config = require('./config');
const { log, sleep, getErrorType } = require('./utils');

/**
 * 쿠팡에서 상품 검색 및 순위 확인
 * @param {Page} page - Playwright page 객체
 * @param {string} keyword - 검색 키워드
 * @param {string} productCode - 상품 코드
 * @returns {Promise<Object>} 검색 결과
 */
async function searchCoupang(page, keyword, productCode) {
  try {
    const result = {
      rank: 0,
      productName: null,
      thumbnailUrl: null,
      rating: null,
      reviewCount: null,
      // 추가 상품 정보 필드
      beforePrice: null,
      salePrice: null,
      discountPercent: null,
      unitLabel: null,
      unitPrice: null,
      freeShip: false,
      freeReturn: false,
      coupangPick: false,
      discountTypes: [],
      pointBenefit: null,
      deliveryInfo: null,
      deliveryKeys: [],
      isSoldout: false,
      soldoutText: null,
      productUrl: null
    };
    
    // URL 직접 이동 방식으로 검색
    await searchByUrl(page, keyword);
    
    // 에러 페이지 체크
    const isErrorPage = await checkErrorPage(page);
    if (isErrorPage) {
      throw new Error('BLOCKED: Error page detected');
    }
    
    // 검색 결과 없음 체크
    const hasNoResult = await checkNoResult(page);
    if (hasNoResult) {
      log(`검색 결과 없음: ${keyword}`, 'warning');
      return result;
    }
    
    // 상품 리스트 대기
    await waitForProductList(page);
    
    // 페이지별로 상품 검색
    const maxPages = config.crawler.maxPages;
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      log(`페이지 ${currentPage}/${maxPages} 검색 중...`, 'search');
      
      // 현재 페이지에서 상품 찾기
      const pageResult = await findProductInPage(page, productCode);
      
      if (pageResult) {
        // 전체 순위 계산
        result.rank = (currentPage - 1) * 72 + pageResult.rank;
        result.productName = pageResult.productName;
        result.thumbnailUrl = pageResult.thumbnailUrl;
        result.rating = pageResult.rating;
        result.reviewCount = pageResult.reviewCount;
        
        // 추가 상품 정보 복사
        result.beforePrice = pageResult.beforePrice;
        result.salePrice = pageResult.salePrice;
        result.discountPercent = pageResult.discountPercent;
        result.unitLabel = pageResult.unitLabel;
        result.unitPrice = pageResult.unitPrice;
        result.freeShip = pageResult.freeShip;
        result.freeReturn = pageResult.freeReturn;
        result.coupangPick = pageResult.coupangPick;
        result.discountTypes = pageResult.discountTypes;
        result.pointBenefit = pageResult.pointBenefit;
        result.deliveryInfo = pageResult.deliveryInfo;
        result.deliveryKeys = pageResult.deliveryKeys;
        result.isSoldout = pageResult.isSoldout;
        result.soldoutText = pageResult.soldoutText;
        result.productUrl = pageResult.productUrl;
        
        // log(`상품 발견! 순위: ${result.rank}, 상품명: ${result.productName}`, 'success');
        return result;
      }
      
      // 다음 페이지로 이동
      if (currentPage < maxPages) {
        const moved = await moveToNextPage(page, currentPage + 1);
        if (!moved) {
          log('더 이상 페이지가 없습니다', 'info');
          break;
        }
      }
    }
    
    log(`상품을 찾을 수 없음: ${productCode}`, 'warning');
    return result;
    
  } catch (error) {
    const errorType = getErrorType(error.message);
    
    if (errorType === 'BLOCKED') {
      log(`차단 감지: ${keyword}`, 'error');
    } else if (errorType === 'TIMEOUT') {
      log(`타임아웃: ${keyword}`, 'error');
    } else {
      log(`크롤링 오류: ${error.message}`, 'error');
    }
    
    throw error;
  }
}

/**
 * URL 직접 이동 방식으로 검색
 */
async function searchByUrl(page, keyword) {
  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user&failRedirectApp=true&page=1&listSize=72`;
  
  log('쿠팡 검색 페이지 접속 중... (URL 직접 이동)', 'info');
  
  await page.goto(searchUrl, {
    waitUntil: 'load',
    timeout: config.crawler.timeout
  });
  
  await sleep(config.delays.pageLoad);
}

/**
 * 에러 페이지 체크
 */
async function checkErrorPage(page) {
  return await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const pageTitle = document.title || '';
    
    return bodyText.includes('Secure Connection Failed') ||
           bodyText.includes('NS_ERROR_NET_INTERRUPT') ||
           bodyText.includes('Stream error in the HTTP/2 framing layer') ||
           bodyText.includes('ERR_') ||
           bodyText.includes('HTTP2_PROTOCOL_ERROR') ||
           pageTitle.includes('Error') ||
           pageTitle.includes('오류');
  });
}

/**
 * 검색 결과 없음 체크
 */
async function checkNoResult(page) {
  return await page.evaluate(() => {
    const noResultElement = document.querySelector('[class^=no-result_magnifier]');
    const noResultText = document.body?.innerText?.includes('에 대한 검색결과가 없습니다');
    return !!noResultElement || !!noResultText;
  });
}

/**
 * 상품 리스트 대기
 */
async function waitForProductList(page) {
  try {
    await page.waitForSelector('#product-list > li[data-id]', {
      timeout: config.crawler.waitTimeout
    });
  } catch (error) {
    const pageUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    
    if (pageUrl.includes('error') || pageTitle.includes('Error')) {
      throw new Error('BLOCKED: Error page detected');
    }
    
    throw new Error('Product list not found');
  }
}

/**
 * 현재 페이지에서 상품 찾기
 */
async function findProductInPage(page, productCode) {
  const result = await page.evaluate((targetCode) => {
    // ---------- 헬퍼 함수들 ----------
    const toNumber = (s) => s ? Number((s+'').replace(/[^\d.]/g,'')) : null;
    
    const pickText = (root, sels) => {
      for (const s of sels) {
        const el = root.querySelector(s);
        const t = el?.textContent?.trim();
        if (t) return t;
      }
      return null;
    };
    
    // img src/srcset에서 URL 추출
    const pickUrlFromImg = (img) => {
      const src = img.getAttribute('src') || '';
      if (src) return src;
      const srcset = img.getAttribute('srcset') || '';
      if (!srcset) return '';
      const last = srcset.split(',').pop().trim();
      return last.split(' ')[0];
    };
    
    // URL에서 아이콘 키 추출 (파일명의 @ 앞부분)
    const iconKeyFromUrl = (url) => {
      if (!url) return null;
      const file = (url.split('?')[0] || '').split('/').pop(); // e.g. rocketwow-bi-16@2x.png
      return file.split('@')[0];                                // → rocketwow-bi-16
    };
    
    // 단가 정보 찾기 (예: "1세트당 1,770원")
    const findUnitInfo = (li) => {
      const scope = li.querySelector('[class*="Price"], [class*="price"]') || li;
      const nodes = scope.querySelectorAll('span, div, p, strong, em');
      for (const el of nodes) {
        const t = el.textContent?.replace(/\s+/g,' ').trim();
        const m = t && t.match(/\(([^()]*?당)\s*([\d,]+)\s*원\)/);
        if (m) {
          return {
            unitLabel: m[1],
            unitPrice: Number(m[2].replace(/,/g,''))
          };
        }
      }
      return null;
    };
    
    // 할인 타입 감지
    const detectDiscountTypes = (li) => {
      const area = li.querySelector('[class*="Price"], [class*="price"]') || li;
      const txt = area.innerText || '';
      const out = [];
      if (/와우할인/.test(txt)) out.push('와우할인');
      if (/쿠폰할인/.test(txt)) out.push('쿠폰할인');
      return out;
    };
    
    // 포인트 혜택 추출
    const getPointBenefit = (li) => {
      return pickText(li, ['[class*="cash-benefit"] span']) ||
             li.querySelector('[class*="cash-benefit"] img')?.getAttribute('alt') ||
             null;
    };
    
    const products = document.querySelectorAll('#product-list > li[data-id]');
    
    // 광고 제외한 실제 상품만 필터링
    const filteredProducts = Array.from(products).filter(item => {
      const linkElement = item.querySelector('a');
      const adMarkElement = item.querySelector('[class*=AdMark]');
      const href = linkElement ? linkElement.getAttribute('href') : '';
      return !adMarkElement && !href.includes('sourceType=srp_product_ads');
    });
    
    // 상품 검색
    for (let i = 0; i < filteredProducts.length; i++) {
      const product = filteredProducts[i];
      const linkElement = product.querySelector('a');
      
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        
        // ID 추출
        const productIdMatch = href.match(/\/vp\/products\/(\d+)/);
        const itemIdMatch = href.match(/itemId=(\d+)/);
        const vendorItemIdMatch = href.match(/vendorItemId=(\d+)/);
        
        const productId = productIdMatch ? productIdMatch[1] : null;
        const itemId = itemIdMatch ? itemIdMatch[1] : null;
        const vendorItemId = vendorItemIdMatch ? vendorItemIdMatch[1] : null;
        
        // 상품 코드 매칭 (product_code 우선 체크)
        const codeStr = String(targetCode);
        
        // product_code (data-id 또는 productId) 우선 체크
        const isProductMatch = String(product.dataset.id) === codeStr || 
                              String(productId) === codeStr;
        
        // item_id, vendor_item_id는 보조 체크 (옵션 차이로 없을 수 있음)
        const isOptionMatch = String(itemId) === codeStr || 
                            String(vendorItemId) === codeStr;
        
        if (isProductMatch || isOptionMatch) {
          
          // 품절 상품 체크 (가격 정보 추출 전에 확인)
          const soldoutElement = product.querySelector('[class*="soldoutText"]');
          const isSoldout = !!soldoutElement;
          const soldoutText = soldoutElement?.textContent?.trim() || null;
          
          // 상품 URL 생성
          const productUrl = href ? `https://www.coupang.com${href}` : null;
          
          // 상품 정보 추출
          const imgElement = product.querySelector('img');
          const productName = imgElement ? imgElement.getAttribute('alt') : 'Unknown';
          const thumbnailUrl = imgElement ? imgElement.getAttribute('src') : null;
          
          let rating = null;
          let reviewCount = null;
          
          // 평점 정보 추출
          try {
            const ratingContainer = product.querySelector('[class*="ProductRating_productRating__"]');
            if (ratingContainer) {
              const ratingSpan = ratingContainer.querySelector('[class*="ProductRating_rating__"]');
              if (ratingSpan) {
                const ratingText = ratingSpan.textContent.trim();
                const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                if (ratingMatch) {
                  rating = parseFloat(ratingMatch[1]);
                }
              }
              
              const reviewCountElement = ratingContainer.querySelector('[class*="ProductRating_ratingCount__"]');
              if (reviewCountElement) {
                const reviewText = reviewCountElement.textContent || reviewCountElement.innerText;
                const reviewMatch = reviewText.match(/\(?\s*(\d+)\s*\)?/);
                if (reviewMatch) {
                  reviewCount = parseInt(reviewMatch[1]);
                }
              }
            }
          } catch (e) {
            // 평점 추출 실패 무시
          }
          
          // ---------- 추가 상품 정보 추출 ----------
          
          // 가격 정보 (품절이 아닌 경우에만 추출)
          const beforePrice = isSoldout ? null : toNumber(
            pickText(product, ['del[class*="basePrice"]','del','[class*="basePrice"]'])
          );
          const discountPercent = isSoldout ? null : toNumber(
            pickText(product, ['[class*="discountRate"]','[class*="discount-percent"]','[class*="discount"]'])
          );
          const salePrice = isSoldout ? null : toNumber(
            pickText(product, ['strong[class*="priceValue"]','[class*="price"] strong','strong'])
          );
          
          // 단가 정보
          const unitInfo = findUnitInfo(product);
          
          // 무료배송/무료반품
          const shipTxt = (product.querySelector('[class*="DeliveryInfo"]')?.innerText || product.innerText || '');
          const freeShip = /무료배송/.test(shipTxt);
          const freeReturn = /무료반품/.test(shipTxt);
          
          // 쿠팡 추천 (쿠팡픽)
          const coupangPick = 
            !!product.querySelector('.ImageBadge_coupick__') ||
            !!product.querySelector('img[alt="쿠팡추천"]') ||
            Array.from(product.querySelectorAll('img')).some(img => /coupick/i.test(img.getAttribute('src')||''));
          
          // 할인 타입
          const discountTypes = detectDiscountTypes(product);
          
          // 포인트 혜택
          const pointBenefit = getPointBenefit(product);
          
          // 배송 아이콘 키 추출 (이미지 파일명에서)
          const shipImgs = product.querySelectorAll('[class*="ImageBadge"] img');
          const deliveryKeys = Array.from(shipImgs).map(img => iconKeyFromUrl(pickUrlFromImg(img))).filter(Boolean);
          
          // 배송 정보 텍스트
          const deliveryInfo = product.querySelector('[class*="DeliveryInfo"]')?.textContent?.trim() || null;
          
          return {
            rank: i + 1,
            productName: productName,
            thumbnailUrl: thumbnailUrl,
            rating: rating,
            reviewCount: reviewCount,
            // 추가 정보
            beforePrice: beforePrice,
            salePrice: salePrice,
            discountPercent: discountPercent,
            unitLabel: unitInfo?.unitLabel || null,
            unitPrice: unitInfo?.unitPrice || null,
            freeShip: freeShip,
            freeReturn: freeReturn,
            coupangPick: coupangPick,
            discountTypes: discountTypes,
            pointBenefit: pointBenefit,
            deliveryInfo: deliveryInfo,
            deliveryKeys: deliveryKeys,
            // 품절 정보
            isSoldout: isSoldout,
            soldoutText: soldoutText,
            // 상품 URL
            productUrl: productUrl
          };
        }
      }
    }
    
    return null;
  }, productCode);
  
  return result;
}

/**
 * 다음 페이지로 이동
 */
async function moveToNextPage(page, targetPage) {
  try {
    // 페이지 버튼 존재 확인
    const hasButton = await page.evaluate((pageNum) => {
      const button = document.querySelector(`a[data-page="${pageNum}"]`);
      return !!button;
    }, targetPage);
    
    if (!hasButton) {
      return false;
    }
    
    // 페이지네이션으로 스크롤
    await page.evaluate(() => {
      const pagination = document.querySelector('[class*="Pagination_pagination"]') ||
                        document.querySelector('.pagination') ||
                        document.querySelector('[class*="pagination"]');
      if (pagination) {
        pagination.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    
    await sleep(1000);
    
    // 버튼 클릭
    const buttonSelector = `a[data-page="${targetPage}"]`;
    await page.hover(buttonSelector);
    await sleep(300);
    
    // 시각적 효과
    await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      if (button) {
        button.style.transition = 'all 0.3s ease';
        button.style.transform = 'scale(1.1)';
        button.style.backgroundColor = '#FFD700';
        button.style.boxShadow = '0 0 20px rgba(255,69,0,0.8)';
        
        setTimeout(() => {
          button.style.transform = '';
          button.style.backgroundColor = '';
          button.style.boxShadow = '';
        }, 300);
      }
    }, buttonSelector);
    
    await page.click(buttonSelector, { delay: 100 });
    
    // 페이지 로드 대기
    await page.waitForLoadState('load');
    
    // URL 변경 확인
    await page.waitForFunction(
      pageNum => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('page') === String(pageNum);
      },
      targetPage,
      { timeout: 20000 }
    );
    
    await sleep(config.delays.pageNavigation);
    
    return true;
    
  } catch (error) {
    log(`페이지 ${targetPage} 이동 실패: ${error.message}`, 'warning');
    return false;
  }
}

module.exports = {
  searchCoupang
};
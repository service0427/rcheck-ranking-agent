# WebKit Agent for Coupang Crawler

WebKit 브라우저를 사용한 쿠팡 상품 순위 크롤링 에이전트

## 📁 파일 구조

```
agent-webkit/
├── index.js        # 메인 실행 파일 (실제 운영)
├── simulate.js     # 시뮬레이션 모드 (테스트용)
├── config.js       # 설정 파일
├── api.js          # API 통신 모듈
├── crawler.js      # 크롤링 로직
├── utils.js        # 유틸리티 함수
├── package.json    # 의존성 관리
└── README.md       # 이 파일
```

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
cd /home/tech/v3_hub_agent/agent-webkit
npm install
```

### 2. 실행 방법

#### 기본 실행 (Headless 모드)
```bash
# 운영 모드 - headless로 실행
node index.js

# 시뮬레이션 모드 - headless로 실행  
node simulate.js
```

#### GUI 모드 실행
```bash
# 운영 모드 - 브라우저 화면 표시
node index.js --no-headless

# 시뮬레이션 모드 - 브라우저 화면 표시
node simulate.js --no-headless
```

#### 도움말
```bash
node index.js --help
node simulate.js --help
```

**참고:**
- 기본값: Headless 모드 (서버 환경용)
- `--no-headless`: GUI 모드로 브라우저 창 표시 (디버깅용)

## 🔧 주요 기능

### 상품 매칭 우선순위
1. **product_id** (우선): 상품의 고유 ID (product_code와 동일)
2. **item_id/vendor_item_id** (보조): 옵션별 ID (없을 수 있음)

### API 형식

#### 키워드 요청 (GET /api/topr/assign)
```json
{
  "success": true,
  "data": {
    "id": 277,
    "keyword": "c타입케이블",
    "product_id": "8491054718",
    "item_id": "24575039429",
    "vendor_item_id": "4104448300"
  }
}
```

#### 결과 전송 (POST /api/topr/result)
```json
{
  "id": 809,
  "rank": 5,
  "product_data": {
    "product_name": "물고기 모양 반지",
    "thumbnail_url": "https://...",
    "rating": 4.8,
    "review_count": 2567,
    "crawled_at": "2025-08-20T10:30:00Z",
    "browser": "webkit",
    "elapsed_time": 3.2,
    "search_keyword": "물고기반지",
    "product_code": "8310098884"
  }
}
```

## 📊 시뮬레이션 테스트 데이터

```javascript
// 실제 쿠팡 상품 예시
{
  keyword: "삼성 갤럭시버즈",
  product_code: "6403686318"
}

{
  keyword: "에어팟 프로",
  product_code: "6587959920"
}

{
  keyword: "무선이어폰",
  product_code: "7279806373"
}
```

## 🎯 특징

- **GUI 모드**: WebKit 브라우저를 화면에 표시
- **3초 딜레이**: 각 처리 후 3초 대기
- **시각적 피드백**: 색상과 이모지로 상태 표시
- **에러 처리**: 차단, 타임아웃 등 감지
- **JSONB 지원**: product_data는 자유로운 형식으로 확장 가능

## ⚙️ 설정 변경

`config.js` 파일에서 다음 설정 가능:
- 브라우저 옵션 (headless, viewport)
- 딜레이 시간
- 크롤링 옵션 (maxPages, searchMode)
- API URL

## 🔍 디버깅

로그 레벨 변경:
```javascript
// config.js
logging: {
  level: 'debug'  // 'debug', 'info', 'warn', 'error'
}
```

## 📝 참고사항

- product_code를 우선으로 체크하므로 옵션이 다른 상품도 찾을 수 있음
- WebKit은 Chrome/Firefox와 다르게 동작할 수 있음
- 무한 로딩 감지 로직 포함
- Ctrl+C로 안전하게 종료 가능
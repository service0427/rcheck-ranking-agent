# WebKit Agent 실행 가이드

## 빠른 시작

### 1. 운영 실행 (실제 API 연동)
```bash
cd /home/tech/v3_hub_agent/agent-webkit
node index.js
```

### 2. 테스트 실행 (API 없이)
```bash
cd /home/tech/v3_hub_agent/agent-webkit
node simulate.js
```

## 설정 확인

### Headless 모드 (서버용)
```javascript
// config.js
browser: {
  headless: true  // 서버 환경
}
```

### GUI 모드 (로컬용)
```javascript
// config.js
browser: {
  headless: false  // GUI 환경
}
```

## 실행 결과 예시

```
==================================================
📤 POST 데이터 확인:
==================================================
{
  "id": 1224,
  "rank": 223,
  "product_data": {
    "product_name": "상품명",
    "thumbnail_url": "이미지 URL",
    "rating": 5,
    "review_count": 147,
    "before_price": 49500,
    "sale_price": 19800,
    "discount_percent": 60,
    "delivery_keys": "logoRocketMerchantLargeV3R3"
  }
}

✅ 상품 찾음: 순위=223
📌 API로 결과 전송 중...
✅ 결과 전송 성공
```

## 프로세스 관리

### 백그라운드 실행
```bash
nohup node index.js > agent.log 2>&1 &
```

### 프로세스 확인
```bash
ps aux | grep "node index.js"
```

### 프로세스 종료
```bash
pkill -f "node index.js"
```

## 로그 확인
```bash
# 실시간 로그 보기
tail -f agent.log

# 최근 100줄 보기
tail -n 100 agent.log

# 오류만 보기
grep "❌\|error" agent.log
```
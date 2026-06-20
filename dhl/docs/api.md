# DHL API 文档

## 已确认接口

### 追踪查询 API

| 属性 | 值 |
|------|-----|
| URL | `https://www.dhl.com/utapi` |
| Method | GET |
| Content-Type | application/json |
| 是否需要 Akamai | **否（200 直接返回）** |

### 请求参数

| 参数 | 值 | 说明 |
|------|-----|------|
| trackingNumber | XUZA59875 | 运单号 |
| language | zh | 语言 |
| requesterCountryCode | CN | 请求国家 |
| source | tt | 来源标识 (Track & Trace) |
| inputsource | marketingstage | 输入来源 |

### 请求 Headers

| Header | 值 |
|--------|-----|
| User-Agent | Chrome 149 Windows |
| Accept | */* |
| Referer | https://www.dhl.com/cn-zh/home/tracking.html |

### 真实响应样本 (XUZA59875)

```json
{
  "shipments": [{
    "id": "XUZA59875",
    "service": "dgf",
    "origin": {"address": {"addressLocality": "Shanghai", "countryCode": "CN"}},
    "destination": {"address": {"addressLocality": "Treto", "countryCode": "ES"}},
    "status": {
      "timestamp": "2025-08-08T11:56:00+02:00",
      "statusCode": "delivered",
      "description": "Shipment Delivered"
    },
    "details": {
      "product": {"productName": "Less than Container Load"},
      "carrier": {"organizationName": "OCEAN"},
      "totalNumberOfPieces": 8,
      "weight": {"unitText": "KGM", "value": 1324.8},
      "volume": {"unitText": "MTQ", "value": 7.616},
      "references": [...],
      "dgf:routes": [{
        "dgf:vesselName": "EUGEN MAERSK",
        "dgf:vesselNumber": "9321550",
        "dgf:voyageFlightNumber": "525W",
        ...
      }]
    },
    "events": [
      {"timestamp": "2025-08-08T11:56:00+02:00", "statusCode": "delivered", "description": "Shipment Delivered"},
      {"timestamp": "2025-08-07T08:36:00+02:00", "statusCode": "transit", "description": "Import Customs Cleared"},
      ...
    ]
  }]
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| shipments[].id | string | 运单号 |
| shipments[].service | string | 服务类型 (dgf=货运) |
| shipments[].origin | object | 始发地 |
| shipments[].destination | object | 目的地 |
| shipments[].status.statusCode | string | 状态码 (delivered/transit/pre-transit) |
| shipments[].status.timestamp | string | 状态时间 ISO 8601 |
| shipments[].details.weight | object | 重量 (unitText + value) |
| shipments[].details.volume | object | 体积 |
| shipments[].details.totalNumberOfPieces | int | 件数 |
| shipments[].details.references | array | 参考号列表 |
| shipments[].details["dgf:routes"] | array | 货运路线 |
| shipments[].events | array | 物流事件时间线 |

### 首页 (含 Akamai 脚本)

| 属性 | 值 |
|------|-----|
| URL | `https://www.dhl.com/cn-zh/home/tracking.html` |
| 返回 | HTML 页面，内含 Akamai sensor JS 路径 |
| Akamai 脚本 | 从 HTML 中 `<script>` 标签提取，路径格式：`/XXXX/XXXX/...` (随机化) |

### Akamai 验证流程 (理论)

```
1. GET /tracking.html → HTML (含 JS 路径)
2. 提取: type="text/javascript" src="(.*?)"
3. GET /{random_path}/... → sensor.js (77KB 混淆)
4. 浏览器执行 sensor.js → 生成 sensor_data
5. POST /{random_path}/... → 获取有效 _abck (~0~)
```

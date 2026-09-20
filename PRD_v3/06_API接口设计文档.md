# 问问调解平台 - API接口设计文档

**创建日期**：2026-09-09
**更新日期**：2026-09-20
**文档状态**：已确认
**技术栈**：Supabase + Vercel Serverless Functions

> **【2026-09-20 AI 判断盒子同步（v3）】**：新增《调解工作流-AI预判盒子技术方案》——工作流 10 个判断点封装为轻量「判断盒子」，接口见新增「五之二」章；数据表 `ai_box_runs` 见《05》2.25。
> **【2026-09-20 技术分层架构同步（v3）】**：新增《调解平台-技术分层架构》——五层架构（前端/业务服务/AI 中台/签署中台/共享底座）与现有接口的逻辑归属映射，见新增「五之三」章；模块框架见《00》第十八章。

> **【2026-09-14 角色模型变更】**：`role` 仅两值（admin/mediator），主管能力由 `mediators.is_supervisor` 布尔标识叠加（注册审核时勾选），详见 01/05 文档。本文档中「调解员（主管标识）」= role=mediator 且 is_supervisor=true；权限判断统一为 `role + is_supervisor + approvedCourtIds` 三要素。

---

## 一、API设计规范

### 1.1 设计原则

1. **RESTful风格**：遵循RESTful API设计规范，使用HTTP方法表示操作类型
2. **统一响应格式**：所有接口返回统一的JSON格式，包含success、data、error字段
3. **版本控制**：API路径包含版本号，如`/api/v1/...`
4. **认证授权**：使用JWT Token进行身份认证，基于角色的权限控制（RBAC）
5. **分页规范**：列表接口统一使用page和page_size参数进行分页
6. **筛选排序**：支持多条件筛选和排序，使用查询参数传递
7. **错误处理**：统一错误码和错误信息，便于前端处理
8. **幂等性**：写操作支持幂等性，避免重复提交

### 1.2 HTTP方法规范

| 方法 | 用途 | 示例 |
|-----|------|------|
| GET | 查询资源 | GET /api/v1/cases |
| POST | 创建资源 | POST /api/v1/cases |
| PUT | 全量更新资源 | PUT /api/v1/cases/{id} |
| PATCH | 部分更新资源 | PATCH /api/v1/cases/{id} |
| DELETE | 删除资源 | DELETE /api/v1/cases/{id} |

### 1.3 路径命名规范

1. 使用小写字母和连字符（kebab-case）
2. 使用名词复数表示资源集合
3. 层级关系通过路径表示
4. 操作使用动词，如`/sync`、`/assign`、`/approve`

**示例**：
```
GET    /api/v1/cases              # 获取案件列表
GET    /api/v1/cases/{id}         # 获取案件详情
POST   /api/v1/cases              # 创建案件
PUT    /api/v1/cases/{id}         # 更新案件
DELETE /api/v1/cases/{id}         # 删除案件
POST   /api/v1/cases/{id}/assign  # 分案操作
POST   /api/v1/cases/{id}/close   # 结案操作
```

### 1.4 请求头规范

| 请求头 | 说明 | 示例 |
|-------|------|------|
| Authorization | 认证Token | Bearer {jwt_token} |
| Content-Type | 请求内容类型 | application/json |
| X-Request-ID | 请求唯一标识（用于追踪） | uuid |
| X-Client-Version | 客户端版本 | 1.0.0 |

### 1.5 分页参数规范

| 参数 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| page | integer | 1 | 页码，从1开始 |
| page_size | integer | 20 | 每页数量，最大100 |
| sort | string | - | 排序字段，前缀`-`表示降序，如`-created_at` |
| fields | string | - | 返回字段筛选，逗号分隔 |

### 1.6 分页响应格式

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 480,
      "total_pages": 24,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

## 二、统一响应格式

### 2.1 成功响应

```json
{
  "success": true,
  "data": {
    // 业务数据
  },
  "message": "操作成功"
}
```

### 2.2 失败响应

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "参数错误",
    "details": {
      "field": "phone",
      "reason": "手机号格式不正确"
    }
  },
  "request_id": "uuid"
}
```

### 2.3 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| success | boolean | 请求是否成功 |
| data | object/array | 成功时返回的业务数据 |
| message | string | 成功时的提示信息（可选） |
| error | object | 失败时的错误信息 |
| error.code | string | 错误码（见错误码定义） |
| error.message | string | 错误信息（用户可读） |
| error.details | object | 错误详情（可选，用于调试） |
| request_id | string | 请求唯一标识（用于问题追踪） |

---

## 三、错误码定义

### 3.1 通用错误码（1000-1999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| SUCCESS | 200 | 成功 |
| INVALID_PARAMETER | 400 | 参数错误 |
| MISSING_PARAMETER | 400 | 缺少必填参数 |
| UNAUTHORIZED | 401 | 未认证或Token无效 |
| TOKEN_EXPIRED | 401 | Token已过期 |
| FORBIDDEN | 403 | 无权限访问 |
| NOT_FOUND | 404 | 资源不存在 |
| METHOD_NOT_ALLOWED | 405 | 请求方法不允许 |
| CONFLICT | 409 | 资源冲突 |
| RATE_LIMITED | 429 | 请求频率超限 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |

### 3.2 认证错误码（2000-2999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| USER_NOT_FOUND | 404 | 用户不存在 |
| USER_ALREADY_EXISTS | 409 | 用户已存在 |
| INVALID_PASSWORD | 401 | 密码错误 |
| ACCOUNT_DISABLED | 403 | 账号已停用 |
| ACCOUNT_PENDING | 403 | 账号待审核 |
| ROLE_MISMATCH | 403 | 角色不匹配 |
| INVALID_VERIFICATION_CODE | 400 | 验证码错误 |
| VERIFICATION_CODE_EXPIRED | 400 | 验证码已过期 |
| VERIFICATION_CODE_LIMIT | 429 | 验证码发送频率超限 |
| NO_APPROVED_BINDING | 403 | 无已审核通过的法院绑定，暂不可见数据（引导去绑定） |
| BINDING_DUPLICATED | 409 | 该法院+调解组织的有效绑定已存在，请勿重复申请 |
| BINDING_REJECT_REASON_REQUIRED | 400 | 驳回绑定必须填写原因 |
| BINDING_NOT_OPERABLE | 403 | 当前绑定状态不允许该操作（如对已通过记录执行撤回） |
| BINDABLE_OPTION_DISABLED | 400 | 所选法院或调解组织已停用，不可绑定 |

### 3.3 案件错误码（3000-3999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| CASE_NOT_FOUND | 404 | 案件不存在 |
| CASE_ALREADY_EXISTS | 409 | 案件已存在 |
| CASE_STATUS_INVALID | 400 | 案件状态不允许此操作 |
| CASE_ASSIGNMENT_REQUIRED | 400 | 案件需要先分案 |
| CASE_MEDIATOR_MISMATCH | 403 | 非该案件调解员，无权限操作 |
| CASE_RETURN_REASON_REQUIRED | 400 | 退回案件必须填写理由 |
| CASE_RETURN_PENDING | 409 | 该案件已有待审核的申请转案（同一时刻仅允许一条 pending） |

### 3.4 分案错误码（4000-4999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| ASSIGNMENT_NOT_FOUND | 404 | 分案记录不存在 |
| ASSIGNMENT_ALREADY_AUDITED | 409 | 分案已审核，不能重复操作 |
| ASSIGNMENT_AUDIT_TIMEOUT | 400 | 分案审核已超时，默认通过 |
| NO_AVAILABLE_MEDIATOR | 400 | 该法院没有可用的调解员 |
| INVALID_ASSIGNMENT_WEIGHT | 400 | 分案权重配置错误（权重之和必须为1） |

### 3.5 文书错误码（5000-5999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| DOCUMENT_NOT_FOUND | 404 | 文书不存在 |
| DOCUMENT_ALREADY_SIGNED | 409 | 文书已签署，不能修改 |
| DOCUMENT_TEMPLATE_NOT_FOUND | 404 | 文书模板不存在 |
| DOCUMENT_GENERATION_FAILED | 500 | 文书生成失败 |
| INVALID_DOCUMENT_TEMPLATE | 400 | 文书模板格式错误 |

### 3.6 外呼错误码（6000-6999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| CALL_NOT_FOUND | 404 | 外呼记录不存在 |
| RECORDING_REQUIRED | 400 | 外呼记录必须上传录音文件 |
| RECORDING_UPLOAD_FAILED | 500 | 录音文件上传失败 |
| INVALID_RECORDING_FORMAT | 400 | 录音文件格式不支持 |
| RECORDING_TOO_LARGE | 400 | 录音文件大小超过限制 |

### 3.7 财务错误码（7000-7999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| FINANCE_RECORD_NOT_FOUND | 404 | 财务记录不存在 |
| INCOME_CALCULATION_FAILED | 500 | 收益计算失败 |
| INVALID_INCOME_COEFFICIENT | 400 | 收益系数配置错误 |
| FINANCE_AUDIT_REQUIRED | 403 | 需要财务审核权限 |
| FEE_AMOUNT_INVALID | 400 | 费用金额必须大于0 |
| FEE_REFUND_REASON_REQUIRED | 400 | 登记退费必须填写退费原因 |
| FEE_REFUND_EXCEED | 400 | 退费累计不能超过实收累计 |
| FEE_RULE_NOT_FOUND | 404 | 未匹配到收费规则，无法计算应收（请管理员配置） |
| FEE_RECORD_NOT_OPERABLE | 403 | 无权登记/冲销该案件费用 |
| MONTHLY_REPORT_NOT_READY | 409 | 指定月份报表尚未生成 |

### 3.8 AI错误码（8000-8999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| AI_API_ERROR | 500 | AI接口调用失败 |
| AI_API_TIMEOUT | 504 | AI接口超时 |
| AI_API_RATE_LIMIT | 429 | AI接口频率超限 |
| AI_ANALYSIS_FAILED | 500 | AI分析失败 |
| INVALID_AI_CONFIG | 500 | AI配置错误 |

### 3.9 法规库错误码（9000-9999）

| 错误码 | HTTP状态码 | 说明 |
|-------|-----------|------|
| LEGAL_SEARCH_FAILED | 500 | 法规检索失败 |
| LEGAL_DOCUMENT_NOT_FOUND | 404 | 法规文档不存在 |
| LEGAL_API_ERROR | 500 | 法规库接口错误 |

---

## 四、认证与权限

### 4.1 认证方式

使用JWT（JSON Web Token）进行身份认证：
1. 用户登录成功后，服务端签发JWT Token
2. 前端将Token存储在localStorage中
3. 后续请求在Authorization请求头中携带Token：`Bearer {token}`
4. 服务端验证Token有效性和过期时间
5. Token过期后返回401，前端跳转登录页

### 4.2 Token结构

```json
{
  "sub": "user_id",
  "name": "user_name",
  "role": "admin",
  "courts": ["court_id_1", "court_id_2"],
  "iat": 1788236169,
  "exp": 1788322569
}
```

### 4.3 权限控制

采用基于角色的访问控制（RBAC）+ 主管标识叠加：

| 角色 | role 值 | 附加标识 | 权限范围 |
|-----|---------|---------|---------|
| 系统管理员 | admin | — | 全平台所有权限 |
| 调解员（主管标识） | mediator | is_supervisor=true | 管辖法院数据查阅 + 调解员全部操作权限 + 审批结案 + 全组收益明细查阅 |
| 调解员（普通） | mediator | is_supervisor=false | 个人案件相关操作权限 |

### 4.4 权限中间件

每个API接口通过权限中间件验证：
1. 验证Token有效性
2. 验证用户角色是否有访问该接口的权限
3. 验证数据范围权限（如带主管标识的调解员只能访问管辖法院的数据）
4. 权限不足返回403

### 4.5 数据范围控制

| 角色 | 案件数据范围 | 调解员数据范围 | 财务数据范围 |
|-----|------------|--------------|------------|
| 系统管理员 | 所有案件（不受绑定限制） | 所有调解员 | 所有财务数据 |
| 调解员（主管标识） | **已绑定且 approved 法院**的所有案件（查阅）+ 个人案件（操作） | 已绑定法院范围内调解员（查阅，含收益明细） | 已绑定法院财务数据（查阅） |
| 调解员 | 仅个人案件，且案件法院为本人 approved 绑定 | 仅个人信息 | 仅个人收益 |

**绑定强约束（后端强制，不能只靠前端隐藏）**：
- 操作层（调解员，含/不含主管标识）每个数据查询接口，都必须先取当前用户在 `mediator_courts` 中 `bind_status='approved'` 的 `court_id` 集合 `approvedCourtIds`，并把 `court_id IN approvedCourtIds` 作为强制过滤条件。
- `approvedCourtIds` 为空时，列表/看板接口返回空集合并返回业务提示码（提示去绑定/等待审核），不得返回任何法院数据。
- 绑定与审核相关接口见 5.7.2 机构绑定模块。

---

## 五、接口详细设计

### 5.1 认证模块

#### 5.1.1 用户登录

**接口**：`POST /api/v1/auth/login`

**权限**：公开

**请求参数**：
```json
{
  "username": "admin",
  "password": "123456",
  "role": "admin"
}
```

**响应成功**：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "name": "系统管理员",
      "phone": "13800138000",
      "role": "admin",
      "avatar": "url",
      "courts": ["court_id_1"],
      "organizations": ["org_id_1"]
    }
  }
}
```

**可能错误**：INVALID_PARAMETER、USER_NOT_FOUND、INVALID_PASSWORD、ROLE_MISMATCH、ACCOUNT_DISABLED、ACCOUNT_PENDING

#### 5.1.2 发送验证码

**接口**：`POST /api/v1/auth/send-code`

**权限**：公开

**请求参数**：
```json
{
  "phone": "13800138000"
}
```

**响应成功**：
```json
{
  "success": true,
  "message": "验证码发送成功"
}
```

#### 5.1.3 用户注册

**接口**：`POST /api/v1/auth/register`

**权限**：公开

**请求参数**：
```json
{
  "phone": "13800138000",
  "code": "123456",
  "password": "123456",
  "name": "张三",
  "role": "mediator",
  "court_id": "court_id_1",
  "organization_id": "org_id_1"
}
```

**响应成功**：
```json
{
  "success": true,
  "message": "注册申请已提交，请等待审核"
}
```

**注册后处理（对齐 01 §2.4）**：账号置 pending；系统自动将注册时选择的法院+调解组织生成一条机构绑定申请（mediator_courts，bind_status=pending）；审核通过后账号激活+绑定 approved，数据可见性即时开通。

#### 5.1.4 获取当前用户信息

**接口**：`GET /api/v1/auth/me`

**权限**：已认证用户

**响应成功**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "admin",
    "name": "系统管理员",
    "phone": "13800138000",
    "role": "admin",
    "status": "active",
    "courts": [...],
    "organizations": [...]
  }
}
```

#### 5.1.5 退出登录

**接口**：`POST /api/v1/auth/logout`

**权限**：已认证用户

**响应成功**：
```json
{
  "success": true,
  "message": "退出登录成功"
}
```

---

### 5.2 驾驶舱/工作台模块

#### 5.2.1 获取调解驾驶舱数据（系统管理员）

**接口**：`GET /api/v1/dashboard/admin`

**权限**：系统管理员

**查询参数**：
- `court_id`：可选，筛选法院

**响应成功**：
```json
{
  "success": true,
  "data": {
    "core_metrics": {
      "total_cases": 480,
      "in_mediation": 138,
      "closed_cases": 206,
      "success_rate": 76.5,
      "total_amount": 117000000,
      "active_mediators": 18,
      "total_courts": 3
    },
    "pending_items": {...},
    "alerts": [...],
    "court_comparison": [...],
    "mediator_ranking": [...],
    "case_trend": [...],
    "recent_activities": [...]
  }
}
```

#### 5.2.2 获取调解工作台数据（调解员·主管标识）

**接口**：`GET /api/v1/dashboard/mediator`

**权限**：调解员（主管标识）/调解员

**查询参数**：
- `court_id`：可选，调解员（主管标识）切换法院时使用

**响应成功**：
```json
{
  "success": true,
  "data": {
    "today_overview": {...},
    "attention_items": [...],
    "alerts": [...],
    "mediator_ranking": [...],
    "case_type_distribution": {...},
    "recent_activities": [...]
  }
}
```

---

### 5.3 案件管理模块

#### 5.3.1 获取案件列表

**接口**：`GET /api/v1/cases`

**权限**：
- 系统管理员：所有案件
- 调解员（主管标识）：管辖法院所有案件
- 调解员：仅个人案件

**查询参数**：
- `page`：页码，默认1
- `page_size`：每页数量，默认20
- `court_id`：法院ID筛选
- `status`：案件状态筛选
- `case_type`：案件类型筛选
- `mediator_id`：调解员筛选
- `start_date`：开始日期
- `end_date`：结束日期
- `keyword`：关键词搜索（案号/当事人姓名/手机号）
- `sort`：排序字段

**响应成功**：分页格式，items为案件列表

#### 5.3.2 获取案件详情

**接口**：`GET /api/v1/cases/{id}`

**权限**：有该案件访问权限的用户

**响应成功**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "case_number": "FL2026090001",
    "court": {...},
    "case_type": "民间借贷",
    "subject_amount": 50000,
    "status": "in_mediation",
    "mediator": {...},
    "parties": [...],
    "filing_date": "2026-09-01",
    ...
  }
}
```

#### 5.3.3 创建案件

**接口**：`POST /api/v1/cases`

**权限**：系统管理员

**请求参数**：案件基本信息

**响应成功**：返回创建的案件详情

#### 5.3.4 更新案件

**接口**：`PUT /api/v1/cases/{id}`

**权限**：
- 系统管理员：可更新所有字段
- 调解员：可更新案情分析、诉讼请求等字段

**请求参数**：需要更新的字段

#### 5.3.5 删除案件

**接口**：`DELETE /api/v1/cases/{id}`

**权限**：系统管理员

**说明**：软删除，设置deleted_at字段

#### 5.3.6 确认受理案件（已废除，2026-09-20 口径变更）

**接口**：`POST /api/v1/cases/{id}/accept`（**废除**）

**说明**：调解员取消「待受理/受理确认」环节——案件由系统管理员智能分案确认/人工指派（含转案池重新指派）后直接生效，状态置 `assigned`（已指派）并自动生成「待调解」待办；调解员侧不再调用本接口。

#### 5.3.7 申请转案

**接口**：`POST /api/v1/cases/{id}/return-request`

**权限**：该案件的承办调解员（含/不含主管标识）

**请求参数**：
```json
{
  "reason": "申请转案理由（必填）"
}
```

**说明**（2026-09-15 统一口径，取代原"申请退回"与"申请重新指派"两条并存路径）：
- 调解员/主管不能直接退回案件，本接口为**申请转案**，由系统管理员审核（同意/驳回）
- 同一案件可多次申请（每次留痕），但同一时刻仅允许一条 pending（否则返回 `CASE_RETURN_PENDING`）
- 审核同意后：案件进入**转案池**（管理端「转案管理」模块统一处理；status→pending_assignment，mediator_id 清空，excluded_from_auto_assignment=true，**不再纳入智能分案规则体系**），由系统管理员在该模块人工指派新调解员
- 审核驳回后：案件留在原调解员名下继续调解，驳回原因通知申请人

#### 5.3.8 申请转案审核（管理员）

**接口**：`POST /api/v1/return-requests/{request_id}/audit`

**权限**：系统管理员

**请求参数**：
```json
{
  "action": "approve",
  "remark": "审核备注（驳回时必填驳回原因）"
}
```

**说明**：action 取 approve / reject。同意后由后端联动更新案件状态并写入审计日志（见 05 §2.13.1），案件进入转案池，后续重新指派走「转案管理」模块对应的人工指派接口（见 5.4.3）；驳回原因回传申请人。

#### 5.3.9 结案操作

**接口**：`POST /api/v1/cases/{id}/close`

**权限**：该案件的调解员

**请求参数**：
```json
{
  "mediation_result": "success",
  "close_date": "2026-09-10",
  "remark": "结案备注"
}
```

---

### 5.4 智能分案模块

#### 5.4.1 获取待分案案件列表

**接口**：`GET /api/v1/assignment/pending-cases`

**权限**：系统管理员

**查询参数**：
- `court_id`：法院ID（必填）
- `page`、`page_size`

**说明**：自动排除 `excluded_from_auto_assignment=true` 的案件（经"申请转案"审核同意退回的案件不受智能分案规则影响，走人工指派）。

#### 5.4.1b 获取可勾选的参与调解人员列表

**接口**：`GET /api/v1/assignment/participants`

**权限**：系统管理员

**查询参数**：
- `court_id`：法院ID（必填）

**响应说明**：返回该法院派驻、账号启用状态的调解员（主管标识）与调解员列表，供管理员在分案前勾选确认；调解员数量可灵活勾选，无上限或固定值。

**响应成功**：
```json
{
  "success": true,
  "data": {
    "supervisors": [
      { "user_id": "supervisor_id_1", "name": "李主管", "courts": ["涪陵区人民法院"] }
    ],
    "mediators": [
      { "user_id": "mediator_id_1", "name": "张三", "level_tag": "A", "specialty": "民商事" }
    ]
  }
}
```

#### 5.4.2 执行智能分案

**接口**：`POST /api/v1/assignment/intelligent`

**权限**：系统管理员

**请求参数**：
```json
{
  "court_id": "court_id_1",
  "case_ids": ["case_id_1", "case_id_2"],
  "supervisor_ids": ["supervisor_id_1"],
  "mediator_ids": ["mediator_id_1", "mediator_id_2"],
  "weight_count": 0.5,
  "weight_amount": 0.3,
  "weight_type": 0.2
}
```

**参数说明**：
- `supervisor_ids`：管理员勾选确认的调解员（主管标识）ID列表（必填，至少1人）
- `mediator_ids`：管理员勾选确认的调解员ID列表（必填，至少1人，人数可灵活增减，无固定上限）
- 分案算法仅在 `mediator_ids` 范围内分配案件，未勾选人员不参与本次分案

**响应成功**：
```json
{
  "success": true,
  "data": {
    "batch_id": "uuid",
    "results": [
      {
        "case_id": "case_id_1",
        "case_number": "FL2026090001",
        "assigned_mediator_id": "mediator_id_1",
        "assigned_mediator_name": "张三",
        "match_score": 85.5
      }
    ],
    "mediator_summary": [
      {
        "mediator_id": "mediator_id_1",
        "mediator_name": "张三",
        "case_count": 5,
        "total_amount": 250000,
        "civil_count": 3,
        "commercial_count": 2
      }
    ]
  }
}
```

#### 5.4.3 人工指派调解员

**接口**：`POST /api/v1/assignment/manual`

**权限**：系统管理员

**请求参数**：
```json
{
  "case_id": "case_id_1",
  "mediator_id": "mediator_id_1",
  "reason": "指派理由（可选）"
}
```

#### 5.4.4 审核分案结果

**接口**：`POST /api/v1/assignment/{batch_id}/audit`

**权限**：系统管理员

**请求参数**：
```json
{
  "action": "approved",
  "remark": "审核备注"
}
```

**说明**：action为approved（通过）或rejected（拒绝）

#### 5.4.5 获取分案记录列表

**接口**：`GET /api/v1/assignment/records`

**权限**：系统管理员

#### 5.4.6 获取分案审计日志

**接口**：`GET /api/v1/assignment/{case_id}/audit-logs`

**权限**：系统管理员

---

### 5.5 外呼记录模块

#### 5.5.1 获取外呼记录列表

**接口**：`GET /api/v1/calls`

**权限**：
- 系统管理员：所有外呼记录
- 调解员（主管标识）：管辖法院外呼记录
- 调解员：仅个人外呼记录

#### 5.5.2 创建外呼记录

**接口**：`POST /api/v1/calls`

**权限**：调解员

**请求参数**：
```json
{
  "case_id": "case_id_1",
  "call_target": "defendant",
  "call_time": "2026-09-10T10:30:00Z",
  "call_duration": 330,
  "call_result": "connected_willing",
  "remark": "外呼备注",
  "recording_url": "https://storage.supabase.com/recordings/xxx.mp3"
}
```

**说明**：recording_url为必填，必须先上传录音文件获取URL

#### 5.5.3 上传录音文件

**接口**：`POST /api/v1/calls/upload-recording`

**权限**：调解员

**请求参数**：multipart/form-data，file字段为录音文件

**响应成功**：
```json
{
  "success": true,
  "data": {
    "file_url": "https://storage.supabase.com/recordings/xxx.mp3",
    "file_size": 5242880,
    "duration": 330
  }
}
```

#### 5.5.4 获取外呼统计

**接口**：`GET /api/v1/calls/statistics`

**权限**：有外呼记录访问权限的用户

---

### 5.6 文书管理模块

#### 5.6.1 获取文书列表

**接口**：`GET /api/v1/documents`

**权限**：
- 系统管理员：所有文书
- 调解员（主管标识）：管辖法院文书
- 调解员：仅个人文书

#### 5.6.2 生成文书

**接口**：`POST /api/v1/documents/generate`

**权限**：调解员

**请求参数**：
```json
{
  "case_id": "case_id_1",
  "document_type": "mediation_agreement",
  "template_id": "template_id_1",
  "content": "<p>文书内容（富文本HTML）</p>"
}
```

**响应成功**：
```json
{
  "success": true,
  "data": {
    "id": "document_id",
    "document_name": "调解协议书_FL2026090001.pdf",
    "file_url": "https://storage.supabase.com/documents/xxx.pdf",
    "signature_status": "unsigned"
  }
}
```

#### 5.6.3 签署文书

**接口**：`POST /api/v1/documents/{id}/sign`

**权限**：该文书的调解员

**请求参数**：
```json
{
  "signature_image_url": "https://storage.supabase.com/signatures/xxx.png"
}
```

#### 5.6.4 下载文书

**接口**：`GET /api/v1/documents/{id}/download`

**权限**：有该文书访问权限的用户

**响应**：文件流

#### 5.6.5 获取文书模板列表

**接口**：`GET /api/v1/document-templates`

**权限**：已认证用户

**查询参数**：
- `document_type`：文书类型筛选
- `template_type`：模板类型（system/custom）
- `court_id`：按法院筛选（模板带法院维度，每个法院可定制专属模板；生成文书时必传案件所属法院，返回本院专属模板+全局通用模板）

**响应补充字段**：`court_id`、`template_version`、`placeholder_def`（占位符定义）、`seal_rule`（签章/文号规则）

#### 5.6.6 创建自定义模板

**接口**：`POST /api/v1/document-templates`

**权限**：调解员

**请求参数**：
```json
{
  "template_name": "民间借贷调解协议书-自定义",
  "document_type": "mediation_agreement",
  "case_type": "民间借贷",
  "file_url": "https://storage.supabase.com/templates/xxx.docx",
  "description": "模板说明"
}
```

---

### 5.7 人员管理模块

#### 5.7.1 获取调解员列表

**接口**：`GET /api/v1/mediators`

**权限**：
- 系统管理员：所有调解员
- 调解员（主管标识）：管辖范围内调解员（查阅）

#### 5.7.2 获取调解员详情

**接口**：`GET /api/v1/mediators/{id}`

**权限**：有调解员访问权限的用户

#### 5.7.3 创建调解员

**接口**：`POST /api/v1/mediators`

**权限**：系统管理员

#### 5.7.4 更新调解员信息

**接口**：`PUT /api/v1/mediators/{id}`

**权限**：系统管理员

#### 5.7.5 配置调解员标签

**接口**：`PATCH /api/v1/mediators/{id}/tags`

**权限**：系统管理员

**请求参数**：
```json
{
  "level_tag": "A",
  "professional_tags": ["民间借贷", "合同纠纷"],
  "income_coefficient": 1.2
}
```

#### 5.7.6 获取调解员效能数据

**接口**：`GET /api/v1/mediators/{id}/performance`

**权限**：有调解员访问权限的用户

#### 5.7.7 获取调解员收益明细

**接口**：`GET /api/v1/mediators/{id}/income`

**权限**：
- 系统管理员：所有调解员收益
- 调解员（主管标识）：管辖范围内调解员收益（查阅）
- 调解员：仅个人收益

---

#### 5.7.8 机构绑定接口组（法院 + 调解组织，含审核）

> 操作层数据可见性以 `mediator_courts.bind_status='approved'` 为准，支持一人多法院/多组织绑定。

**A. 操作端（调解员（主管标识）/调解员本人）**

| 接口 | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/v1/my/bindable-options` | GET | 获取可绑定的法院及其下属调解组织（仅返回启用/合作中主数据，供下拉级联） | 登录用户 |
| `/api/v1/my/bindings` | GET | 获取我的绑定列表（含每条审核状态、驳回原因） | 登录用户 |
| `/api/v1/my/bindings` | POST | 提交绑定申请：court_id、organization_id、relation_type、is_primary、apply_reason、材料；防重校验，初始 bind_status=pending | 登录用户 |
| `/api/v1/my/bindings/{id}/withdraw` | POST | 撤回待审核申请 | 本人 |
| `/api/v1/my/bindings/{id}/resubmit` | POST | 被驳回后修改重新提交（pending） | 本人 |
| `/api/v1/my/bindings/{id}/primary` | PATCH | 设为主驻法院（后端自动取消原主驻） | 本人且该绑定 approved |
| `/api/v1/my/bindings/{id}/unbind` | POST | 申请解绑（历史只读，不再见新数据） | 本人 |

提交绑定请求示例：
```json
{
  "court_id": "uuid",
  "organization_id": "uuid",
  "relation_type": "participate",
  "is_primary": true,
  "apply_reason": "派驻该法院开展诉前调解",
  "apply_material_urls": ["https://.../proof.pdf"]
}
```

**B. 管理端（系统管理员审核/指派）**

| 接口 | 方法 | 说明 | 权限 |
|-----|------|------|------|
| `/api/v1/admin/binding-requests` | GET | 绑定审核队列，可按 bind_status/法院/角色筛选分页 | 系统管理员 |
| `/api/v1/admin/bindings/{id}/approve` | POST | 审核通过（approved），支持批量；通过后通知申请人并即时开通数据权限 | 系统管理员 |
| `/api/v1/admin/bindings/{id}/reject` | POST | 审核驳回，**reject_reason 必填**，通知申请人 | 系统管理员 |
| `/api/v1/admin/mediators/{id}/bindings` | POST | 管理员直接为人员新增绑定（apply_source=admin，直接 approved），用于入职配置 | 系统管理员 |
| `/api/v1/admin/bindings/{id}/disable` | POST | 停用/解绑（unbound），记录原因并留痕 | 系统管理员 |

**业务校验与错误码**：
- 同一"人员+法院+调解组织"已存在 pending/approved 绑定时，POST 返回 `4090 重复绑定`；
- 驳回未填原因返回 `4001 参数缺失：reject_reason`；
- 对非本人/非待审核记录执行撤回、重提返回 `4031 无权操作此绑定`；
- 绑定审核动作写入操作日志并触发通知（系统内/飞书/短信，按系统设置）。

---

### 5.8 基础数据模块

#### 5.8.1 法院管理

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| /api/v1/courts | GET | 已认证用户 | 获取法院列表 |
| /api/v1/courts/{id} | GET | 已认证用户 | 获取法院详情 |
| /api/v1/courts | POST | 系统管理员 | 创建法院 |
| /api/v1/courts/{id} | PUT | 系统管理员 | 更新法院 |
| /api/v1/courts/{id} | DELETE | 系统管理员 | 删除法院 |
| /api/v1/courts/{id}/assignment-config | GET | 系统管理员 | 获取法院分案配置 |
| /api/v1/courts/{id}/assignment-config | PUT | 系统管理员 | 更新法院分案配置 |

#### 5.8.2 调解组织管理

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| /api/v1/organizations | GET | 已认证用户 | 获取调解组织列表 |
| /api/v1/organizations | POST | 系统管理员 | 创建调解组织 |
| /api/v1/organizations/{id} | PUT | 系统管理员 | 更新调解组织 |

#### 5.8.3 入驻法院项目

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| /api/v1/court-projects | GET | 调解员（主管标识）/系统管理员 | 获取入驻项目列表 |
| /api/v1/court-projects | POST | 调解员（主管标识） | 创建入驻项目 |
| /api/v1/court-projects/{id} | GET | 项目创建人/系统管理员 | 获取项目详情 |
| /api/v1/court-projects/{id} | PUT | 项目创建人（仅待审核状态） | 编辑项目 |
| /api/v1/court-projects/{id}/audit | POST | 系统管理员 | 审核项目 |

---

### 5.9 调解费模块（应收 / 实收 / 退费 / 提成）

> 统一口径：应收按收费规则算（**2026-09-16 校准**：主口径改为「诉讼费（全国统一标的额分段标准）× 法院比例（40%–50% 逐法院预置）」）；实收、退费由主管/调解员录入（逐笔流水）；提成核算原值为**实收调解费总和**、按档位规则核算（档位细则待业务补充，过渡期沿用「实收−退费」）。所有查询按角色数据范围（管理员全平台、主管 approved 绑定法院、调解员本人）强制过滤。

#### 5.9.1 费用汇总

**接口**：`GET /api/v1/finance/summary`
**权限**：系统管理员（全平台）/ 调解员（主管标识）（管辖法院，查阅）
**查询参数**：month 或 start_date/end_date、court_id、organization_id、case_category
**返回**：receivable_total、received_total、refund_total、commission_total、discount_total（优惠折让=应收−实收）及环比、趋势序列。

#### 5.9.2 调解员费用数据表（可下钻）

**接口**：`GET /api/v1/finance/mediator-fee`
**权限**：系统管理员 / 调解员（主管标识）（管辖）
**返回（每行一个调解员，多法院分行）**：mediator、court、organization、case_count、subject_amount_total、receivable_total、received_total、refund_total、commission_total。
**下钻**：`GET /api/v1/finance/mediator-fee/{mediator_id}/cases?month=` 返回该员逐案明细（案号/案由/标的/应收/实收/退费/提成/费用状态）。

#### 5.9.3 案件费用明细与流水

- `GET /api/v1/finance/case-fee`：逐案费用列表（管理员/主管/调解员按范围）。
- `GET /api/v1/cases/{case_id}/fee-records`：某案件全部实收/退费流水（含录入人、凭证）。

#### 5.9.4 登记实收 / 登记退费（人员录入）

**接口**：`POST /api/v1/cases/{case_id}/fee-records`
**权限**：案件负责调解员、其调解员（主管标识）（管理员可补录）
**请求参数**：
```json
{
  "record_type": "received",
  "amount": 800,
  "pay_method": "transfer",
  "pay_time": "2026-09-10T10:00:00+08:00",
  "discount_rate": 0.8,
  "reason": "当事人一次性缴纳，给予8折优惠",
  "voucher_urls": ["https://.../receipt.jpg"]
}
```
- record_type=refund 时 reason（退费原因）必填；amount>0；退费累计不得超过实收累计，否则返回 `FEE_REFUND_EXCEED`。
- 写入流水后服务端事务重算案件 received/refund/commission 合计。

#### 5.9.5 冲销费用流水（管理员纠错）

**接口**：`POST /api/v1/fee-records/{id}/reverse`
**权限**：系统管理员（reason 必填，写操作日志）；软删除流水并重算案件合计。

#### 5.9.6 应收调解费试算 / 重算

- `POST /api/v1/finance/receivable/preview`：入参 court_id、case_category、subject_amount，返回应收金额、命中规则与计算过程（录入实收前试算）。
- `POST /api/v1/cases/{case_id}/receivable/recalc`：按最新规则重算单案应收（系统管理员）。

#### 5.9.7 收费规则管理（系统管理员）

- `GET/POST/PUT /api/v1/fee-rules`：收费规则列表/新增/编辑（按法院、分类、标的额区间、fixed/rate/ladder、保底封顶、启停）。
- `POST /api/v1/fee-rules/preview`：规则试算器。

#### 5.9.8 月度费用报表

- `GET /api/v1/finance/monthly-report?month=2026-08`：读取月度快照（mediator_monthly_fee）；无快照月份回退实时汇总并标注。
- `POST /api/v1/finance/monthly-report/generate`：生成/重跑指定月报表（系统管理员；定时任务每月1号自动调用上月）。
- `GET /api/v1/finance/monthly-report/export`：导出月度结算 Excel。

---

### 5.10 AI智能体模块（后续阶段·占位）

> 后续优化阶段模块，第一阶段不实施（见 00 §1.3）；接口保留设计作为后续实施依据。
>
> **【2026-09-17 补充：网页端AI智能体统一口径】**（见《00》第十六章）：①所有大模型调用经后端代理，**前端不存任何密钥**；②每次 AI 请求后端校验登录身份+案件访问权限（调解员仅个人案件，防止越权拿他人案件数据）；③后端按任务类型做数据裁剪与脱敏（可配置隐藏身份证号/手机号）；④后端限流（按人频率限制）+ 全量调用日志（操作人/案件ID/输入/输出，落 ai_messages 表）；⑤会话绑定 case_id（ai_conversations），不做全局聊天框。

#### 5.10.1 生成案件AI分析

**接口**：`POST /api/v1/ai/case-analysis`

**权限**：调解员（仅个人案件）

**请求参数**：
```json
{
  "case_id": "case_id_1"
}
```

**响应成功**：
```json
{
  "success": true,
  "data": {
    "analysis_id": "uuid",
    "case_summary": "案件摘要...",
    "dispute_focus": "争议焦点...",
    "party_demands": "当事人诉求...",
    "difficulty_assessment": "调解难度评估...",
    "success_probability": "成功概率预测...",
    "risk_points": ["风险点1", "风险点2"],
    "mediation_suggestions": ["建议1", "建议2"],
    "generated_at": "2026-09-10T10:30:00Z"
  }
}
```

#### 5.10.1a 案件侧边栏 AI 助手（2026-09-17 新增·网页端AI智能体）

**会话消息接口**：`POST /api/v1/ai/assistant/messages`（权限：调解员/系统管理员，后端强制校验 case_id 访问权；携带 conversation_id 或 case_id 新建会话；支持 task_type 快捷指令与自由提问；返回 AI 输出与 conversation_id；写入 ai_messages 调用日志）

**会话历史接口**：`GET /api/v1/ai/assistant/conversations?case_id=`（按案件拉取当前操作人的会话上下文，切换案件即切换会话）

**限流与日志**：后端按人限流，超频返回 429；每次调用落 ai_messages（操作人、案件 ID、输入、输出、脱敏标记、token 消耗）。

#### 5.10.2 类案检索

**接口**：`POST /api/v1/ai/similar-cases`

**权限**：调解员

**请求参数**：
```json
{
  "case_id": "case_id_1",
  "keywords": "民间借贷 利息",
  "limit": 10
}
```

#### 5.10.3 调解策略建议

**接口**：`POST /api/v1/ai/mediation-strategy`

**权限**：调解员

**请求参数**：
```json
{
  "case_id": "case_id_1"
}
```

#### 5.10.4 法规推荐

**接口**：`POST /api/v1/ai/legal-recommendations`

**权限**：调解员

**请求参数**：
```json
{
  "case_id": "case_id_1"
}
```

---

### 5.11 法规知识库模块（后续阶段·占位）

> 后续优化阶段模块，第一阶段不实施（见 00 §1.3）；接口保留设计作为后续实施依据。

#### 5.11.1 法规搜索

**接口**：`GET /api/v1/legal/search`

**权限**：已认证用户

**查询参数**：
- `keyword`：搜索关键词
- `type`：法规类型
- `page`、`page_size`

#### 5.11.2 获取法规详情

**接口**：`GET /api/v1/legal/{id}`

**权限**：已认证用户

#### 5.11.3 获取法规条文

**接口**：`GET /api/v1/legal/{id}/articles`

**权限**：已认证用户

#### 5.11.4 我的收藏

| 接口 | 方法 | 说明 |
|-----|------|------|
| /api/v1/legal/favorites | GET | 获取收藏列表 |
| /api/v1/legal/favorites | POST | 添加收藏 |
| /api/v1/legal/favorites/{id} | DELETE | 取消收藏 |

---

### 5.12 系统设置模块

#### 5.12.1 获取系统配置

**接口**：`GET /api/v1/system-configs`

**权限**：系统管理员

**查询参数**：
- `group`：配置分组筛选

#### 5.12.2 更新系统配置

**接口**：`PUT /api/v1/system-configs/{key}`

**权限**：系统管理员

**请求参数**：
```json
{
  "config_value": "新的配置值"
}
```

#### 5.12.3 批量更新系统配置

**接口**：`PUT /api/v1/system-configs/batch`

**权限**：系统管理员

**请求参数**：
```json
{
  "configs": [
    {"key": "config_key_1", "value": "value_1"},
    {"key": "config_key_2", "value": "value_2"}
  ]
}
```

---

### 5.13 通知模块

#### 5.13.1 获取通知列表

**接口**：`GET /api/v1/notifications`

**权限**：已认证用户（仅个人通知）

**查询参数**：
- `is_read`：是否已读筛选
- `type`：通知类型筛选
- `page`、`page_size`

#### 5.13.2 标记通知已读

**接口**：`POST /api/v1/notifications/{id}/read`

**权限**：通知接收人

#### 5.13.3 全部标记已读

**接口**：`POST /api/v1/notifications/read-all`

**权限**：已认证用户

#### 5.13.4 获取未读通知数量

**接口**：`GET /api/v1/notifications/unread-count`

**权限**：已认证用户

---

### 5.14 操作日志模块

#### 5.14.1 获取操作日志列表

**接口**：`GET /api/v1/audit-logs`

**权限**：系统管理员

**查询参数**：
- `start_date`、`end_date`
- `operator_id`：操作人筛选
- `module`：操作模块筛选
- `action_type`：操作类型筛选
- `page`、`page_size`

---

### 5.15 BI数据同步模块

#### 5.15.1 手动触发BI同步

**接口**：`POST /api/v1/bi/sync`

**权限**：系统管理员

**请求参数**：
```json
{
  "sync_date": "2026-09-10"
}
```

**说明**：sync_date可选，默认同步当天数据

#### 5.15.2 获取BI同步日志

**接口**：`GET /api/v1/bi/sync-logs`

**权限**：系统管理员

#### 5.15.3 获取BI统计数据

**接口**：`GET /api/v1/bi/stats`

**权限**：有数据访问权限的用户

**查询参数**：
- `stat_date`：统计日期
- `dimension_type`：维度类型（platform/court/mediator）
- `dimension_id`：维度ID

---

### 5.16 AI报表接口组（日/周/月报，后续阶段·占位待细化）

> 对应 03「十二之二」/04「十四之二」AI报表模块。数据范围按角色强制过滤（管理员全平台、主管 approved 绑定法院、调解员本人）。数据来源见 05 §2.23，不新增表。

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/v1/ai/reports/generate` | POST | 调解员（主管标识）（管辖）/系统管理员（全平台） | 生成指定类型（daily/weekly/monthly）+日期的报表（AI 草稿，支持重生成） |
| `/api/v1/ai/reports` | GET | 按角色数据范围 | 报表列表（类型/周期/范围/状态：草稿/已确认） |
| `/api/v1/ai/reports/{id}` | GET | 有权限用户 | 报表详情（数据区+分析区+AI生成文字草稿） |
| `/api/v1/ai/reports/{id}/confirm` | POST | 调解员（主管标识）/系统管理员 | 人工确认定稿（写入确认人/时间，定稿后可导出） |
| `/api/v1/ai/reports/{id}/export` | GET | 有权限用户 | 导出 Excel（对标现有运营日/周/月报格式） |

**错误码预留**：REPORT_NOT_FOUND（404）、REPORT_ALREADY_CONFIRMED（409）、REPORT_GENERATE_FAILED（500）。

---

### 5.17 案件状态流转与审批接口组（调解进度看板）

> 对应 04「五之二」调解进度看板（操作端专属，管理员不做）。普通流转直接写入 case_status_logs；结案/司法确认/终结等关键节点需审批（调解员（主管标识）或系统管理员），审批结果写入审计日志。

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/v1/kanban/columns` | GET | 调解员/调解员（主管标识） | 看板列数据（列=状态枚举，卡片=案号/承办人/剩余天数，含阶段停留时长） |
| `/api/v1/cases/{id}/transition` | POST | 承办调解员/主管 | 拖拽推进阶段：`{to_status, remark}`；普通流转直接生效；审批节点返回 `approval_required=true` 并生成待审批记录 |
| `/api/v1/cases/{id}/transition/approve` | POST | 调解员（主管标识）（专属）/系统管理员 | 审批：`{approved, remark}`；通过→cases.status 更新并留痕，驳回→退回原阶段并通知提交人 |
| `/api/v1/transitions/pending` | GET | 调解员（主管标识） | 待我审批列表（结案/司法确认/终结申请） |
| `/api/v1/cases/{id}/status-logs` | GET | 有案件访问权限用户 | 状态流转历史（含审批状态/操作人/时间/停留时长） |

**剩余天数说明**：所有接口返回的 `days_remaining`/`deadline_status`（red/orange/green）由后端规则引擎按 deadline_rules 计算，前端只渲染。

**错误码预留**：TRANSITION_NOT_ALLOWED（400）、APPROVAL_PENDING（409）、NO_APPROVAL_PERMISSION（403）。

### 5.18 调解排期接口组（排期日历）

> 对应 04「五之三」调解排期日历（操作端专属）。数据表 mediation_schedules（05 §2.20）。

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/v1/schedules` | GET | 调解员（本人）/调解员（主管标识）（管辖+本人） | 排期列表，支持 `mediator_id/venue/start/end/view=resource` 参数，日历资源视图数据源 |
| `/api/v1/schedules` | POST | 调解员/调解员（主管标识） | 新建排期：`{case_id, mediator_id, venue, start_time, end_time, participants, remark}`，提交前自动冲突检测 |
| `/api/v1/schedules/{id}` | PATCH | 创建人/主管 | 改期/编辑（时间段/场地变更重新检测冲突） |
| `/api/v1/schedules/{id}` | DELETE | 创建人/主管 | 取消排期（软删除，留痕） |
| `/api/v1/schedules/conflicts` | GET | 调解员/调解员（主管标识） | 冲突检测：传 `mediator_id/venue/start/end`（可含 `exclude_id`），返回冲突排期列表；同一调解员或同一场地时段重叠即冲突 |

**错误码预留**：SCHEDULE_CONFLICT（409，附冲突明细）、SCHEDULE_NOT_FOUND（404）、INVALID_TIME_RANGE（400）。

### 5.19 调解期限规则接口组（管理端）

> 对应 03「十一之二」调解期限规则配置（仅系统管理员）。数据表 deadline_rules（05 §2.21）；规则变更后由后端规则引擎重算受影响案件的剩余天数。

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/v1/deadline-rules` | GET | 系统管理员 | 规则列表（法院/类型/天数/可延长/延长上限/临期阈值/状态） |
| `/api/v1/deadline-rules` | POST | 系统管理员 | 新增规则；同法院×类型唯一性校验 |
| `/api/v1/deadline-rules/{id}` | PUT | 系统管理员 | 编辑规则（含生效校验） |
| `/api/v1/deadline-rules/{id}` | DELETE | 系统管理员 | 删除规则（软删除） |
| `/api/v1/cases/{id}/deadline` | GET | 有案件访问权限用户 | 单案剩余天数与命中规则（后端计算，前端只读） |

**错误码预留**：RULE_DUPLICATE（409）、RULE_NOT_FOUND（404）、RULE_INVALID（400）。

### 5.20 数据同步接口组（Browser 智能体案件抓取·管理端）【2026-09-19 新增】

> 对应 03 §6.16 数据同步（仅系统管理员手动触发）。Browser 智能体为部署在云服务器上的独立抓取服务（Playwright + 人工登录接管），抓取结果以飞书应用身份写入多维表（项目唯一数据源）。数据表 sync_tasks / sync_task_logs（05 建议新增，字段见《05》补充）；本接口组为网页后端与智能体服务之间的边界接口。

**任务状态机**：`QUEUED（排队中）→ WAITING_LOGIN（等待登录·人工接管）→ RUNNING（抓取中）→ WRITING（写入多维表）→ DONE / FAILED / CANCELLED`；FAILED 可重试（从断点续跑，已写入数据以案号幂等去重）。

| 接口 | 方法 | 权限 | 说明 |
|-----|------|------|------|
| `/api/v1/sync/tasks` | POST | 系统管理员 | 创建同步任务（来源、时间范围/案号区间；单轮上限500条，超限返回 400 SYNC_RANGE_TOO_LARGE）；任务入队后返回 taskId |
| `/api/v1/sync/tasks` | GET | 系统管理员 | 历史任务列表（分页、按状态/发起人/时间筛选） |
| `/api/v1/sync/tasks/{taskId}` | GET | 系统管理员 | 任务详情与实时进度（状态、已抓取/预计条数、当前页、重试次数） |
| `/api/v1/sync/tasks/{taskId}/login-snapshot` | GET | 系统管理员 | 等待登录态时轮询获取登录页截图/二维码（10分钟未接管自动 CANCELLED） |
| `/api/v1/sync/tasks/{taskId}/login-verify` | POST | 系统管理员 | 人工接管：回传管理员输入的验证码/确认扫码完成，仅当前会话有效、凭据零落库 |
| `/api/v1/sync/tasks/{taskId}/resume` | POST | 系统管理员 | 任务暂停后继续（如二次验证码、风控拦截人工处理后） |
| `/api/v1/sync/tasks/{taskId}/cancel` | POST | 系统管理员 | 终止任务（销毁浏览器实例与登录会话，已写入数据保留） |
| `/api/v1/sync/tasks/{taskId}/retry` | POST | 系统管理员 | 失败任务从断点重试（案号幂等：已存在仅更新变更字段并留痕） |
| `/api/v1/sync/tasks/{taskId}/logs` | GET | 系统管理员 | 任务操作留痕（打开页面/登录/翻页/解析/写入逐步骤），供审计 |
| `/api/v1/sync/tasks/{taskId}/report` | GET | 系统管理员 | 下载任务报告（新增/更新/失败清单与原因） |
| `/api/v1/sync/service/status` | GET | 系统管理员 | 智能体服务运行状态（供驾驶舱监控卡片） |

**智能体服务回调（内网·服务间鉴权）**：智能体服务通过内部回调地址向网页后端推送状态变更（STATE_CHANGED），网页后端再经 WebSocket/SSE 推送到管理端任务面板；回调不暴露公网。

**错误码预留**：SYNC_TASK_NOT_FOUND（404）、SYNC_RANGE_TOO_LARGE（400）、SYNC_LOGIN_TIMEOUT（408）、SYNC_CAPTCHA_REQUIRED（428，需人工接管）、SYNC_ANTI_CRAWL（429，风控拦截）、SYNC_BIZ_TABLE_WRITE_FAILED（502，多维表限流重试中）。

**安全约束**：登录会话仅存活于单次任务的无头浏览器实例内存，任务结束/取消即销毁；任何接口不得返回人民调解平台的 Cookie/凭据；任务全量操作写入操作日志（审计联动《06》§5.14）。

---

## 五之二、AI 判断盒子接口（2026-09-20 新增·占位）

> 来源：《调解工作流-AI预判盒子技术方案》。将《调解员工作流-完整版》中 10 个关键判断点封装为轻量、无状态、可解释、带置信度、人最终拍板的「判断盒子」；独立 AI 中台（Python/FastAPI 或 Supabase Edge Function）部署，业务层只调 `/ai-boxes/*` 防腐层，不感知模型/厂商。

### 5.2.1 设计前提与红线

- **规则优先，LLM 兜底**：确定性事项（排除情形/期限/司法确认推荐）走规则引擎，非结构化语义（诉求/证据/笔录）走 LLM + 法规 RAG。
- **AI 不写状态**：盒子只产出 `ai_box_runs` 记录 + 建议，**不修改案件状态**；状态变更由调解员在页面确认触发。
- **人审确认**：每个盒子输出"建议 + 依据"，调解员在 UI 上确认/推翻，确认动作进审计日志。
- **脱敏**：高敏字段（身份证/人脸/银行卡 L4）脱敏后才进模型，人脸不进；AK/SK 仅服务端。
- **可观测**：每次调用存 `ai_box_runs`（见《05》2.25），留存 ≥5 年。

### 5.2.2 盒子清单

| 工作流阶段 | 判断点 | boxKey | 类型 | 输出 |
|---|---|---|---|---|
| 0 受理审查 | 能不能调/排除情形 | `admissibility` | 规则+LLM | 可受理/排除(原因) + 置信度 |
| 1 初步研判 | 风险初筛 | `risk_screen` | 规则+LLM | 虚假调解/恶意串通/信访/涉众风险标签 + 等级 |
| 3 争议识别 | 有无争议/维度 | `dispute_detect` | LLM | 有/无争议 + 争议维度(事实/金额/责任) |
| 4A 无争议 | 真实性核验 | `authenticity` | 混合 | 真实性风险(高/中/低) + 提示要点 |
| 4B 有争议 | 争点归纳 | `issue_extract` | LLM | 结构化争议焦点列表(事实/法律/证据) |
| 4A/4B | 履行能力 | `enforceability` | 规则+外部 | 履行能力预估(强/中/弱) + 风险 |
| 4B | 策略推荐 | `strategy_advice` | LLM | 背对背/面对面 + 方案方向 |
| 5 协议签署 | 协议审查 | `agreement_review` | 混合 | 合法/可执行/公平三维度判定 + 修改点 |
| 6 效力固化 | 司法确认推荐 | `confirm_advice` | 规则 | 建议司法确认/赋强/撤诉 + 倒计时提醒 |
| 7 结案 | 结案方式建议 | `closure_advice` | 混合 | 成功/不成/撤回/转立案建议 |

**MVP 顺序**：第一批（规则为主）`admissibility`/期限临期/`confirm_advice`；第二批（LLM 类，需脱敏网关+法规 RAG）`dispute_detect`/`issue_extract`/`agreement_review`；第三批（外部数据/样本）`enforceability`/`strategy_advice`。

### 5.2.3 接口定义

**盒子预判**

```
POST /api/v1/ai-boxes/{boxKey}/predict
```

**请求**
```json
{
  "caseId": "CASE_20260920_001",
  "boxKey": "admissibility",
  "features": { "causeType": "民间借贷", "subjectType": "NATURAL", "amount": 50000, "source": "COURT_REFER" },
  "texts": { "applicantClaim": "…", "respondentReply": "…" },
  "context": { "relatedCases": 0, "partyHistory": [] }
}
```

**响应**
```json
{
  "runId": "BOX_20260920_0001",
  "boxKey": "admissibility",
  "prediction": "ADMISSIBLE",
  "confidence": 0.92,
  "evidence": [
    { "type": "RULE", "hit": "causeType ∈ 可调解范围", "detail": "民间借贷属常见可调案由" },
    { "type": "RULE", "hit": "无排除情形", "detail": "非人身关系/非涉刑" }
  ],
  "suggestion": "建议受理，进入初步研判",
  "needHumanConfirm": true,
  "degraded": false,
  "modelVersion": "rule-v1+llm-202609",
  "createdAt": "2026-09-20T10:20:00+08:00"
}
```

**人工确认/推翻**

```
POST /api/v1/ai-boxes/runs/{runId}/decision
Body: { "decision": "CONFIRMED | REJECTED" }
```

更新 `ai_box_runs.human_decision/human_decided_by/decided_at`，同步写操作日志。

**运行记录查询**

```
GET /api/v1/ai-boxes/runs?caseId=&boxKey=&human_decision=&page=&pageSize=
```

分页查询指定案件/盒子的运行记录（供「案件AI分析」标签页与回测）。

### 5.2.4 通用约束

- **幂等**：写操作带 `X-Idempotency-Key`，同 `(caseId, boxKey, inputHash)` 复用已有结果，不重复计费。
- **超时与降级**：LLM 超时 → 回退纯规则结果并标 `degraded=true`；规则引擎常驻，LLM 为可选增强。
- **鉴权**：复用现有 RBAC（role + is_supervisor + approvedCourtIds），仅案件可见人可调对应盒子。
- **限流**：复用《00》十六章 AI 调用频率限制，防高频消耗 AI 额度。
- **不自动执行**：不自动触发结案/终止/司法确认/退回，只给建议。

### 5.2.5 与现有能力的对齐

| 现有能力 | box 接入方式 |
|---|---|
| 案件详情「案件AI分析」标签页 | 主渲染处：分盒子展示结论/置信度/依据/建议，附「采纳/推翻」按钮 |
| 调解进度看板 / 临期高亮 | `risk_screen`/期限盒子输出高亮，超风险案件置顶 |
| 待办事项 | box 产出"建议动作"自动生成待办（如"建议司法确认，剩 21 天"） |
| 结案审批（主管） | `agreement_review`/`closure_advice` 作为审批参考依据 |
| RBAC + 审计日志 | box 接口复用鉴权；每次调用写 `ai_box_runs` + 操作日志 |

**验收指标**：预判准确率/召回、调解员采纳率、误报率、对结案时长与成功率的提升。

---

## 五之三、技术分层架构与接口归属（2026-09-20 新增）

> 来源：《调解平台-技术分层架构》。竖线逻辑分层与物理部署可解耦：全部接口物理上都挂在统一 `/api/v1` 网关后，下表是**逻辑归属**，用于划分服务边界与团队职责。

### 5.3.1 五层总览

```
L1 前端层（AdminLayout 管理端 · MediatorLayout 操作端 · H5 签署页）
  │ HTTPS /api/v1（统一网关）
L2 业务服务层（统一 API 网关 BFF · 智能分案域 · 调解执行域 · 费用域）
  │ 内部调用 /ai-boxes/*                │ 内部调用 /sign-flows/*
L3 AI 中台（预判盒子编排·规则引擎·LLM网关·法规RAG·样本库）
L4 签署中台（签署防腐层·状态机·存证·司法确认；EssGateway → 腾讯电子签 essbasic）
  │ 下沉调用
L5 共享底座（实名/人脸核身 · 期限规则引擎 · 消息送达 · 卷宗审计 · RBAC · 文件存储）
```

### 5.3.2 层间调用与防腐关系

| 调用方 | 被调方 | 通道 | 防腐要点 |
|--------|--------|------|----------|
| 前端 L1 | 业务 L2 | HTTPS `/api/v1` | 网关鉴权、幂等键、审计埋点；前端无密钥 |
| 业务 L2 | AI 中台 L3 | 内部 `/api/v1/ai-boxes/*` | AI 中台防腐：业务不感知模型/厂商；结果须人工采纳 |
| 业务 L2 | 签署中台 L4 | 内部 `/api/v1/sign-flows/*` 等 | 签署中台防腐：业务不感知腾讯字段；合规红线在服务端 |
| AI L3 | 底座 L5 | SDK/内部 | 脱敏网关、法规库、审计写回 |
| 签署 L4 | 底座 L5 | SDK/内部 | 核身、消息、审计、文件存储 |
| 签署 L4 | 腾讯电子签 | EssGateway | 字段翻译 + 限流/重试/回调验签/额度监控 |
| 业务 L2 | 底座 L5 | SDK/内部 | 鉴权、期限、消息、审计、RBAC |

**防腐层是架构红线**：L2 业务代码里不得出现 `FlowId`/`Approver`/`Agent` 等腾讯概念，也不得出现模型厂商 endpoint；换签厂商/换模型只改对应中台，业务层零改动。

### 5.3.3 现有接口 → 层映射

| 接口组（本文档） | 归属层 | 说明 |
|---|---|---|
| A 认证 `/auth/token` | L5（网关鉴权） | OAuth2 Client Credentials + AK/SK 签名，全平台复用 |
| B 签署主体 `/subjects` | L4 签署中台 | 同步厂商账号，业务层经此创建主体 |
| C 实名认证 `/verifications` | L4 暴露 / L5 能力 | 核身是底座能力，签署中台封装暴露 |
| D 印章 `/seals` | L4 签署中台 | 组织印章管理 |
| E 文书模板 `/templates` | L4 签署中台 | 带 court_id 维度 |
| F 文书 `/documents` | L4 签署中台 | 模板生成/上传/预览/下载 |
| G/H 签署流程·任务 | L4 签署中台 | 核心签署编排，三阶段法定顺序 |
| I 验签·存证 `/evidences` | L4 签署中台 | 区块链/公证出证 |
| J 送达 `/service-records` | L4 签署中台（复用 L5 消息） | 送达回证 |
| K 司法确认 `/judicial-confirmations` | L4 签署中台 | 30 日倒计时字段 |
| L 回调·事件 `/webhooks` `/events` | L4 签署中台 | 回调验签、死信重推 |
| M 管理·审计 `/audit-logs` `/providers/*` | L5 审计 + 平台 | 审计日志、厂商切换/健康 |
| `/ai-boxes/*` | L3 AI 中台 | 预判盒子（见五之二） |
| 案件/分案/费用/当事人/记录/看板/排期/BI | L2 业务服务层 | 三业务模块领域接口 |

### 5.3.4 横切安全与数据流

- **鉴权下沉**：所有写操作经 L5 网关鉴权；RBAC 角色贯穿 L2/L3/L4；签名密钥（腾讯 AK/SK、模型 API Key）仅服务端。
- **脱敏网关**：L4 身份证/银行卡、L3 进模型的文本，经 L5 脱敏后才落库/进模型；人脸不进。
- **审计闭环**：L2 状态流转、L3 盒子采纳/推翻、L4 签署动作，统一写 L5 AuditLog ≥5 年。
- **数据分级**：L4 高敏/L3 中敏字段加密存储、出参脱敏，需 `PII_UNMASK` 才见明文。
- **幂等**：写操作 `X-Idempotency-Key`，创建流程/提交签署/存证/送达/分案必带。

**演进顺序**：① 先立 L5 + L2 业务骨架 + L1 三端（无 AI、无电子签的线下闭环，文书可上传扫描件）；② 再接 L4 签署中台（腾讯企业自动签白名单为最长等待项）；③ 后上 L3 AI 中台 MVP（3 个规则盒子）。详见《00》第十八章。

---

## 六、Serverless Functions

### 6.1 函数清单

项目使用Vercel Serverless Functions实现部分复杂业务逻辑：

| 函数路径 | 功能 | 触发方式 |
|---------|------|---------|
| /api/sync-bi.js | 每日BI数据同步 | Vercel Cron（每日03:00）+ 手动触发 |
| /api/legal-search.js | 法规查询（对接北大法宝） | HTTP请求 |
| /api/ai-analysis.js | AI案件分析（对接Deepseek） | HTTP请求 |
| /api/send-sms.js | 发送短信验证码 | HTTP请求 |
| /api/send-feishu.js | 发送飞书消息通知 | HTTP请求 |
| /api/generate-document.js | 文书生成 | HTTP请求 |

### 6.2 函数调用规范

Serverless Functions的调用规范与普通API接口一致，统一响应格式和错误码。

---

## 七、接口调用示例

### 7.1 登录并获取案件列表示例

```javascript
// 1. 登录获取Token
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: '123456',
    role: 'admin'
  })
});
const { token } = (await loginResponse.json()).data;

// 2. 使用Token获取案件列表
const casesResponse = await fetch('/api/v1/cases?page=1&page_size=20&status=in_mediation', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const casesData = await casesResponse.json();
```

### 7.2 智能分案示例

```javascript
// 执行智能分案
const response = await fetch('/api/v1/assignment/intelligent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    court_id: 'court_id_1',
    case_ids: ['case_id_1', 'case_id_2', 'case_id_3'],
    weight_count: 0.5,
    weight_amount: 0.3,
    weight_type: 0.2
  })
});
const result = await response.json();
```

---

## 八、性能与安全

### 8.1 性能优化

1. **分页查询**：所有列表接口支持分页，避免一次性返回大量数据
2. **索引优化**：数据库表建立合适的索引，提升查询性能
3. **缓存策略**：常用配置数据和统计数据使用缓存，减少数据库查询
4. **异步处理**：文书生成、AI分析等耗时操作采用异步处理
5. **CDN加速**：静态资源和文件存储使用CDN加速

### 8.2 安全措施

1. **身份认证**：所有接口（除公开接口外）需要JWT Token认证
2. **权限控制**：基于角色的访问控制（RBAC），严格控制数据范围
3. **输入校验**：所有请求参数进行严格校验，防止SQL注入和XSS攻击
4. **敏感数据加密**：身份证号等敏感信息加密存储
5. **操作审计**：所有写操作记录审计日志，支持追溯
6. **频率限制**：登录、验证码发送等接口设置频率限制
7. **HTTPS传输**：所有接口使用HTTPS加密传输

---

**文档结束**

*本文档为问问调解平台API接口设计，后续开发请严格按照本文档执行。*

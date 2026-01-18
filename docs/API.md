# DMED App - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Letters](#letters-endpoints)
  - [Comments](#comments-endpoints)
  - [Files](#files-endpoints)
  - [Notifications](#notifications-endpoints)
  - [Users](#users-endpoints)
  - [Health](#health-endpoints)

---

## Overview

The DMED App API provides both REST and tRPC endpoints for managing letters, files, notifications, and user data.

**Base URL**: `https://your-domain.com/api`

**API Versions**:
- REST API: `/api/*`
- tRPC API: `/api/trpc/*`

**Content Type**: `application/json`

---

## Authentication

### Authentication Method

The API uses **NextAuth.js** with Google OAuth 2.0 for authentication.

**Session-based Authentication**:
- Credentials are passed via session cookies
- Sessions are valid for 30 days by default
- CSRF tokens are required for state-changing operations

### Getting a Session

1. **Sign in with Google**:
   ```
   GET /api/auth/signin/google
   ```

2. **Get current session**:
   ```
   GET /api/auth/session
   ```

   **Response**:
   ```json
   {
     "user": {
       "id": "clx1234567890",
       "name": "John Doe",
       "email": "john@example.com",
       "image": "https://lh3.googleusercontent.com/...",
       "role": "USER"
     },
     "expires": "2026-02-18T10:00:00.000Z"
   }
   ```

3. **Sign out**:
   ```
   POST /api/auth/signout
   ```

### Protected Endpoints

Protected endpoints require:
1. Valid session cookie
2. CSRF token in request header: `x-csrf-token`

**Example**:
```javascript
fetch('/api/letters', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify({...})
})
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | User not authenticated |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `CSRF_TOKEN_INVALID` | Invalid CSRF token |
| `DUPLICATE_ENTRY` | Resource already exists |
| `INTERNAL_ERROR` | Server error |

---

## Rate Limiting

API endpoints are rate-limited per user to prevent abuse.

### Rate Limit Tiers

| Tier | Requests | Window | Applies To |
|------|----------|--------|------------|
| **Generous** | 1000 | 15 min | Public read endpoints |
| **Default** | 100 | 15 min | Standard CRUD operations |
| **Strict** | 10 | 15 min | Sensitive operations (login, password reset) |

### Rate Limit Headers

Response includes rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

### Rate Limit Exceeded

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded. Try again in 15 minutes.",
  "code": "RATE_LIMIT_EXCEEDED",
  "statusCode": 429,
  "retryAfter": 900
}
```

---

## Pagination

List endpoints support pagination using **offset-based pagination**.

### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number (1-indexed) |
| `limit` | number | 20 | 100 | Items per page |

### Pagination Response

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}
```

### Example

```
GET /api/letters?page=2&limit=50
```

---

## API Endpoints

### Authentication Endpoints

#### Get Current Session

```
GET /api/auth/session
```

**Response**:
```json
{
  "user": {
    "id": "clx123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  },
  "expires": "2026-02-18T10:00:00.000Z"
}
```

#### Sign In

```
GET /api/auth/signin/google
```

Redirects to Google OAuth consent screen.

#### Sign Out

```
POST /api/auth/signout
```

**Response**: Redirects to home page

---

### Letters Endpoints

#### List Letters

```
GET /api/letters
```

**Query Parameters**:
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page (max 100)
- `status` (string, optional): Filter by status
- `ownerId` (string, optional): Filter by owner
- `search` (string, optional): Search in number/org
- `commentsPage` (number, optional): Comments page number
- `commentsLimit` (number, optional): Comments per page

**Response**:
```json
{
  "letters": [
    {
      "id": "clx123",
      "number": "001-2026",
      "org": "Example Organization",
      "content": "Letter content",
      "status": "NEW",
      "priority": 1,
      "owner": {
        "id": "user1",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2026-01-18T10:00:00.000Z",
      "updatedAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

#### Create Letter

```
POST /api/letters
```

**Request Body**:
```json
{
  "number": "001-2026",
  "org": "Example Organization",
  "content": "Letter content",
  "status": "NEW",
  "priority": 1
}
```

**Response**:
```json
{
  "success": true,
  "letter": {
    "id": "clx123",
    "number": "001-2026",
    ...
  }
}
```

#### Get Letter by ID

```
GET /api/letters/:id
```

**Query Parameters**:
- `commentsPage` (number, optional): Comments page
- `commentsLimit` (number, optional): Comments limit

**Response**:
```json
{
  "id": "clx123",
  "number": "001-2026",
  "org": "Example Organization",
  "content": "Letter content",
  "status": "NEW",
  "priority": 1,
  "owner": {
    "id": "user1",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "files": [
    {
      "id": "file1",
      "name": "document.pdf",
      "url": "/api/files/file1",
      "size": 1024000,
      "mimeType": "application/pdf"
    }
  ],
  "comments": [
    {
      "id": "comment1",
      "text": "Comment text",
      "author": {
        "id": "user2",
        "name": "Jane Doe"
      },
      "_count": {
        "replies": 3
      },
      "createdAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "commentsPagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "hasMore": false
  },
  "watchers": [...],
  "history": [...],
  "isWatching": true,
  "isFavorite": false
}
```

#### Update Letter Field

```
PATCH /api/letters/:id
```

**Request Body**:
```json
{
  "field": "status",
  "value": "IN_PROGRESS"
}
```

**Allowed Fields**:
- `number`, `org`, `status`, `owner`, `comment`, `priority`, `answer`, `zordoc`, `jiraLink`, `sendStatus`, `content`, `deadlineDate`, `contacts`, `type`, `applicantName`, `applicantEmail`, `applicantPhone`, `applicantTelegramChatId`

**Response**:
```json
{
  "success": true,
  "letter": { ... }
}
```

#### Delete Letter

```
DELETE /api/letters/:id
```

**Permissions**: Admin only

**Response**:
```json
{
  "success": true
}
```

---

### Comments Endpoints

#### Get Letter Comments (Paginated)

```
GET /api/letters/:letterId/comments
```

**Query Parameters**:
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page (max 50)
- `includeReplies` (boolean, optional): Include replies (default: true)

**Response**:
```json
{
  "comments": [
    {
      "id": "comment1",
      "text": "Comment text",
      "author": {
        "id": "user1",
        "name": "John Doe",
        "email": "john@example.com",
        "image": "https://..."
      },
      "replies": [
        {
          "id": "reply1",
          "text": "Reply text",
          "author": {...}
        }
      ],
      "createdAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

#### Add Comment

```
POST /api/letters/:letterId/comments
```

**Request Body**:
```json
{
  "text": "Comment text",
  "parentId": null  // or comment ID for reply
}
```

**Response**:
```json
{
  "success": true,
  "comment": {
    "id": "comment1",
    "text": "Comment text",
    "author": {...},
    "createdAt": "2026-01-18T10:00:00.000Z"
  }
}
```

#### Get Comment Replies

```
GET /api/comments/:commentId/replies
```

**Query Parameters**:
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page (max 50)

**Response**:
```json
{
  "replies": [
    {
      "id": "reply1",
      "text": "Reply text",
      "author": {...},
      "createdAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "hasMore": false
  }
}
```

---

### Files Endpoints

#### Upload File

```
POST /api/upload
```

**Request**: `multipart/form-data`
- `file`: File to upload (max 10MB)
- `letterId`: Letter ID to attach file to

**Allowed File Types**:
- PDF: `application/pdf`
- Word: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Images: `image/jpeg`, `image/png`, `image/gif`

**Response**:
```json
{
  "success": true,
  "file": {
    "id": "file1",
    "name": "document.pdf",
    "url": "/api/files/file1",
    "size": 1024000,
    "mimeType": "application/pdf",
    "status": "PENDING_SYNC"
  }
}
```

#### Download File

```
GET /api/files/:fileId
```

**Response**: File stream with appropriate headers

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
Content-Length: 1024000
```

---

### Notifications Endpoints

#### Get User Notifications

```
GET /api/notifications
```

**Query Parameters**:
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `read` (boolean, optional): Filter by read status
- `priority` (string, optional): Filter by priority

**Response**:
```json
{
  "notifications": [
    {
      "id": "notif1",
      "title": "Новый комментарий",
      "body": "Comment text",
      "event": "COMMENT",
      "channel": "IN_APP",
      "priority": "NORMAL",
      "read": false,
      "letterId": "letter1",
      "actorId": "user2",
      "actor": {
        "id": "user2",
        "name": "Jane Doe"
      },
      "createdAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

#### Mark Notification as Read

```
PATCH /api/notifications/:id
```

**Request Body**:
```json
{
  "read": true
}
```

**Response**:
```json
{
  "success": true
}
```

#### Delete Notification

```
DELETE /api/notifications/:id
```

**Response**:
```json
{
  "success": true
}
```

#### Get Unread Count

```
GET /api/notifications/unread-count
```

**Response**:
```json
{
  "count": 5
}
```

---

### Users Endpoints

#### Get Current User Profile

```
GET /api/profile
```

**Response**:
```json
{
  "id": "user1",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://...",
  "role": "USER",
  "telegramChatId": "123456",
  "phone": "+1234567890",
  "notifyEmail": true,
  "notifyTelegram": false,
  "digestFrequency": "INSTANT",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

#### Update Profile

```
PATCH /api/profile
```

**Request Body**:
```json
{
  "name": "John Doe Updated",
  "telegramChatId": "654321",
  "phone": "+9876543210"
}
```

**Response**:
```json
{
  "success": true,
  "user": {...}
}
```

#### Update Notification Settings

```
PATCH /api/notification-settings
```

**Request Body**:
```json
{
  "notifyEmail": true,
  "notifyTelegram": true,
  "notifyInApp": true,
  "digestFrequency": "DAILY",
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

**Response**:
```json
{
  "success": true,
  "settings": {...}
}
```

#### List Users (Admin Only)

```
GET /api/users
```

**Query Parameters**:
- `page`, `limit`: Pagination
- `role` (string, optional): Filter by role
- `search` (string, optional): Search by name/email

**Response**:
```json
{
  "users": [
    {
      "id": "user1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER",
      "_count": {
        "ownedLetters": 10,
        "watchedLetters": 5,
        "comments": 20
      }
    }
  ],
  "pagination": {...}
}
```

---

### Health Endpoints

#### Health Check

```
GET /api/health
```

**Query Parameters**:
- `verbose` (boolean, optional): Include detailed checks

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T10:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 15
    },
    "memory": {
      "status": "ok",
      "used": 512,
      "total": 1024,
      "percent": 50
    },
    "externalServices": {
      "redis": {
        "status": "ok",
        "latency": 5
      },
      "sentry": {
        "status": "ok",
        "details": {
          "configured": true
        }
      }
    }
  },
  "responseTime": 25
}
```

#### Quick Health Check

```
HEAD /api/health
```

**Response**: HTTP 200 if healthy, HTTP 503 if unhealthy

---

## tRPC API

The application also provides type-safe tRPC endpoints at `/api/trpc/*`.

### Client Usage

```typescript
import { trpc } from '@/lib/trpc'

// Get letters
const { data } = trpc.letter.list.useQuery({
  page: 1,
  limit: 20,
})

// Create letter
const createMutation = trpc.letter.create.useMutation()
await createMutation.mutateAsync({
  number: '001-2026',
  org: 'Example Org',
})
```

### Available Routers

- `letter` - Letter operations
- `notification` - Notification operations
- `user` - User operations

See TypeScript definitions for complete API surface.

---

## Webhooks

### Google Sheets Sync

The application syncs data with Google Sheets bidirectionally.

**Sync Trigger**:
```
POST /api/sync/sheets
```

**Request Body**:
```json
{
  "force": false
}
```

**Response**:
```json
{
  "success": true,
  "synced": 45,
  "errors": 0
}
```

---

## SDK / Client Libraries

### JavaScript/TypeScript

Using tRPC client (recommended):

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/routers/_app'

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://your-domain.com/api/trpc',
    }),
  ],
})

const letters = await client.letter.list.query({ page: 1 })
```

Using fetch:

```typescript
const response = await fetch('https://your-domain.com/api/letters', {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
})
const data = await response.json()
```

---

## Examples

### Complete Flow: Create Letter with File

```typescript
// 1. Get CSRF token
const session = await fetch('/api/auth/session').then(r => r.json())
const csrfToken = session.csrfToken

// 2. Create letter
const letterResponse = await fetch('/api/letters', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify({
    number: '001-2026',
    org: 'Example Organization',
    content: 'Letter content',
    status: 'NEW',
  }),
})

const { letter } = await letterResponse.json()

// 3. Upload file
const formData = new FormData()
formData.append('file', fileBlob)
formData.append('letterId', letter.id)

const fileResponse = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
  },
  credentials: 'include',
  body: formData,
})

const { file } = await fileResponse.json()

// 4. Add comment
await fetch(`/api/letters/${letter.id}/comments`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify({
    text: 'Letter created with attachment',
  }),
})
```

---

## Changelog

### v1.0.0 (2026-01-18)

- Initial API release
- REST endpoints for letters, comments, files, notifications
- tRPC integration
- Pagination support
- Rate limiting
- CSRF protection

---

**Last Updated**: January 18, 2026
**API Version**: 1.0.0
**Contact**: support@yourdomain.com

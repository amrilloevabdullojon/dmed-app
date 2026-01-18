# DMED Letters - Document Management & Execution Tracking System

> Modern web application for managing official correspondence, documents, and letter execution tracking with Google Sheets/Drive integration.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Development](#-development)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Functionality
- 📨 **Letter Management**: Create, edit, track, and manage official correspondence
- 🔄 **Status Tracking**: Monitor letter execution status with real-time updates
- 💬 **Comments & Collaboration**: Thread-based commenting system with replies
- 📎 **File Attachments**: Upload and sync files to Google Drive
- 👥 **User Roles**: Multi-level access control (User, Moderator, Admin, SuperAdmin)
- 🔔 **Smart Notifications**: Multi-channel notifications (Email, Telegram, SMS, In-app)
- ⭐ **Favorites**: Bookmark important letters for quick access
- 🔗 **Letter Linking**: Create relationships between related documents
- 📊 **Statistics Dashboard**: Real-time analytics and reporting

### Integration & Automation
- 🔗 **Google Sheets Sync**: Bidirectional sync with Google Sheets
- ☁️ **Google Drive Storage**: Automatic file backup to Google Drive
- 🤖 **Telegram Bot**: Real-time notifications via Telegram
- 🧠 **AI-Powered Parsing**: Gemini AI for intelligent document parsing
- 📧 **Email Notifications**: Automated email alerts
- 📱 **SMS Integration**: SMS notifications for critical updates

### Security & Monitoring
- 🔒 **NextAuth.js**: Secure OAuth 2.0 authentication with Google
- 🛡️ **CSRF Protection**: Built-in CSRF token validation
- ⚡ **Rate Limiting**: API rate limiting with Redis/in-memory fallback
- 🔐 **Role-Based Access Control**: Granular permissions system
- 📊 **Sentry Integration**: Error tracking and performance monitoring
- 🏥 **Health Checks**: Comprehensive health monitoring endpoints

### Performance & Quality
- ⚡ **Optimized Queries**: N+1 query prevention with pagination
- 💾 **Redis Caching**: Optional Redis for session and rate limit storage
- 🎯 **Type Safety**: Full TypeScript coverage with strict mode
- ✅ **CI/CD Pipeline**: Automated testing and deployment
- 📝 **Structured Logging**: Comprehensive logging with context

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 16.1.1](https://nextjs.org/) (App Router)
- **UI Library**: [React 19.2.3](https://react.dev/)
- **Styling**: [Tailwind CSS 3.4.1](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/)
- **State Management**: [TanStack Query 5.90](https://tanstack.com/query)
- **Forms**: [React Hook Form 7.55](https://react-hook-form.com/)
- **Tables**: [TanStack Table 8.21](https://tanstack.com/table)

### Backend
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL 14+
- **ORM**: [Prisma 5.22](https://www.prisma.io/)
- **Authentication**: [NextAuth.js 4.24](https://next-auth.js.org/)
- **API**: REST + [tRPC 11.8](https://trpc.io/) (hybrid)
- **Validation**: [Zod 3.24](https://zod.dev/)

### Infrastructure
- **Deployment**: [Vercel](https://vercel.com/)
- **Database Hosting**: Railway / Neon / Supabase
- **Storage**: Google Drive API
- **Cache/Session**: Redis (Upstash) - Optional
- **Error Tracking**: [Sentry](https://sentry.io/)
- **CI/CD**: GitHub Actions

### Integrations
- **Google APIs**: Sheets, Drive, OAuth
- **Telegram Bot API**: Real-time notifications
- **Gemini AI**: Document parsing
- **Email**: SMTP (configurable)
- **SMS**: Configurable provider

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: 20.x or higher ([Download](https://nodejs.org/))
- **npm**: 10.x or higher (comes with Node.js)
- **PostgreSQL**: 14.x or higher ([Download](https://www.postgresql.org/download/))
- **Git**: Latest version ([Download](https://git-scm.com/))

### Required Accounts & API Keys

1. **Google Cloud Platform**
   - Create project at [Google Cloud Console](https://console.cloud.google.com/)
   - Enable APIs: Sheets API, Drive API, OAuth 2.0
   - Create OAuth 2.0 credentials
   - Create Service Account with JSON key

2. **PostgreSQL Database**
   - Local installation OR
   - Cloud provider: [Railway](https://railway.app/), [Neon](https://neon.tech/), [Supabase](https://supabase.com/)

3. **Optional Services**
   - [Sentry](https://sentry.io/) - Error tracking
   - [Upstash Redis](https://upstash.com/) - Caching
   - Telegram Bot Token - [Create via @BotFather](https://t.me/botfather)
   - [Google Gemini API](https://ai.google.dev/) - AI parsing

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/dmed-app.git
cd dmed-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values (see [Environment Variables](#-environment-variables) section).

### 4. Set Up Database

Run Prisma migrations to create database schema:

```bash
npx prisma migrate dev
```

Generate Prisma Client:

```bash
npx prisma generate
```

(Optional) Seed database with sample data:

```bash
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. First Login

1. Click "Sign in with Google"
2. Authorize with your Google account
3. First user becomes SUPERADMIN automatically
4. Configure additional settings in Profile

## 🔑 Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dmed_db"

# Next.js
NODE_ENV="development" # development | production | test
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-32-characters-long"

# Google OAuth (for user authentication)
GOOGLE_CLIENT_ID="your-oauth-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-oauth-client-secret"

# Google Service Account (for Sheets/Drive API)
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_SPREADSHEET_ID="your-google-sheet-id"
```

### Optional Variables

```bash
# Google Drive
GOOGLE_DRIVE_FOLDER_ID="folder-id-for-attachments"
GOOGLE_DRIVE_ATTACHMENTS_FOLDER_ID="folder-id-for-attachments"
GOOGLE_DRIVE_SHARE_MODE="private" # public | private | domain
GOOGLE_DRIVE_SHARE_DOMAIN="yourdomain.com"

# Telegram Bot
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
TELEGRAM_ADMIN_CHAT_ID="your-chat-id"

# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"

# File Upload
FILE_UPLOAD_STRATEGY="async" # sync | async
FILE_SYNC_ASYNC="true"
LOCAL_UPLOADS_DIR="./uploads"

# Cloudflare Turnstile (Bot Protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"

# Redis/Upstash (Optional - for caching & rate limiting)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Sentry (Error Tracking)
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_AUTH_TOKEN="your-auth-token"
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"

# Feature Flags
PRISMA_LOG_QUERIES="false"
```

### Getting API Keys

<details>
<summary><strong>Google Cloud Setup (Click to expand)</strong></summary>

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing
   - Note your Project ID

2. **Enable APIs**
   - Navigate to "APIs & Services" > "Library"
   - Enable: Google Sheets API, Google Drive API

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - Copy Client ID and Client Secret

4. **Create Service Account**
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Grant "Editor" role
   - Create JSON key and download
   - Extract `client_email` and `private_key` from JSON

5. **Share Google Sheet**
   - Create or open your Google Sheet
   - Share with Service Account email
   - Grant "Editor" permission
   - Copy Sheet ID from URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
</details>

<details>
<summary><strong>Telegram Bot Setup (Click to expand)</strong></summary>

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow instructions
3. Copy the bot token
4. To get your chat ID:
   - Send a message to your bot
   - Visit: `https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates`
   - Find `"chat":{"id":123456}` in response
</details>

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database (dev)
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:seed          # Seed database with sample data
```

### Database Management

**Create a new migration:**
```bash
npx prisma migrate dev --name descriptive_name
```

**Apply migrations to production:**
```bash
npx prisma migrate deploy
```

**Reset database (WARNING: deletes all data):**
```bash
npx prisma migrate reset
```

**Open Prisma Studio (database GUI):**
```bash
npm run db:studio
```

### Code Style

This project uses:
- **ESLint** for linting
- **Prettier** for code formatting
- **Husky** for git hooks
- **lint-staged** for pre-commit checks

Code is automatically formatted on commit via git hooks.

### Testing

Run tests with coverage:
```bash
npm run test:coverage
```

Coverage thresholds are enforced in CI:
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Link project:**
```bash
vercel link
```

4. **Set environment variables:**
```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all required variables
```

5. **Deploy:**
```bash
vercel --prod
```

### Deploy to Other Platforms

The application can be deployed to any platform supporting Node.js:

- **Railway**: [Deploy Guide](https://docs.railway.app/deploy/deployments)
- **Render**: [Deploy Guide](https://render.com/docs/deploy-nextjs-app)
- **DigitalOcean App Platform**: [Deploy Guide](https://docs.digitalocean.com/products/app-platform/)
- **AWS Amplify**: [Deploy Guide](https://docs.amplify.aws/nextjs/)

### Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `NEXTAUTH_SECRET` (min 32 characters)
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Configure production database
- [ ] Set up Sentry for error tracking
- [ ] Configure Redis for caching (optional but recommended)
- [ ] Set up automated database backups
- [ ] Configure DNS and SSL certificate
- [ ] Test all OAuth redirects
- [ ] Verify all API integrations (Google, Telegram, etc.)
- [ ] Run `npm run build` locally to check for errors
- [ ] Set up monitoring and alerts

## 📁 Project Structure

```
dmed-app/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
│       └── ci.yml          # Automated testing & build
├── docs/                   # Project documentation
│   ├── ARCHITECTURE.md     # Architecture overview
│   ├── API.md              # API documentation
│   └── N+1-QUERY-FIX.md    # Performance optimization docs
├── prisma/
│   ├── migrations/         # Database migrations
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeding script
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   ├── letters/    # Letter CRUD operations
│   │   │   ├── files/      # File upload/download
│   │   │   ├── notifications/ # Notification management
│   │   │   └── ...         # Other API routes
│   │   ├── (auth)/         # Auth-protected pages
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── forms/          # Form components
│   │   ├── tables/         # Data table components
│   │   └── ...             # Feature components
│   ├── lib/                # Utility libraries
│   │   ├── prisma.ts       # Prisma client
│   │   ├── auth.ts         # NextAuth configuration
│   │   ├── logger.server.ts # Server-side logging
│   │   ├── api-handler.ts  # API middleware wrapper
│   │   ├── create-handler.ts # Enhanced API handler
│   │   └── ...             # Other utilities
│   ├── services/           # Business logic layer
│   │   ├── letter.service.ts      # Letter operations
│   │   ├── notification.service.ts # Notification logic
│   │   ├── file.service.ts        # File management
│   │   └── user.service.ts        # User management
│   ├── types/              # TypeScript type definitions
│   └── hooks/              # Custom React hooks
├── .env.example            # Environment variables template
├── .eslintrc.json          # ESLint configuration
├── .prettierrc             # Prettier configuration
├── jest.config.js          # Jest testing configuration
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel deployment config
└── package.json            # Dependencies & scripts
```

### Key Directories

- **`src/app/api/`**: REST API endpoints using Next.js Route Handlers
- **`src/services/`**: Service layer for business logic (database operations, external APIs)
- **`src/lib/`**: Shared utilities, configurations, and helper functions
- **`src/components/`**: Reusable React components
- **`prisma/`**: Database schema and migrations
- **`docs/`**: Technical documentation

## 📚 API Documentation

The application provides both REST and tRPC APIs.

### REST API Endpoints

Base URL: `/api`

<details>
<summary><strong>Authentication</strong></summary>

- `GET /api/auth/session` - Get current session
- `POST /api/auth/signin` - Sign in (handled by NextAuth)
- `POST /api/auth/signout` - Sign out
</details>

<details>
<summary><strong>Letters</strong></summary>

- `GET /api/letters` - List letters (with pagination, filters)
- `POST /api/letters` - Create letter
- `GET /api/letters/[id]` - Get letter details
- `PATCH /api/letters/[id]` - Update letter field
- `DELETE /api/letters/[id]` - Delete letter (soft delete)
- `GET /api/letters/[id]/comments` - Get comments (paginated)
- `POST /api/letters/[id]/comments` - Add comment
</details>

<details>
<summary><strong>Comments</strong></summary>

- `GET /api/comments/[id]/replies` - Get comment replies (paginated)
</details>

<details>
<summary><strong>Files</strong></summary>

- `POST /api/upload` - Upload file
- `GET /api/files/[id]` - Download file
</details>

<details>
<summary><strong>Notifications</strong></summary>

- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/[id]` - Mark as read
- `DELETE /api/notifications/[id]` - Delete notification
</details>

See [API.md](docs/API.md) for detailed documentation.

### Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default**: 100 requests per 15 minutes
- **Strict** (sensitive endpoints): 10 requests per 15 minutes
- **Generous** (public endpoints): 1000 requests per 15 minutes

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm run test`
5. **Lint & format**: `npm run lint:fix && npm run format`
6. **Commit**: `git commit -m 'Add amazing feature'`
7. **Push**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Standards

- Follow existing code style (enforced by ESLint/Prettier)
- Write TypeScript with strict mode
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Sentry](https://sentry.io/) - Error tracking

## 📞 Support

For questions, issues, or feature requests:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/dmed-app/issues)
- **Email**: support@yourdomain.com
- **Documentation**: [docs/](docs/)

---

**Made with ❤️ by the DMED Team**

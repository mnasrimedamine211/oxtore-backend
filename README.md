# Oxtore Backend

Production-ready Node.js/NestJS backend for the Oxtore mobile marketplace platform.

## Tech Stack

- **Runtime**: Node.js 20, TypeScript
- **Framework**: NestJS 10
- **Database**: PostgreSQL (local)
- **ORM**: Prisma 5
- **Auth**: JWT (access + refresh tokens), Google OAuth (optional)
- **OTP**: Email (Nodemailer/Gmail/Mailtrap) + WhatsApp (Twilio/Meta) — optional, falls back to console logging in development
- **Validation**: class-validator + class-transformer
- **Security**: Helmet, rate limiting, CORS, Argon2 password hashing, RBAC
- **API Docs**: Swagger/OpenAPI
- **Logging**: Winston

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10
- PostgreSQL 17 installed and running locally
- Prisma CLI (`npx prisma`)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url> && cd oxtore-backend

# 2. Install dependencies
npm install

# 3. Create the database
#    (using psql, pgAdmin, or any PostgreSQL client)
createdb oxtore

# 4. Copy environment file and configure DATABASE_URL / JWT secrets
cp .env.example .env.development

# 5. Generate Prisma client
npx prisma generate

# 6. Run database migrations
npx prisma migrate dev

# 7. Run seed to show models
npm run seed

# 8. Start the backend
npm run start:dev
```

External integrations (Redis, MinIO, Gmail, Twilio, Google OAuth) are entirely optional in development — the app starts and runs without any of them configured.

### Swagger

Open `http://localhost:3000/api` for interactive API documentation.

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/logout` | Logout (requires auth) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request password reset OTP |
| POST | `/auth/verify-otp` | Verify email OTP |
| POST | `/auth/reset-password` | Reset password with OTP |
| POST | `/auth/google` | Google OAuth login/signup |
| PATCH | `/auth/complete-profile` | Complete profile (requires auth) |

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get current user profile |
| PATCH | `/users/me` | Update profile |
| PATCH | `/users/me/settings` | Update settings |
| GET | `/users/me/stats` | Get user statistics |
| POST | `/users/me/active-boutique/:boutiqueId` | Set active boutique |

### Boutiques (`/api/boutiques`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/boutiques` | Create boutique |
| GET | `/boutiques` | List user boutiques |
| GET | `/boutiques/:id` | Get boutique |
| PATCH | `/boutiques/:id` | Update boutique |
| DELETE | `/boutiques/:id` | Soft delete boutique |
| GET | `/boutiques/:id/stats` | Get boutique stats |
| POST | `/boutiques/:id/owners` | Add owner |
| DELETE | `/boutiques/:id/owners/:ownerId` | Remove owner |

### Products (`/api/products`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/products` | Create product |
| GET | `/products` | List products (filter by ownerBoutiqueId, category) |
| GET | `/products/:id` | Get product |
| PATCH | `/products/:id` | Update product |
| DELETE | `/products/:id` | Soft delete product |

### Sales (`/api/sales`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sales` | Create sale (transactional) |
| GET | `/sales` | List sales (by boutiqueId) |
| GET | `/sales/stats` | Sales statistics |
| GET | `/sales/:id` | Get sale |

### Stock (`/api/stock`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/stock/items` | Create stock item |
| GET | `/stock/items` | List stock items |
| GET | `/stock/items/:id` | Get stock item |
| PATCH | `/stock/items/:id` | Update stock item |
| DELETE | `/stock/items/:id` | Delete stock item |
| POST | `/stock/adjust` | Adjust stock (in/out) |
| GET | `/stock/movements` | List inventory movements |
| GET | `/stock/low` | Get low stock items |

### Stock Requests (`/api/stock-requests`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/stock-requests` | Create stock request |
| GET | `/stock-requests` | List stock requests |
| GET | `/stock-requests/:id` | Get stock request |
| PATCH | `/stock-requests/:id/approve` | Approve (receiver) |
| PATCH | `/stock-requests/:id/reject` | Reject (receiver) |
| PATCH | `/stock-requests/:id/fulfill` | Fulfill (transactional) |
| PATCH | `/stock-requests/:id/cancel` | Cancel (requester) |

### Network (`/api/network`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/network/requests` | Create boutique network request |
| GET | `/network/requests` | List network requests |
| PATCH | `/network/requests/:id/accept` | Accept (transactional) |
| PATCH | `/network/requests/:id/reject` | Reject |
| GET | `/network/relations` | List relations |
| DELETE | `/network/relations/:id` | Remove relation |
| GET | `/network/boutiques/:boutiqueId/products` | Get network products |

### Employees (`/api/employees`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/employees` | Add employee |
| GET | `/employees` | List employees |
| GET | `/employees/:id` | Get employee |
| PATCH | `/employees/:id` | Update employee |
| DELETE | `/employees/:id` | Remove employee |
| GET | `/employees/:id/stats` | Employee stats |

### Marketplace (`/api/marketplace`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/marketplace/products` | Browse all products |
| GET | `/marketplace/categories` | Get categories |
| GET | `/marketplace/boutiques` | Browse boutiques |

### Feed (`/api/feed`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/feed/products` | Get feed (cursor pagination) |
| POST | `/feed/products/:id/like` | Toggle like |
| GET | `/feed/products/liked` | Get liked products |

### Orders (`/api/orders`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Create order (checkout, transactional) |
| GET | `/orders` | List orders |
| GET | `/orders/:id` | Get order |
| PATCH | `/orders/:id/cancel` | Cancel order (restores stock) |

### Wallet (`/api/wallet`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/wallet` | Get wallet balance |
| GET | `/wallet/transactions` | List transactions |
| POST | `/wallet/deposit` | Deposit |
| POST | `/wallet/withdraw` | Withdraw |

### Notifications (`/api/notifications`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread/count` | Unread count |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete notification |

### Admin (`/api/admin`) - ADMIN role only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/activity` | Recent activity |
| GET | `/admin/boutiques` | List all boutiques |
| PATCH | `/admin/boutiques/:id/approve` | Approve boutique |
| PATCH | `/admin/boutiques/:id/suspend` | Suspend boutique |
| GET | `/admin/users` | List all users |

### Config (`/api/config`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Get all config (currencies, countries) |
| GET | `/config/currencies` | Get currencies |
| GET | `/config/countries` | Get countries |

## Database Schema

16 tables with full RLS:
- `profiles` - User profiles (extends auth.users)
- `boutiques` - Multi-store marketplace entities
- `boutique_owners` - User↔Boutique junction
- `boutique_requests` - Network connection requests
- `boutique_relations` - Established network connections
- `employees` - HR records
- `products` - Product catalog
- `stock_items` - Inventory per product/boutique
- `inventory_movements` - Stock change audit trail
- `sales` - Sales transactions
- `stock_requests` - Inter-boutique stock transfers
- `notifications` - User notifications
- `wallets` - User wallet balances
- `wallet_transactions` - Wallet transaction history
- `orders` - Customer orders
- `feed_likes` - Per-user product likes
- `currencies` - Supported currencies
- `countries` - Supported countries

## Business Rules (Transactional)

1. **Sale Creation**: Create sale + decrease stock + create inventory movement + generate notification — all in one database transaction.
2. **Stock Request Fulfill**: Update status + transfer stock (decrease receiver, increase requester) + create two inventory movements + notification — one transaction.
3. **Boutique Request Accept**: Update request status + create boutique relation + notification — one transaction.
4. **Order Checkout**: Create order + decrease stock + create inventory movements + deduct wallet (if wallet payment) + notify boutique managers — one transaction.
5. **Order Cancel**: Update status + restore stock + create return movements + refund wallet — one transaction.

## Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT access token secret |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GMAIL_EMAIL` / `GMAIL_APP_PASSWORD` | Gmail SMTP for email OTP |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio for WhatsApp OTP |
| `MINIO_*` | S3-compatible storage config |
| `CORS_ORIGIN` | Allowed CORS origins |

## Provider Swappability

### Email OTP
Change `MAIL_PROVIDER` to `gmail` or `mailtrap`. Configure corresponding credentials. The `OtpService` auto-detects the provider and initializes the correct transporter.

### WhatsApp OTP
Change `WHATSAPP_PROVIDER` to `twilio` or `meta`. Configure corresponding credentials. The `OtpService` auto-detects and initializes the correct client.

### Database
Change `DATABASE_URL` and `POSTGRES_*` variables. No code changes needed — Prisma uses the connection string directly.

### Redis
Change `REDIS_HOST` and `REDIS_PORT`. No code changes needed.

## Prisma Commands

```bash
npx prisma generate      # Generate client
npx prisma migrate dev   # Run migrations (local PostgreSQL)
npx prisma studio         # Open Prisma Studio
npm run seed              # Run seed script
```

## npm Scripts

```bash
npm run build         # Build the project
npm run start:dev     # Start in watch mode
npm run start:prod    # Start production
npm run seed          # Seed database
npm test              # Run unit tests
npm run test:e2e      # Run e2e tests
```

## Security Features

- Argon2 password hashing
- JWT access + refresh tokens
- RBAC with role guards (ADMIN, MANAGER, SUPERVISOR, SELLER, USER)
- Helmet for HTTP headers
- Rate limiting (100 req/min default)
- Input validation with class-validator
- CORS configuration
- Row Level Security on all database tables
- Soft delete on all major entities

## Performance Features

- Pagination on all list endpoints
- Cursor pagination on feed
- Database indexes on frequently queried columns
- Redis-ready caching (configured, ready for implementation)
- Prisma connection pooling

## Project Structure

```
src/
├── auth/              # Authentication (signup, login, OTP, Google, refresh)
├── users/             # User profile, settings, stats
├── boutiques/         # Boutique CRUD, owners, stats
├── products/          # Product catalog CRUD
├── sales/             # Transactional sales
├── stock/             # Stock items, adjustments, movements
├── stock-requests/    # Inter-boutique stock transfers
├── network/           # Boutique relations and requests
├── employees/         # HR / employee management
├── marketplace/       # Public marketplace browsing
├── feed/              # Product feed with cursor pagination and likes
├── orders/            # Customer orders / checkout
├── wallet/            # User wallet and transactions
├── notifications/     # User notifications
├── admin/             # Admin-only platform management
├── config-endpoint/   # Public config (currencies, countries)
├── common/            # Shared: interceptors, filters, guards, decorators, DTOs
├── config/            # Environment configuration by domain
├── database/          # Prisma service and module
├── app.module.ts      # Root module
└── main.ts            # Application entry point
```

## Logging

Winston logger with configurable log levels (`LOG_LEVEL` env var). All HTTP requests and errors are logged with context.

## Backup Strategy

- PostgreSQL: Use `pg_dump` for local backups
- Redis: Enable RDB snapshots or AOF persistence (if/when Redis is wired in)
- MinIO: Versioning and lifecycle policies (if/when object storage is wired in)

## Monitoring Recommendations

- Application: Use Winston logs with structured JSON output for log aggregation
- Database: Monitor connection pool usage, slow queries, and index usage
- Redis: Monitor memory usage and connection count
- API: Track response times, error rates, and endpoint usage via Swagger analytics or APM tools
"# oxtore-backend" 

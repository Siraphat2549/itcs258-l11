# Lab 10 – API Testing (Hotel Booking System API)

ITCS258 Backend Application Development. This lab adds automated tests to the Room REST API built in the earlier labs (NestJS + Prisma/MySQL + Redis cache + JWT auth + rate limiting), following the testing pyramid: many fast unit tests, some integration tests, and a few end-to-end tests.

| Level | File | Tests | Needs |
|-------|------|-------|-------|
| Unit | `src/rooms/rooms.service.spec.ts` | 15 | Nothing (Prisma is mocked) |
| Integration | `src/rooms/rooms.controller.integration.spec.ts` | 13 | Nothing (service, guards and cache are mocked) |
| End-to-end | `test/rooms.e2e-spec.ts` | 8 | MySQL database (Redis is mocked) |

## Requirements

- Node.js 24+
- MySQL with the `ICTHotel` database (`database.sql`, `prisma/schema.prisma`). Only needed for the E2E tests and for running the app.
- `.env` with `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- Redis on `localhost:6379` (override with `REDIS_URL`). Only needed for running the app, not for the tests.

## Getting started

```bash
npm install
npx prisma generate
```

## Running the tests

```bash
npm test                                      # unit + integration tests
npm run test:e2e -- test/rooms.e2e-spec.ts    # Room API end-to-end tests
```

Expected results:

- `npm test`: 3 suites, 28 tests passed
- `npm run test:e2e -- test/rooms.e2e-spec.ts`: 1 suite, 8 tests passed

Run a single level:

```bash
npm test -- src/rooms/rooms.service.spec.ts                  # unit tests
npm test -- src/rooms/rooms.controller.integration.spec.ts   # integration tests
npm run test:e2e                                             # all E2E suites (also runs test/app.e2e-spec.ts)
npm test -- --coverage                                       # coverage report in coverage/
```

NestJS 12 ships as ES modules, so the test scripts run Jest with `node --experimental-vm-modules`. Use the npm scripts rather than plain `npx jest`.

## What was done in this lab

| Task | Where | Summary |
|------|-------|---------|
| 1. Set up the testing environment | `package.json`, `test/jest-e2e.json` | Jest, ts-jest, Supertest and `@nestjs/testing` were already installed. Unit and integration specs sit next to the source files (`*.spec.ts`); E2E specs live in `test/` (`*.e2e-spec.ts`). |
| 2. Unit tests for RoomsService | `src/rooms/rooms.service.spec.ts` | `PrismaService` is replaced with a mock of `prisma.rooms`, so no database is used. |
| 3. Integration tests for RoomsController | `src/rooms/rooms.controller.integration.spec.ts` | `RoomsService` and the cache manager are mocked. `JwtAuthGuard` and `RolesGuard` are overridden to allow every request, and `CacheInterceptor` is overridden to pass straight through. |
| 4. E2E tests for the Room API | `test/rooms.e2e-spec.ts` | Starts the full app from `AppModule`, seeds an ADMIN user, logs in for a real JWT and runs the whole room lifecycle against the database. |

### Unit tests: `rooms.service.spec.ts`

| Method | Success | Failure |
|--------|---------|---------|
| `create` | Passes the DTO to `prisma.rooms.create` and returns the room | Rethrows a database error |
| `findAll` | Returns `{ items, total, limit, offset }`; applies `limit`, `offset` and `is_active` | `BadRequestException` when `limit` is outside 1–100 or `offset` is negative |
| `findOne` | Returns the room by id | `NotFoundException` when the room does not exist |
| `update` | Calls `prisma.rooms.update` with the id and DTO | `NotFoundException` (update not called) for a missing room; rethrows a database error |
| `remove` | Calls `prisma.rooms.delete` with the id | `NotFoundException` (delete not called) for a missing room; rethrows a database error |

### Integration tests: `rooms.controller.integration.spec.ts`

| Endpoint | Checks |
|----------|--------|
| `POST /rooms` | Calls `service.create` with the DTO, clears the cache, returns the room |
| `GET /rooms` | Calls `service.findAll` with the paging and filter values, returns the list |
| `GET /rooms/:id` | Returns the room; `NotFoundException` when the service throws one or returns `null` |
| `PUT /rooms/:id` | Calls `service.update` with the id and DTO; `NotFoundException` when the service throws Prisma's `P2025` |
| `DELETE /rooms/:id` | Returns `{ message, room }`; `NotFoundException` for `P2025` or a service `NotFoundException`; other errors are rethrown |

### E2E tests: `test/rooms.e2e-spec.ts`

The tests run in order and share the created room's id:

| # | Request | Expected |
|---|---------|----------|
| 1 | `POST /rooms` with an admin token | 201, room returned with an `id` |
| 2 | `POST /rooms` without a token | 401 |
| 3 | `GET /rooms` | 200, the created room is in `items` |
| 4 | `GET /rooms/:id` | 200, matching room data |
| 5 | `PUT /rooms/:id` | 200, updated name and price |
| 6 | `PUT /rooms/2147483647` (missing room) | 404 |
| 7 | `DELETE /rooms/:id` | 200, `{ message, room }` |
| 8 | `GET /rooms/:id` after deleting | 404 |

Test setup details:

- **Redis is mocked.** `@keyv/redis` is replaced with an in-memory `Map`, so caching (and clearing the cache on writes) still runs without a Redis server.
- **The test user is seeded in the database.** An ADMIN user named `e2e_admin_<timestamp>` is created with a bcrypt-hashed password, then logs in through `POST /auth/login`.
- **Validation matches production.** The app uses the same global `ValidationPipe` as `main.ts`.
- **Cleanup always runs.** `afterAll` deletes the test room and the test user (even if a test failed part-way), then closes the app.

## Changes to the application code

- **Room update is now `PUT /rooms/:id`** (was `PATCH`), as the lab specifies. `test/auth-test.sh` was updated to match.
- **The controller returns 404 for missing rooms.** `update` and `remove` turn Prisma's `P2025` "record not found" error into a `NotFoundException`, and `findOne` throws `NotFoundException` if the service returns nothing.
- **Removed `src/rooms/rooms.controller.spec.ts`.** The generated stub registered the real `RoomsService` without its dependencies and always failed. Its "should be defined" check is now in the integration spec.

## API overview

**Authentication:** `POST /auth/login` returns `{ "access_token": "..." }`. Send it as `Authorization: Bearer <access_token>`.

**Rate limiting:** 30 requests per minute per client globally, and 10 per minute on each `/rooms` endpoint. Going over the limit returns `429 Too Many Requests`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rooms` | Public | Paginated list: `?limit=20&offset=0&is_active=true` |
| GET | `/rooms/popular` | Public | Up to 10 featured rooms |
| GET | `/rooms/{id}` | JWT (any role) | One room |
| POST | `/rooms` | JWT, ADMIN | Create a room |
| PUT | `/rooms/{id}` | JWT, ADMIN | Update a room (only the fields sent are changed) |
| DELETE | `/rooms/{id}` | JWT, ADMIN | Delete a room; returns `{ message, room }` |
| PATCH | `/rooms/{id}/disable` | Public | Set `is_active` to false |
| PATCH | `/rooms/{id}/enable` | Public | Set `is_active` to true |

## Running the app

```bash
docker start redis          # first time: docker run -d --name redis -p 6379:6379 redis:7
npm run start:dev
```

Swagger UI: **http://localhost:3000/api-docs**. With the app running, `bash test/auth-test.sh` runs a manual curl check of the auth and role-based access flow.

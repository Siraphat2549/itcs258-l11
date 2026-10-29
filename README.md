# Lab 11 – Containerize My Own Project (Hotel Booking System API)

ITCS258 Backend Application Development. Part 05 of Lab 11: the Hotel Booking System API from the earlier labs (NestJS 12 + Prisma 7/MariaDB + Redis cache + JWT auth + rate limiting) packaged as a Docker image and run as a container.

| Field | Value |
|-------|-------|
| Project | Hotel Booking System API |
| Route tested | `GET /rooms` (reads rooms from the MariaDB database) |
| Host port → container port | `127.0.0.1:8082` → `3000/tcp` |
| Images | `itcs258-hotel-api:v1`, `itcs258-hotel-api:v2` (after the source change) |
| Container | `hotel-api` |

## Requirements

- Docker Desktop with Linux containers, engine running
- Node.js 24+ (for the local baseline)
- MariaDB/MySQL on the host, port 3306, with the `ICTHotel` database (`database.sql`, `prisma/schema.prisma`)
- Redis on port 6379: `docker start redis` (first time: `docker run -d --name redis -p 6379:6379 redis:7`)
- `.env` for local runs and `.env.docker` for the container (see below)

## Files added or changed for Docker

| File | Purpose |
|------|---------|
| `Dockerfile` | Two stages. **build**: `npm ci`, `npx prisma generate`, `nest build`, then `npm prune --omit=dev`. **runtime**: copies `node_modules`, `dist` and `package*.json`, runs as `USER node`, `CMD ["node", "dist/src/main.js"]` |
| `.dockerignore` | Keeps `node_modules`, `dist`, `.git`, `test`, logs and real `.env` files out of the build context |
| `.env.example` | Placeholder configuration for the container (safe to commit) |
| `.env.docker` | Real container configuration (git-ignored by `.env.*`, never copied into the image) |
| `src/main.ts` | Listens on `Number(process.env.PORT ?? 3000)` and `0.0.0.0` |
| `package.json` | `start:prod` runs `node dist/src/main` |
| `src/app.service.ts` | Greeting changed to `Hello from Hotel API v2` for the source-change experiment |

`.env.docker` uses the same keys as `.env.example`:

```
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@host.docker.internal:3306/ICTHotel
REDIS_URL=redis://host.docker.internal:6379
JWT_SECRET=...
JWT_EXPIRES_IN=1d
```

## 1. Local baseline

```powershell
npm ci
npx prisma generate
npm run build
npm run start:prod
```

In a second terminal:

```powershell
curl.exe http://localhost:3000/
curl.exe http://localhost:3000/rooms
```

Expected: the greeting, then a JSON list `{ "items": [...], "total": 16, "limit": 20, "offset": 0 }`. Stop with Ctrl+C.

## 2. Build the image

```powershell
docker build -t itcs258-hotel-api:v1 .
docker image ls itcs258-hotel-api
```

## 3. Run the container

```powershell
docker run -d --name hotel-api -p 127.0.0.1:8082:3000 --env-file .env.docker itcs258-hotel-api:v1
docker ps
docker logs hotel-api
docker inspect --format "{{json .NetworkSettings.Ports}}" hotel-api
docker inspect --format "{{.Config.User}}" hotel-api
```

Expected: status `Up`, ports `127.0.0.1:8082->3000/tcp`, logs ending with `Nest application successfully started`, user `node`.

Host port `8082` belongs to the laptop; port `3000` belongs to the container. `8080` and `8081` are left for the Express and FastAPI demos.

## 4. Verify from the host and from inside

```powershell
curl.exe http://localhost:8082/
curl.exe http://localhost:8082/rooms
docker exec hotel-api node -e "fetch('http://127.0.0.1:3000/rooms').then(r=>r.json()).then(d=>console.log('total rooms:', d.total))"
```

Expected: `/rooms` returns 200 with `"total":16` from the host, and the inside request prints `total rooms: 16`. Swagger UI is at **http://localhost:8082/api-docs**.

## 5. Source change and rebuild

`src/app.service.ts` returns `Hello from Hotel API v2` (was `Hello World!`). A running container keeps the code in its image, so build a new image and recreate the container:

```powershell
docker build -t itcs258-hotel-api:v2 .
docker stop hotel-api
docker rm hotel-api
docker run -d --name hotel-api -p 127.0.0.1:8082:3000 --env-file .env.docker itcs258-hotel-api:v2
curl.exe http://localhost:8082/
```

Expected: `Hello from Hotel API v2`.

## Problems found and how they were fixed

| Problem | Cause | Fix |
|---------|-------|-----|
| Container exits with `Cannot find module '/app/dist/main.js'` | `tsconfig.json` sets `rootDir: "./"`, so `nest build` writes the entrypoint to `dist/src/main.js` | `CMD ["node", "dist/src/main.js"]`; `start:prod` fixed the same way |
| Prisma client missing at run time | The client is generated into `node_modules/.prisma`; a fresh `npm ci --omit=dev` in the runtime stage would not contain it | Run `npx prisma generate` in the build stage, `npm prune --omit=dev`, and copy that `node_modules` to the runtime stage |
| Database connection refused | Inside a container `localhost` is the container itself, not the laptop | `DATABASE_URL` uses `host.docker.internal:3306` |
| `GET /` works but `GET /rooms` never responds | The rooms cache waits for Redis, which was not running / pointed at `localhost` | Start Redis (`docker start redis`) and set `REDIS_URL=redis://host.docker.internal:6379` |
| Variables from `.env` not accepted | `docker --env-file` keeps quotes as part of the value | `.env.docker` has no quotes around values |
| Server not reachable through the published port | `app.listen(port)` must accept connections from the container network | `app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')` |

## Clean up

```powershell
docker stop hotel-api
docker rm hotel-api
docker stop redis
```

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

## Tests (from Lab 10)

```bash
npm test                                      # unit + integration tests
npm run test:e2e -- test/rooms.e2e-spec.ts    # Room API end-to-end tests (needs the database)
```

The tests are not part of the Docker image (`test` is in `.dockerignore`, and dev dependencies are pruned).

/*
AI Declaration:
I used Claude Code as a coding assistant for this lab. It wrote the Room service unit tests,
the controller integration tests and the Room API E2E tests, following the lecture's Terms examples.

Reflection:
The E2E test showed me the whole room lifecycle working through real HTTP requests, from logging in
as a seeded admin to checking the deleted room returns 404, and why cleaning up test data matters.
Using AI made the lab faster, but I had to understand why Redis is mocked while the database stays real.
*/

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreateRoomDto } from '../src/rooms/dto/create-room.dto';
import { UpdateRoomDto } from '../src/rooms/dto/update-room.dto';

// Mock the Redis store so the E2E tests run without a Redis server.
// AppModule builds its cache from `new KeyvRedis(url)`; returning a Map instead gives the
// cache manager an in-memory store, so caching (and clearing it on writes) still works.
jest.mock('@keyv/redis', () => ({
  __esModule: true,
  default: jest.fn(() => new Map()),
}));

// Largest INT id, which no test room will ever have
const MISSING_ROOM_ID = 2147483647;

describe('RoomsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let adminUserId: number;
  let createdRoomId: number;

  beforeAll(async () => {
    // Initialize the full NestJS application, with the same global pipe as main.ts
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);

    // Seed a real ADMIN user in the database: create/update/delete require Role.ADMIN, and the
    // test logs in through the real /auth/login endpoint
    const username = `e2e_admin_${Date.now()}`;
    const password = 'password123';
    const admin = await prisma.users.create({
      data: { username, password: await bcrypt.hash(password, 10), role: Role.ADMIN },
    });
    adminUserId = admin.id;

    // Capture the JWT to send as "Authorization: Bearer <token>" in the requests below
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    accessToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    // Remove test data even if a test failed half-way through the lifecycle
    if (createdRoomId) {
      await prisma.rooms.deleteMany({ where: { id: createdRoomId } });
    }
    if (adminUserId) {
      await prisma.users.deleteMany({ where: { id: adminUserId } });
    }
    await app.close();
  });

  it('/rooms (POST) - Create Room', async () => {
    const createDto: CreateRoomDto = {
      name: 'E2E Test Room',
      description: 'Room created by the E2E test suite',
      capacity: 2,
      price_per_night: 1500,
    };

    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDto)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('E2E Test Room');
    expect(response.body.capacity).toBe(2);
    expect(Number(response.body.price_per_night)).toBe(1500);
    createdRoomId = response.body.id;
  });

  it('/rooms (POST) - Fail Unauthorized without a token', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: 'No Token Room', capacity: 2, price_per_night: 1500 })
      .expect(401);
  });

  it('/rooms (GET) - Get All Rooms includes the created room', async () => {
    // GET /rooms is paginated and sorted by id, so the newest room is on the last page.
    // Read the total first, then fetch the page that ends with the last room.
    const first = await request(app.getHttpServer()).get('/rooms?limit=1').expect(200);
    const offset = Math.max(0, first.body.total - 100);

    const response = await request(app.getHttpServer())
      .get(`/rooms?limit=100&offset=${offset}`)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    const found = response.body.items.find((room: { id: number }) => room.id === createdRoomId);
    expect(found).toBeDefined();
    expect(found.name).toBe('E2E Test Room');
  });

  it('/rooms/:id (GET) - Get Single Room', async () => {
    const response = await request(app.getHttpServer())
      .get(`/rooms/${createdRoomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: createdRoomId,
      name: 'E2E Test Room',
      description: 'Room created by the E2E test suite',
      capacity: 2,
    });
  });

  it('/rooms/:id (PUT) - Update Room', async () => {
    const updateDto: UpdateRoomDto = { name: 'Updated E2E Room', price_per_night: 1800 };

    const response = await request(app.getHttpServer())
      .put(`/rooms/${createdRoomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(updateDto)
      .expect(200);

    expect(response.body.id).toBe(createdRoomId);
    expect(response.body.name).toBe('Updated E2E Room');
    expect(Number(response.body.price_per_night)).toBe(1800);
  });

  it('/rooms/:id (PUT) - Fail Not Found', async () => {
    await request(app.getHttpServer())
      .put(`/rooms/${MISSING_ROOM_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Fail' })
      .expect(404);
  });

  it('/rooms/:id (DELETE) - Delete Room', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/rooms/${createdRoomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.message).toBe(`Room ${createdRoomId} deleted successfully`);
    expect(response.body.room.id).toBe(createdRoomId);
  });

  it('/rooms/:id (GET) - Verify Deletion returns 404', async () => {
    await request(app.getHttpServer())
      .get(`/rooms/${createdRoomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});

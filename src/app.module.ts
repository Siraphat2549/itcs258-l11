/*
AI Declaration:
I used Claude Code as a coding assistant for this lab. It wrote the Room service unit tests,
the controller integration tests and the Room API E2E tests, following the lecture's Terms examples,
and changed the room update endpoint to PUT with 404 handling in the controller.

Reflection:
Writing tests at three levels showed me how the testing pyramid works in practice: the unit tests mock Prisma and run in about a second, while the E2E test needs the real database but proves login, guards and validation work together.
Using AI made the lab faster, but I had to compare its tests with the lecture examples to understand why the guards and cache are mocked in one test and real in another.
*/

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RoomsModule } from './rooms/rooms.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        ttl: 5 * 60 * 1000, // 5 minutes (milliseconds in cache-manager v7)
        stores: [new KeyvRedis(process.env.REDIS_URL ?? 'redis://localhost:6379')],
      }),
    }),
    // Global rate limit: 30 requests per minute per client (ttl is in milliseconds)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    PrismaModule,
    AuthModule,
    RoomsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // apply ThrottlerGuard to every route
  ],
})
export class AppModule {}

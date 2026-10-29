import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ConsoleLogger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'nest-lab',
    }),
  });
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Hotel Booking System API')
    .setDescription(
      'REST API for the Hotel Booking System.\n\n' +
        '- **Rooms**: list, view, create, update, delete, enable and disable hotel rooms.\n' +
        '- **Bookings**: create and manage room bookings.\n\n' +
        'Protected endpoints require a JWT access token: log in via `POST /auth/login`, ' +
        'then click **Authorize** and paste the token.\n\n' +
        '**Rate limiting:** clients are limited to 100 requests per minute. ' +
        'Exceeding the limit returns `429 Too Many Requests`.',
    )
    .setVersion('1.0.0')
    .addTag('rooms', 'Room management endpoints')
    .addTag('bookings', 'Booking management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Use: Authorization: Bearer <access_token> (get it from POST /auth/login)',
        in: 'header',
      },
      'access-token', // Security name used in @ApiBearerAuth()
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();

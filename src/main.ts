import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Redis Socket adapter
  const redisAdapter = new RedisIoAdapter(app);

  await redisAdapter.connectToRedis();

  app.useWebSocketAdapter(redisAdapter);

  const config = new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription('The CRM API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);


  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`Server is running on port http://localhost:${process.env.PORT ?? 3000}`);
    console.log(`Swagger UI is running on port http://localhost:${process.env.PORT ?? 3000}/api`);
  });
}
bootstrap();

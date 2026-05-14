import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
  })

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Redis Socket adapter (using env vars via ConfigService)
  const configSvc = app.get(ConfigService);
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(configSvc);
  app.useWebSocketAdapter(redisAdapter);

  const config = new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription('The CRM API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);


  const logger = new Logger('Bootstrap');
  await app.listen(process.env.PORT ?? 3000, () => {
    logger.log(`Server is running on port http://localhost:${process.env.PORT ?? 3000}`);
    logger.log(`Swagger UI is running on port http://localhost:${process.env.PORT ?? 3000}/docs`);
  });
}
bootstrap();

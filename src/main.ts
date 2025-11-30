import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.HTTP_PORT || 3000;
  
  // Log configuration on startup
  console.log('=== Application Configuration ===');
  console.log(`HTTP_PORT: ${port}`);
  console.log(`PG_HOST: ${process.env.PG_HOST || 'localhost'}`);
  console.log(`PG_DB: ${process.env.PG_DB || 'db'}`);
  console.log(`WB_API_TOKEN: ${process.env.WB_API_TOKEN ? '***configured***' : 'not set'}`);
  console.log(`GOOGLE_SPREADSHEETS: ${process.env.GOOGLE_SPREADSHEETS || 'not set'}`);
  console.log(`GOOGLE_SERVICE_ACCOUNT_KEYFILE: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE || 'key.json'}`);
  console.log('================================');
  
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

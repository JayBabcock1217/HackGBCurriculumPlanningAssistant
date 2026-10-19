// Load backend/.env into process.env before anything reads it. In Docker the
// env vars are injected by docker-compose (so this is a no-op there); running
// natively, this makes `backend/.env` "just work" without a wrapper script.
// `dotenv/config` has a side effect (it calls dotenv.config() on require), and
// because main.ts is the entry point it runs before AppModule is built, so all
// services see the loaded vars. (CJS build: use require, not a bare import, so
// the side effect isn't elided and it resolves under moduleResolution: node.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv/config');

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();

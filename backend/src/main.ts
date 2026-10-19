// Load backend/.env into process.env before anything reads it. In Docker the
// env vars are injected by docker-compose (so this is a no-op there); running
// natively, this makes the config "just work" without a wrapper script.
//
// We load from a path resolved relative to THIS file (dist/main.js -> up one
// dir to backend/ -> .env) rather than relying on process.cwd(), because the
// app can be started from any directory (e.g. `node backend/dist/main.js` from
// the repo root leaves cwd at the root, where there is no .env). dotenv does
// not override vars already set in the environment, so real env vars (Docker,
// CI, `FOO=bar node ...`) always win over the file. (CJS build: __dirname is
// available in the compiled output.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { config: loadEnvFile } = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolve } = require('path');

// dist/main.js -> backend/ -> .env ; also try cwd as a fallback for dev runs.
loadEnvFile({ path: resolve(__dirname, '..', '.env') });
loadEnvFile({ path: resolve(process.cwd(), '.env') });

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

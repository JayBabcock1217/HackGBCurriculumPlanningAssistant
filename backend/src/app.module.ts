import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';
import { RagModule } from './rag/rag.module';
import { SuggestionGeneratorModule } from './suggestions/suggestion-generator.module';
import { AuthModule } from './database/auth/auth.module';
import { JwtAuthGuard } from './database/auth/jwt-auth.guard';
import { RolesGuard } from './database/auth/roles.guard';

/**
 * AppModule
 *
 * Chunk 11: JWT auth is applied globally (APP_GUARD). JwtAuthGuard runs first
 * and rejects unauthenticated requests with 401 unless the route is @Public;
 * RolesGuard runs second and enforces @Roles(...) with 403. /api/health stays
 * public via @Public on its controller.
 */
@Module({
  imports: [
    HealthModule,
    DatabaseModule,
    FileStorageModule,
    LlmGatewayModule,
    RagModule,
    SuggestionGeneratorModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}


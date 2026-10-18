import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';

@Module({
  imports: [HealthModule, DatabaseModule, FileStorageModule, LlmGatewayModule],
})
export class AppModule {}

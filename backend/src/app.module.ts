import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { FileStorageModule } from './file-storage/file-storage.module';

@Module({
  imports: [HealthModule, DatabaseModule, FileStorageModule],
})
export class AppModule {}

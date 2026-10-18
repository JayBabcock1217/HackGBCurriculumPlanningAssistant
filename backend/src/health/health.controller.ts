import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../database/auth/jwt-auth.guard';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Public (no auth) so docker healthchecks and start.sh can probe it.
  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }
}

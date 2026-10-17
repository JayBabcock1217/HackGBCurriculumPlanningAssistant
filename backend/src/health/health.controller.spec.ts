import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return status ok', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
    });

    it('should return a timestamp', () => {
      const result = controller.check();
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should return uptime', () => {
      const result = controller.check();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

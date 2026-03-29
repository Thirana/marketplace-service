import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns a live status payload', () => {
    const service = new HealthService({} as DataSource);

    expect(service.getLiveness()).toMatchObject({
      status: 'ok',
      checks: {
        application: 'up',
      },
    });
  });

  it('fails readiness when the data source is not initialized', async () => {
    const service = new HealthService({
      isInitialized: false,
    } as DataSource);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns a ready status payload when the data source is healthy', async () => {
    const service = new HealthService({
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: {
        database: 'up',
      },
    });
  });
});

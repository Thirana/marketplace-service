import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getLiveness() {
    return {
      status: 'ok',
      checks: {
        application: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Confirms the application can reach PostgreSQL so later modules can rely on
   * the service being ready for migration-backed work.
   */
  async getReadiness() {
    if (!this.dataSource.isInitialized) {
      throw new ServiceUnavailableException({
        message: 'Database connection is not initialized.',
        errorCode: 'DATABASE_NOT_READY',
      });
    }

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database connectivity check failed.',
        errorCode: 'DATABASE_NOT_READY',
      });
    }

    return {
      status: 'ok',
      checks: {
        database: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

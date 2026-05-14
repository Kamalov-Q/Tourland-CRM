import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private dataSource: DataSource) {}

  async check() {
    const dbStatus = this.dataSource.isInitialized ? 'up' : 'down';
    
    let dbPing = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch (e) {
      dbPing = 'error';
    }

    return {
      status: dbPing === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: {
        database: {
          status: dbStatus,
          ping: dbPing,
        },
      },
    };
  }
}

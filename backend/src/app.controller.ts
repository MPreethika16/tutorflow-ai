import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): {
    status: string;
    service: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: 'tutorflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
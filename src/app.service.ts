import { Injectable } from '@nestjs/common';

interface HealthCheck {
  healthy: boolean;
}

@Injectable()
export class AppService {
  getHello(): HealthCheck {
    return { healthy: true };
  }
}

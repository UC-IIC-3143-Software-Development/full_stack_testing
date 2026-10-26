import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { CheckHealth } from '../application/check-health'

@Controller('health')
export class HealthController {
  constructor(private readonly checkHealth: CheckHealth) {}

  /** operationId getHealth */
  @Get()
  async getHealth(): Promise<{ status: 'ok' }> {
    try {
      return await this.checkHealth.execute()
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde')
    }
  }
}

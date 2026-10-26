import { Global, Module } from '@nestjs/common'
import { CLOCK } from './application/clock'
import { FixedClock } from './infrastructure/clock/fixed-clock'
import { SystemClock } from './infrastructure/clock/system-clock'
import { APP_CONFIG, loadConfig, type AppConfig } from './infrastructure/config/app-config'
import { OpenApiRequestValidator } from './presentation/openapi/openapi-request-validator'

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    {
      provide: CLOCK,
      // CLOCK_FIXED_NOW fija "hoy" para las pruebas y la evidencia del PR.
      useFactory: (config: AppConfig) =>
        config.clockFixedNow ? new FixedClock(config.clockFixedNow) : new SystemClock(),
      inject: [APP_CONFIG],
    },
    {
      provide: OpenApiRequestValidator,
      useFactory: (config: AppConfig) => OpenApiRequestValidator.fromFile(config.openApiPath),
      inject: [APP_CONFIG],
    },
  ],
  exports: [APP_CONFIG, CLOCK, OpenApiRequestValidator],
})
export class SharedModule {}

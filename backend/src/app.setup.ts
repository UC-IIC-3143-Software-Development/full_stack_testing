import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'

export const API_PREFIX = 'api'

/**
 * Configuración HTTP común. La usan main.ts y los tests de contrato, para que los tests
 * prueben exactamente la misma app que corre en producción.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.setGlobalPrefix(API_PREFIX)
  app.disable('x-powered-by')
  app.use(helmet())
  app.enableShutdownHooks()
  return app
}

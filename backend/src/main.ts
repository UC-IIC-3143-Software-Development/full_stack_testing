import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import { APP_CONFIG, type AppConfig } from './shared/infrastructure/config/app-config'

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule))
  const config = app.get<AppConfig>(APP_CONFIG)
  await app.listen(config.port, '0.0.0.0')
}

void bootstrap()

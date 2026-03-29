import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { configFactories, validateEnv } from './config';
import { loggingConfig } from './config';
import { createWinstonOptions } from './common/logging/winston.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: configFactories,
    }),
    WinstonModule.forRootAsync({
      inject: [loggingConfig.KEY],
      useFactory: createWinstonOptions,
    }),
    DatabaseModule,
    HealthModule,
    OrdersModule,
    ProductsModule,
  ],
})
export class AppModule {}

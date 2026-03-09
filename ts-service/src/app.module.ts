import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { defaultDatabaseUrl, getTypeOrmOptions } from './config/typeorm.options';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
import { QueueModule } from './queue/queue.module';
import { SampleModule } from './sample/sample.module';
import { CandidatesModule } from './candidates/candidates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true,   envFilePath: '.env',
 }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getTypeOrmOptions(configService.get<string>('DATABASE_URL') ?? defaultDatabaseUrl),
    }),
    AuthModule,
    HealthModule,
    QueueModule,
    LlmModule,
    SampleModule,
    CandidatesModule
  ],
})
export class AppModule {}

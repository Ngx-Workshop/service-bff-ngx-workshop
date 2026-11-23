import { ObservabilityModule } from './observability/observability.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MfeRemotesModule } from './mfe-remotes.module';

@Module({
  imports: [
    ObservabilityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MfeRemotesModule,
  ],
})
export class AppModule {}

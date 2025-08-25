import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppService } from './app.service';

import type { MfeRemoteDto } from '@tmdjr/ngx-mfe-orchestrator-contracts';

@Controller()
export class AppController {
  constructor(private appService: AppService) {}

  @Get('health')
  healthCheck(): string {
    return 'OK';
  }

  @Get('mfe-remotes')
  getMFERemotes(): Observable<MfeRemoteDto[]> {
    return this.appService.getMFERemotes();
  }
}

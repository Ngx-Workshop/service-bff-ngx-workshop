import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppService } from './app.service';
import { IMfeRemote } from './interfaces/mfe-remote.interface';

@Controller()
export class AppController {
  constructor(private appService: AppService) {}

  @Get('health')
  healthCheck(): string {
    return 'OK';
  }

  @Get('mfe-remotes')
  getMFERemotes(): Observable<IMfeRemote[]> {
    return this.appService.getMFERemotes();
  }
}

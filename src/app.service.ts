import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IMfeRemote } from './interfaces/mfe-remote.interface';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  getMFERemotes(): Observable<IMfeRemote[]> {
    const mfeOrchestratorUrl = this.configService.get<string>(
      'MFE_ORCHESTRATOR_URL'
    );
    console.log('MFE_ORCHESTRATOR_URL:', mfeOrchestratorUrl);
    const url = `${mfeOrchestratorUrl}/mfe-remotes`;

    return this.httpService
      .get<IMfeRemote[]>(url)
      .pipe(map((response) => response.data));
  }
}

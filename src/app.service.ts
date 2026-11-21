import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';

import type { MfeRemoteDto } from '@tmdjr/ngx-mfe-orchestrator-contracts';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly httpService: HttpService) {}

  getMFERemotes(): Observable<MfeRemoteDto[]> {
    const url = `${process.env.MFE_ORCHESTRATOR_URL}/mfe-remotes`;

    this.logger.debug('Fetching MFE remotes');
    return this.httpService.get<MfeRemoteDto[]>(url).pipe(
      tap((response) => {
        this.logger.debug({
          event: 'mfe_remotes_received',
          count: response.data.length,
        });
      }),
      map((response) => response.data)
    );
  }
}

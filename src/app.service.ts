import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';

import type { MfeRemoteDto } from '@tmdjr/ngx-mfe-orchestrator-contracts';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  getMFERemotes(): Observable<MfeRemoteDto[]> {
    const url = `${process.env.MFE_ORCHESTRATOR_URL}/mfe-remotes`;

    console.log(`Fetching MFE remotes from: ${url}`);
    return this.httpService.get<MfeRemoteDto[]>(url).pipe(
      tap((response) => {
        console.log(`Received ${response.data} MFE remotes`);
      }),
      map((response) => response.data)
    );
  }
}

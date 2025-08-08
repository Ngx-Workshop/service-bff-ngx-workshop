import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';
import { IMfeRemote } from './interfaces/mfe-remote.interface';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  getMFERemotes(): Observable<IMfeRemote[]> {
    const url = `${process.env.MFE_ORCHESTRATOR_URL}/api/mfe-remotes`;

    console.log(`Fetching MFE remotes from: ${url}`);
    return this.httpService.get<IMfeRemote[]>(url).pipe(
      tap((response) => {
        console.log(`Received ${response.data} MFE remotes`);
      }),
      map((response) => response.data)
    );
  }
}

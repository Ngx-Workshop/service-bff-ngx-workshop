import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IMfeRemote } from './interfaces/mfe-remote.interface';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  getMFERemotes(): Observable<IMfeRemote[]> {
    const url = `${process.env.MFE_ORCHESTRATOR_URL}/mfe-remotes`;

    return this.httpService
      .get<IMfeRemote[]>(url)
      .pipe(map((response) => response.data));
  }
}

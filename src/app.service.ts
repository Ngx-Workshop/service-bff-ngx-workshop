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
    const authBaseUrl = this.configService.get<string>('AUTH_BASE_URL');
    const url = `${authBaseUrl}/mfe-remotes`;

    return this.httpService
      .get<IMfeRemote[]>(url)
      .pipe(map((response) => response.data));
  }
}

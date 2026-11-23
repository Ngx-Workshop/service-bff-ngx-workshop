import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { randomUUID } from 'node:crypto';
import { Observable, catchError, defer, map, tap, throwError } from 'rxjs';
import { currentRequestId } from './observability/observability';

import type { MfeRemoteDto } from '@tmdjr/ngx-mfe-orchestrator-contracts';

const UPSTREAM_FAILURE_RESPONSE = {
  statusCode: 500,
  message: 'Internal server error',
};

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  constructor(private readonly httpService: HttpService) {}

  getMFERemotes(): Observable<MfeRemoteDto[]> {
    const url = `${process.env.MFE_ORCHESTRATOR_URL}/mfe-remotes`;

    return defer(() => {
      const started = process.hrtime.bigint();
      const requestId = currentRequestId();
      const operationId = randomUUID();
      const entry = (outcome: 'success' | 'failure') => ({
        event: 'mfe_remotes_fetch',
        outcome,
        operationId,
        ...(requestId ? { requestId } : {}),
        durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      });
      return this.httpService.get<MfeRemoteDto[]>(url).pipe(
        map((response) => {
          if (response.data == null) {
            throw new InternalServerErrorException(UPSTREAM_FAILURE_RESPONSE);
          }
          return response.data;
        }),
        tap(() => this.logger.log(entry('success'))),
        catchError((error: unknown) => {
          this.logger.error(entry('failure'));
          // Axios errors include credential-bearing config; retain the generic
          // HTTP 500 without handing that config to Nest's exception logger.
          return throwError(() =>
            isAxiosError(error)
              ? new InternalServerErrorException(UPSTREAM_FAILURE_RESPONSE)
              : error
          );
        })
      );
    });
  }
}

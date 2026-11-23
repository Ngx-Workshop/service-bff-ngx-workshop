import { HttpService } from '@nestjs/axios';
import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import type { Server } from 'node:http';
import { firstValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Match callable Supertest in CommonJS service builds.
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { AppService } from '../src/app.service';
import {
  configureObservability,
  createServiceLogger,
} from '../src/observability/observability';

describe('BFF public boundaries (isolated upstream adapter)', () => {
  const uuid: unknown = expect.stringMatching(/^[0-9a-f-]{36}$/);
  const duration: unknown = expect.any(Number);
  const stringValue: unknown = expect.any(String);
  let app: INestApplication<Server>;
  let previousUrl: string | undefined;
  let stdout: jest.SpiedFunction<typeof process.stdout.write>;
  let stderr: jest.SpiedFunction<typeof process.stderr.write>;
  const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>();
  const remotes = [
    { name: 'example', remoteEntry: 'https://example.invalid/mfe.js' },
  ];

  beforeAll(async () => {
    previousUrl = process.env.MFE_ORCHESTRATOR_URL;
    process.env.MFE_ORCHESTRATOR_URL = 'http://upstream.invalid';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    module.get(HttpService).axiosRef.defaults.adapter = adapter;
    app = module.createNestApplication({ logger: createServiceLogger() });
    configureObservability(app);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    );
    await app.init();
  });

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    adapter.mockReset();
    adapter.mockImplementation((config) =>
      Promise.resolve({
        data: remotes,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      })
    );
  });

  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
  });

  function entries(event?: string): unknown[] {
    return [...stdout.mock.calls, ...stderr.mock.calls]
      .map(([chunk]) => String(chunk))
      .filter((line) => !event || line.includes(`"${event}"`))
      .map((line): unknown => JSON.parse(line));
  }

  function expectSafeLogs() {
    expect(JSON.stringify(entries())).not.toContain('private-');
  }

  function containing(value: Record<string, unknown>): unknown {
    return expect.objectContaining(value);
  }

  function requestId(response: request.Response): string {
    const value: unknown = response.headers['x-request-id'];
    expect(value).toEqual(uuid);
    if (typeof value !== 'string') throw new Error('Missing request ID header');
    return value;
  }

  afterAll(async () => {
    await app.close();
    if (previousUrl === undefined) delete process.env.MFE_ORCHESTRATOR_URL;
    else process.env.MFE_ORCHESTRATOR_URL = previousUrl;
  });

  it('passes through owner data for anonymous requests with no credential forwarding', async () => {
    const anonymous = await request(app.getHttpServer())
      .get('/mfe-remotes')
      .expect(200, remotes);
    const authenticated = await request(app.getHttpServer())
      .get('/mfe-remotes?search=private-query')
      .set('Authorization', 'Bearer private-token')
      .set('Cookie', 'session=private-cookie')
      .set('X-Request-ID', 'private-untrusted-correlation')
      .expect(200, remotes);
    for (const [config] of adapter.mock.calls) {
      expect(config.url).toBe('http://upstream.invalid/mfe-remotes');
      expect(config.method).toBe('get');
      expect(config.timeout).toBe(0);
      expect(config.headers.has('Authorization')).toBe(false);
      expect(config.headers.has('Cookie')).toBe(false);
      expect(config.headers.has('X-Request-ID')).toBe(false);
      expect(config.params).toBeUndefined();
    }
    expect(requestId(anonymous)).not.toBe(requestId(authenticated));
    expect(entries('mfe_remotes_fetch')).toHaveLength(2);
    for (const response of [anonymous, authenticated]) {
      expect(entries()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'log',
            context: 'AppService',
            message: containing({
              event: 'mfe_remotes_fetch',
              outcome: 'success',
              requestId: requestId(response),
              operationId: uuid,
              durationMs: duration,
            }),
          }),
          expect.objectContaining({
            context: 'HTTP',
            message: containing({
              event: 'http_request',
              requestId: requestId(response),
              statusCode: 200,
            }),
          }),
        ])
      );
    }
    expectSafeLogs();
  });

  it.each([401, 404, 409, 503])(
    'retains generic 500 mapping for upstream HTTP %s',
    async (status) => {
      adapter.mockImplementation((config) => {
        config.auth = {
          username: 'private-user',
          password: 'private-password',
        };
        config.headers.set('Authorization', 'Bearer private-upstream-token');
        config.url = 'http://private-host.invalid/mfe-remotes?key=private-key';
        return Promise.reject(
          new AxiosError(
            'private-upstream-error',
            'ERR_BAD_RESPONSE',
            config,
            undefined,
            {
              data: { secret: 'private-body' },
              status,
              statusText: 'Failed',
              headers: new AxiosHeaders(),
              config,
            }
          )
        );
      });
      await request(app.getHttpServer())
        .get('/mfe-remotes')
        .expect(500, { statusCode: 500, message: 'Internal server error' });
      expect(entries('mfe_remotes_fetch')).toEqual([
        expect.objectContaining({
          level: 'error',
          context: 'AppService',
          message: containing({
            outcome: 'failure',
            durationMs: duration,
            requestId: stringValue,
          }),
        }),
      ]);
      // One operation event and one access event, no raw Nest exception dump.
      expect(entries()).toHaveLength(2);
      expectSafeLogs();
    }
  );

  it('retains generic 500 mapping for an upstream timeout', async () => {
    adapter.mockImplementation((config) =>
      Promise.reject(new AxiosError('private-timeout', 'ECONNABORTED', config))
    );
    await request(app.getHttpServer())
      .get('/mfe-remotes')
      .expect(500, { statusCode: 500, message: 'Internal server error' });
    expectSafeLogs();
  });

  it.each([null, undefined])(
    'retains failure for a missing owner payload (%s)',
    async (data) => {
      adapter.mockImplementation((config) =>
        Promise.resolve({
          config,
          data,
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
        })
      );
      await request(app.getHttpServer())
        .get('/mfe-remotes')
        .expect(500, { statusCode: 500, message: 'Internal server error' });
      expect(entries('mfe_remotes_fetch')).toEqual([
        expect.objectContaining({
          level: 'error',
          message: containing({ outcome: 'failure' }),
        }),
      ]);
      expect(entries()).toHaveLength(2);
    }
  );

  it('preserves explicit Nest HTTP exceptions rather than replacing their status', async () => {
    adapter.mockRejectedValue(new ConflictException('Conflict'));
    await request(app.getHttpServer()).get('/mfe-remotes').expect(409, {
      statusCode: 409,
      message: 'Conflict',
      error: 'Conflict',
      headers: {},
    });
    expect(entries('mfe_remotes_fetch')).toHaveLength(1);
    expect(entries('http_request')).toEqual([
      expect.objectContaining({
        level: 'warn',
        message: containing({ statusCode: 409 }),
      }),
    ]);
  });

  it('does not invent input validation or write routes', async () => {
    await request(app.getHttpServer())
      .get('/mfe-remotes?unknown=value')
      .expect(200, remotes);
    await request(app.getHttpServer())
      .post('/mfe-remotes')
      .send({ unknown: true })
      .expect(404);
    await request(app.getHttpServer()).get('/').expect(404);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('serves quiet liveness without upstream access', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).head('/health').expect(200);
    expect(adapter).not.toHaveBeenCalled();
    expect(entries()).toEqual([]);
  });

  it('keeps async correlation isolated when concurrent upstream completions reverse order', async () => {
    let call = 0;
    adapter.mockImplementation((config) => {
      const delay = call++ === 0 ? 30 : 0;
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              config,
              data: remotes,
              status: 200,
              statusText: 'OK',
              headers: new AxiosHeaders(),
            }),
          delay
        );
      });
    });
    const incoming = '00000000-0000-4000-8000-000000000000';
    const responses = await Promise.all([
      request(app.getHttpServer())
        .get('/mfe-remotes')
        .set('X-Request-ID', incoming),
      request(app.getHttpServer()).get('/mfe-remotes'),
    ]);
    const ids = responses.map(requestId);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain(incoming);
    expect(entries('mfe_remotes_fetch')).toHaveLength(2);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(entries('mfe_remotes_fetch')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: containing({
              requestId: requestId(response),
            }),
          }),
        ])
      );
    }
  });

  it('gives non-HTTP operations their own ID without stale request context', async () => {
    await request(app.getHttpServer()).get('/mfe-remotes').expect(200);
    stdout.mockClear();
    stderr.mockClear();
    const operation = app.get(AppService).getMFERemotes();
    await firstValueFrom(operation);
    expect(entries()).toEqual([
      expect.objectContaining({
        level: 'log',
        context: 'AppService',
        message: {
          event: 'mfe_remotes_fetch',
          outcome: 'success',
          operationId: uuid,
          durationMs: duration,
        },
      }),
    ]);
  });
});

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runInRequestScope } from '../context/request-context';

declare module 'express' {
  interface Request {
    requestId?: string;
    correlationId?: string;
  }
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    const correlation = req.header('x-correlation-id');
    req.requestId = requestId;
    req.correlationId =
      correlation && /^[\w-]{1,64}$/.test(correlation) ? correlation : requestId;
    res.setHeader('x-request-id', requestId);

    // Middleware berjalan SEBELUM autentikasi, sehingga pelakunya belum
    // diketahui di sini. Konteksnya dibuka sekarang dengan bidang yang sudah
    // ada, lalu dilengkapi penjaga JWT begitu tokennya terverifikasi.
    //
    // Membukanya di sini penting: `AsyncLocalStorage` hanya mengikuti alur yang
    // dimulai di dalam `run()`. Membukanya belakangan berarti sebagian
    // permintaan berjalan di luar konteks, dan bidang yang seharusnya terisi
    // sendiri akan kosong lagi — persis keadaan yang hendak diperbaiki.
    runInRequestScope({ requestId, correlationId: req.correlationId }, () => next());
  }
}

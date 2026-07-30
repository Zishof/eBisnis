import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

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
    next();
  }
}

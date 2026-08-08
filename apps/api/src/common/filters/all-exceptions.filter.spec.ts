import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  it('mengembalikan kontrak 429 yang dapat ditindaklanjuti, bukan INTERNAL_ERROR', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', url: '/api/v1/inventory/stock-tree', headers: {}, query: {} }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(
      new HttpException(
        { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
        }),
      }),
    );
  });
});

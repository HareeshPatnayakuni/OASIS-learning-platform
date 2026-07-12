import type { NextFunction, Request, Response } from 'express';
import { requireRole } from '../../../src/middleware/requireRole';

function mockReq(user?: { id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' }): Request {
  return { user } as unknown as Request;
}

describe('requireRole middleware', () => {
  it('calls next() with no error when the user has an allowed role', () => {
    const req = mockReq({ id: 'u1', role: 'TEACHER' });
    const next = jest.fn() as NextFunction;

    requireRole('TEACHER', 'ADMIN')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments = success
  });

  it('calls next(error) with a 403 ApiError when the role is not allowed', () => {
    const req = mockReq({ id: 'u1', role: 'STUDENT' });
    const next = jest.fn() as NextFunction;

    requireRole('TEACHER', 'ADMIN')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'INSUFFICIENT_ROLE' }),
    );
  });

  it('calls next(error) with a 401 ApiError when req.user is missing entirely', () => {
    const req = mockReq(undefined);
    const next = jest.fn() as NextFunction;

    requireRole('TEACHER')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: 'MISSING_TOKEN' }),
    );
  });

  it('allows any of multiple listed roles', () => {
    const next = jest.fn() as NextFunction;
    requireRole('ADMIN', 'SUPER_ADMIN')(mockReq({ id: 'u1', role: 'SUPER_ADMIN' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

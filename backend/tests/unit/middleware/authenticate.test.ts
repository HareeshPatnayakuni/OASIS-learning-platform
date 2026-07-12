import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { authenticate } from '../../../src/middleware/authenticate';
import { signAccessToken } from '../../../src/lib/jwt';
import { env } from '../../../src/config/env';

function mockReq(authHeader?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : undefined),
  } as unknown as Request;
}

describe('authenticate middleware', () => {
  it('attaches req.user and calls next() for a valid token', () => {
    const token = signAccessToken({ sub: 'user-123', role: 'STUDENT' });
    const req = mockReq(`Bearer ${token}`);
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(req.user).toEqual({ id: 'user-123', role: 'STUDENT' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a request with no Authorization header', () => {
    const req = mockReq(undefined);
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'MISSING_TOKEN' }));
  });

  it('rejects a header that is missing the Bearer prefix', () => {
    const token = signAccessToken({ sub: 'user-123', role: 'STUDENT' });
    const req = mockReq(token); // no "Bearer " prefix
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'MISSING_TOKEN' }));
  });

  it('rejects a syntactically invalid token', () => {
    const req = mockReq('Bearer not-a-real-jwt');
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }));
  });

  it('rejects an expired token', () => {
    const expiredToken = jwt.sign({ sub: 'user-123', role: 'STUDENT' }, env.JWT_ACCESS_SECRET, {
      expiresIn: -10, // already expired 10 seconds ago
      issuer: 'oasis-backend',
    });
    const req = mockReq(`Bearer ${expiredToken}`);
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }));
  });

  it('rejects a token signed with the wrong secret', () => {
    const forgedToken = jwt.sign({ sub: 'user-123', role: 'STUDENT' }, 'a-completely-different-secret-value', {
      expiresIn: '15m',
      issuer: 'oasis-backend',
    });
    const req = mockReq(`Bearer ${forgedToken}`);
    const next = jest.fn() as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }));
  });
});

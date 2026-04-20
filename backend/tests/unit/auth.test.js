process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const { signToken, authenticate, authorize } = require('../../middleware/auth');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('signToken', () => {
  it('encodes id, email, role and name into the JWT', () => {
    const user = { id: 1, email: 'a@b.com', role: 'admin', name: 'Alice' };
    const decoded = jwt.verify(signToken(user), 'test-secret');
    expect(decoded).toMatchObject({ id: 1, email: 'a@b.com', role: 'admin', name: 'Alice' });
  });
});

describe('authenticate', () => {
  it('returns 401 when Authorization header is absent', () => {
    const res = mockRes();
    authenticate({ headers: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 401 for a malformed / invalid token', () => {
    const res = mockRes();
    authenticate({ headers: { authorization: 'Bearer not-a-token' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next() and attaches req.user for a valid token', () => {
    const token = signToken({ id: 7, email: 'x@y.com', role: 'staff', name: 'X' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 7, role: 'staff' });
  });
});

describe('authorize', () => {
  it('returns 401 when req.user is missing', () => {
    const res = mockRes();
    authorize('admin')({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when the user role is not in the allowed list', () => {
    const res = mockRes();
    authorize('admin')({ user: { role: 'staff' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() when the user role is allowed', () => {
    const next = jest.fn();
    authorize('admin', 'staff')({ user: { role: 'staff' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

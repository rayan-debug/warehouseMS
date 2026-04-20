process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Mock the database before app loads so routes never touch a real connection
jest.mock('../../config/db', () => ({
  query: jest.fn(),
  pool: null,
}));

const bcrypt = require('bcryptjs');
const request = require('supertest');
const db = require('../../config/db');
const app = require('../../app');

const adminHash = bcrypt.hashSync('Admin@1234', 10);
const adminRow = { id: 1, name: 'Admin User', email: 'admin@warehouse.com', password: adminHash, role: 'admin' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/login', () => {
  it('400 — missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('400 — password missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@warehouse.com' });
    expect(res.status).toBe(400);
  });

  it('401 — user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('401 — wrong password', async () => {
    db.query.mockResolvedValueOnce({ rows: [adminRow] });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@warehouse.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('200 — valid credentials return token and user', async () => {
    db.query.mockResolvedValueOnce({ rows: [adminRow] });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@warehouse.com', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: 'admin@warehouse.com', role: 'admin' });
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    db.query.mockResolvedValueOnce({ rows: [adminRow] });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@warehouse.com', password: 'Admin@1234' });
    token = res.body.token;
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 — malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('200 — returns the authenticated user', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Admin User', email: 'admin@warehouse.com', role: 'admin' }] });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'admin@warehouse.com', role: 'admin' });
  });
});

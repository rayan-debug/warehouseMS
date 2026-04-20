process.env.NODE_ENV = 'test';

const { notFound, errorHandler } = require('../../middleware/errorHandler');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('notFound', () => {
  it('responds 404 and includes the unmatched URL in the message', () => {
    const res = mockRes();
    notFound({ originalUrl: '/api/nope' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('/api/nope'),
    }));
  });
});

describe('errorHandler', () => {
  it('uses err.statusCode when provided', () => {
    const res = mockRes();
    errorHandler({ statusCode: 422, message: 'Unprocessable' }, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Unprocessable',
    }));
  });

  it('falls back to 500 when statusCode is absent', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

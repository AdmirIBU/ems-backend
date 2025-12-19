import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Server Error';
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ error: message });
};

export default errorHandler;

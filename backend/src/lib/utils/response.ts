import { Response } from 'express'

export const send = {
  ok: <T>(res: Response, data: T) =>
    res.json({ success: true, data }),

  created: <T>(res: Response, data: T) =>
    res.status(201).json({ success: true, data }),

  noContent: (res: Response) =>
    res.status(204).send(),

  badRequest: (res: Response, message: string) =>
    res.status(400).json({ success: false, error: message }),

  unauthorized: (res: Response, message = 'Unauthorized') =>
    res.status(401).json({ success: false, error: message }),

  forbidden: (res: Response, message = 'Forbidden') =>
    res.status(403).json({ success: false, error: message }),

  notFound: (res: Response, resource = 'Resource') =>
    res.status(404).json({ success: false, error: `${resource} not found` }),

  conflict: (res: Response, message: string) =>
    res.status(409).json({ success: false, error: message }),

  serverError: (res: Response, err: unknown) => {
    console.error('[ServerError]', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  },
}

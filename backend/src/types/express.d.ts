import { Org } from './index'

// Extend Express Request to carry the authenticated org on every protected route
declare global {
  namespace Express {
    interface Request {
      org?: Org
    }
  }
}

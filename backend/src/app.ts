import express from 'express'
import cors from 'cors'

import { orgsRouter } from './routes/orgs'
import { electionsRouter } from './routes/elections'
import { positionsRouter } from './routes/positions'
import { candidatesRouter } from './routes/candidates'
import { votersRouter } from './routes/voters'
import { votingRouter } from './routes/voting'
import { publicRouter } from './routes/public'
import { resultsRouter } from './routes/results'
import { uploadsRouter } from './routes/uploads'

export const app = express()

app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'] }))
app.use(express.json({ limit: '5mb' }))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/orgs', orgsRouter)
app.use('/elections', electionsRouter)

// Positions and candidates are nested under elections with mergeParams
app.use('/elections/:electionId/positions', positionsRouter)
app.use('/elections/:electionId/positions/:positionId/candidates', candidatesRouter)
app.use('/elections/:electionId/voters', votersRouter)

app.use('/uploads', uploadsRouter)
app.use('/vote', votingRouter)
app.use('/public', publicRouter)
app.use('/results', resultsRouter)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }))

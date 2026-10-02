import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Limit, Output, Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, {
  fiveHour: null,
  sevenDay: null,
  costUsd: null,
} as Usage)
const output = atom({ plugin: 'usage-band', key: 'output' } as const, { session: 0, lastTurn: 0, input: 0 } as Output)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)
// Each session writes its own total under `cost:<startedAt>` in $.store, so the
// today/month sums never count a cost twice, whatever runs in parallel.
const COST_PREFIX = 'cost:'
const KEEP_DAYS = 62

type SessionCost = { day: string; usd: number }

let sessionKey: string | null = null

const toLimit = (limits: SessionRateLimit[], kind: string): Limit | null => {
  const limit = limits.find(l => l.kind === kind)
  return limit ? { percent: limit.percentUsed, resetsAt: limit.resetsAt } : null
}

const dayKey = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const untilReset = (resetsAt: string | undefined, at: number) => {
  if (!resetsAt) return ''
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - at) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d${hours}h`
  return hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
}

const tokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`

const usd = (n: number) => `$${n.toFixed(2)}`

const levelColor = (percent: number) => (percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green')

// A pie that fills with the percentage, like the app's own ring.
const pie = (percent: number) => (percent >= 88 ? '●' : percent >= 63 ? '◕' : percent >= 38 ? '◑' : percent >= 13 ? '◔' : '○')

async function sync($: EngineInterface, rateLimits: SessionRateLimit[], costUsd: number | undefined) {
  const at = await $.clock.now()
  const today = dayKey(at)
  const month = today.slice(0, 7)
  const oldest = dayKey(at - KEEP_DAYS * 86_400_000)

  if (sessionKey !== null && costUsd !== undefined) {
    const mine: SessionCost = { day: today, usd: costUsd }
    await $.store.set(sessionKey, mine)
  }

  let todayUsd = 0
  let monthUsd = 0
  for (const key of await $.store.keys()) {
    if (!key.startsWith(COST_PREFIX)) continue
    const entry = (await $.store.get(key)) as SessionCost | undefined
    if (!entry) continue
    if (entry.day < oldest) {
      await $.store.delete(key)
      continue
    }
    if (entry.day === today) todayUsd += entry.usd
    if (entry.day.startsWith(month)) monthUsd += entry.usd
  }

  const fresh: Usage = {
    fiveHour: toLimit(rateLimits, 'five_hour'),
    sevenDay: toLimit(rateLimits, 'seven_day'),
    costUsd: costUsd ?? null,
    todayUsd,
    monthUsd,
  }
  await update($, usage, () => fresh)
  await update($, now, () => at)
  return { fresh, at }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'usage-debug',
      description: 'Affiche la ligne du bandeau (limites, coût, tokens) : utile en session cloud, où le bandeau ne s’affiche pas',
    })
    const first = await $.session.usage()
    sessionKey = `${COST_PREFIX}${first.startedAt}`
    // The first version's shared ledger double-counted; it is replaced by per-session entries.
    await $.store.delete('daily-usd')
    await sync($, first.rateLimits, first.cost?.usd)
    $.clock.every(60_000, async () => {
      const current = await $.session.usage()
      await sync($, current.rateLimits, current.cost?.usd)
    })
    return result
  })

  on('command.run', { command: 'usage-debug' }, async $ => {
    const current = await $.session.usage()
    // Reads in one dispatch see one moment, so use what sync computed rather than reading it back.
    const { fresh: u, at } = await sync($, current.rateLimits, current.cost?.usd)
    const o = await read($, output)

    const limit = (label: string, l: Limit | null) => {
      if (l === null) return `– ${label}`
      const reset = untilReset(l.resetsAt, at)
      return `${pie(l.percent)} ${Math.round(l.percent)}% ${label}${reset !== '' ? ` · resets ${reset}` : ''}`
    }

    const line = [
      limit('5h', u.fiveHour),
      limit('7d', u.sevenDay),
      `$ ${usd(u.costUsd ?? 0)} session · ${usd(u.todayUsd ?? 0)} today · ${usd(u.monthUsd ?? 0)} mo`,
      `⇅ ${tokens((o.input ?? 0) + o.session)} tokens · ${tokens(o.session)} out`,
    ].join('     ')

    return { text: line }
  })

  on('session.measure', async ($, e, next) => {
    await sync($, e.rateLimits, e.cost?.usd)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && e.usage) {
      const out = e.usage.output_tokens
      const inp = e.usage.input_tokens + e.usage.cache_creation_input_tokens + e.usage.cache_read_input_tokens
      await update($, output, o => ({ session: o.session + out, lastTurn: out, input: (o.input ?? 0) + inp }))
    }
    const result = await next(e)
    const current = await $.session.usage()
    await sync($, current.rateLimits, current.cost?.usd)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const u = await read($, usage)
    const o = await read($, output)
    const at = await read($, now)
    const { Box, Text } = $.ui.resolve(e)

    const limit = (label: string, l: Limit | null) => {
      if (l === null) {
        return (
          <Text>
            <Text dimColor>○ </Text>
            <Text bold>–</Text>
            <Text dimColor> {label}</Text>
          </Text>
        )
      }
      const reset = untilReset(l.resetsAt, at)
      return (
        <Text>
          <Text color={levelColor(l.percent)}>{pie(l.percent)} </Text>
          <Text bold>{Math.round(l.percent)}%</Text>
          <Text dimColor>
            {' '}
            {label}
            {reset !== '' && ` · resets ${reset}`}
          </Text>
        </Text>
      )
    }

    return (
      <Box flexDirection="row" columnGap={5} paddingX={1}>
        {limit('5h', u.fiveHour)}
        {limit('7d', u.sevenDay)}
        <Text>
          <Text color="green">$ </Text>
          <Text color="green" bold>
            {usd(u.costUsd ?? 0)}
          </Text>
          <Text dimColor>
            {'  '}
            {usd(u.todayUsd ?? 0)} today{'  '}
            {usd(u.monthUsd ?? 0)} mo
          </Text>
        </Text>
        <Text>
          <Text color="cyan">⇅ </Text>
          <Text bold>{tokens((o.input ?? 0) + o.session)}</Text>
          <Text dimColor> tokens · {tokens(o.session)} out</Text>
        </Text>
      </Box>
    )
  })
}

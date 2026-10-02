export type Limit = { percent: number; resetsAt?: string }
export type Usage = {
  fiveHour: Limit | null
  sevenDay: Limit | null
  costUsd: number | null
  todayUsd?: number
  monthUsd?: number
}
export type Output = { session: number; lastTurn: number; input?: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { usage: Usage; output: Output; now: number }
  }
}

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTelemetryState,
  getTelemetryServerSnapshot,
  subscribeTelemetry,
  addWebVital,
  addNetworkRecord,
  addEventTimingRecord,
  addErrorRecord,
  addTraceRun,
} from '@/lib/telemetry-store-core'
import type {
  VitalRecord,
  NetworkRecord,
  EventTimingRecord,
  ErrorRecord,
  TraceRunRecord,
} from '@/lib/telemetry-store-core'

function makeVital(overrides: Partial<VitalRecord> = {}): VitalRecord {
  return { id: 'v1', name: 'LCP', value: 1200, delta: 0, rating: 'good', navigationType: 'navigate', path: '/', capturedAt: '', ...overrides }
}

function makeNetwork(overrides: Partial<NetworkRecord> = {}): NetworkRecord {
  return { id: 'n1', kind: 'resource', name: '/api', initiatorType: 'fetch', duration: 50, redirectMs: 0, dnsLookupMs: 0, tcpHandshakeMs: 0, tlsNegotiationMs: 0, serviceWorkerMs: 0, requestStartGapMs: 0, ttfbMs: 0, responseDownloadMs: 0, transferSizeKb: 0, encodedBodySizeKb: 0, decodedBodySizeKb: 0, nextHopProtocol: 'h2', deliveryType: 'network', serverTiming: [], path: '/', capturedAt: '', ...overrides }
}

function makeEvent(overrides: Partial<EventTimingRecord> = {}): EventTimingRecord {
  return { id: 'e1', name: 'click', duration: 10, inputDelayMs: 2, handlerDurationMs: 5, presentationDelayMs: 3, interactionId: 1, path: '/', capturedAt: '', ...overrides }
}

function makeError(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return { id: 'err1', kind: 'unhandled', message: 'boom', path: '/', capturedAt: '', ...overrides }
}

function makeTrace(overrides: Partial<TraceRunRecord> = {}): TraceRunRecord {
  return { id: 't1', traceId: 'abc123', httpStatus: 200, propagationState: 'matched', childSpans: [], path: '/', capturedAt: '', ...overrides }
}

describe('getTelemetryServerSnapshot', () => {
  it('returns empty state', () => {
    const snap = getTelemetryServerSnapshot()
    expect(snap.vitals).toHaveLength(0)
    expect(snap.network).toHaveLength(0)
    expect(snap.events).toHaveLength(0)
    expect(snap.errors).toHaveLength(0)
    expect(snap.traces).toHaveLength(0)
  })
})

describe('addWebVital', () => {
  it('prepends a vital record', () => {
    addWebVital(makeVital({ id: 'lcp-1' }))
    const state = getTelemetryState()
    expect(state.vitals[0].id).toBe('lcp-1')
  })

  it('deduplicates by id', () => {
    addWebVital(makeVital({ id: 'lcp-dup' }))
    addWebVital(makeVital({ id: 'lcp-dup', value: 999 }))
    const state = getTelemetryState()
    const matches = state.vitals.filter((v) => v.id === 'lcp-dup')
    expect(matches).toHaveLength(1)
    expect(matches[0].value).toBe(999)
  })
})

describe('addNetworkRecord', () => {
  it('prepends a network record', () => {
    addNetworkRecord(makeNetwork({ id: 'net-1' }))
    const state = getTelemetryState()
    expect(state.network[0].id).toBe('net-1')
  })
})

describe('addEventTimingRecord', () => {
  it('prepends an event timing record', () => {
    addEventTimingRecord(makeEvent({ id: 'evt-1' }))
    const state = getTelemetryState()
    expect(state.events[0].id).toBe('evt-1')
  })
})

describe('addErrorRecord', () => {
  it('prepends an error record', () => {
    addErrorRecord(makeError({ id: 'err-x' }))
    const state = getTelemetryState()
    expect(state.errors[0].id).toBe('err-x')
  })
})

describe('addTraceRun', () => {
  it('prepends a trace run', () => {
    addTraceRun(makeTrace({ id: 'trace-1' }))
    const state = getTelemetryState()
    expect(state.traces[0].id).toBe('trace-1')
  })
})

describe('subscribeTelemetry', () => {
  it('calls listener on state change', () => {
    let called = 0
    const unsub = subscribeTelemetry(() => { called++ })
    addWebVital(makeVital({ id: `listener-test-${Date.now()}` }))
    expect(called).toBe(1)
    unsub()
  })

  it('stops calling listener after unsubscribe', () => {
    let called = 0
    const unsub = subscribeTelemetry(() => { called++ })
    unsub()
    addWebVital(makeVital({ id: `unsub-test-${Date.now()}` }))
    expect(called).toBe(0)
  })
})

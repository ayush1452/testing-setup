import { describe, it, expect } from 'vitest'
import {
  formatMilliseconds,
  formatKilobytes,
  formatVitalValue,
  isSyntheticProbe,
  isServiceWorkerProbe,
  navigationToRecord,
  resourceToRecord,
  networkMeasurementValues,
  eventTimingToRecord,
} from '@/lib/performance'
import type { NetworkRecord } from '@/lib/telemetry-store-core'

function makeNetworkRecord(overrides: Partial<NetworkRecord> = {}): NetworkRecord {
  return {
    id: 'test:1',
    kind: 'resource',
    name: '/some/path',
    initiatorType: 'fetch',
    duration: 100,
    redirectMs: 0,
    dnsLookupMs: 0,
    tcpHandshakeMs: 0,
    tlsNegotiationMs: 0,
    serviceWorkerMs: 0,
    requestStartGapMs: 0,
    ttfbMs: 0,
    responseDownloadMs: 0,
    transferSizeKb: 0,
    encodedBodySizeKb: 0,
    decodedBodySizeKb: 0,
    nextHopProtocol: 'h2',
    deliveryType: 'network',
    serverTiming: [],
    path: '/',
    capturedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('formatMilliseconds', () => {
  it('formats whole numbers', () => {
    expect(formatMilliseconds(200)).toBe('200 ms')
  })

  it('rounds decimal values', () => {
    expect(formatMilliseconds(123.7)).toBe('124 ms')
  })

  it('handles zero', () => {
    expect(formatMilliseconds(0)).toBe('0 ms')
  })
})

describe('formatKilobytes', () => {
  it('formats to one decimal place', () => {
    expect(formatKilobytes(1.5)).toBe('1.5 KB')
  })

  it('formats whole kilobytes', () => {
    expect(formatKilobytes(10)).toBe('10.0 KB')
  })
})

describe('formatVitalValue', () => {
  it('formats CLS with 3 decimal places', () => {
    expect(formatVitalValue('CLS', 0.1234)).toBe('0.123')
  })

  it('formats time-based vitals as milliseconds', () => {
    expect(formatVitalValue('LCP', 1500)).toBe('1500 ms')
    expect(formatVitalValue('FID', 80)).toBe('80 ms')
  })
})

describe('isSyntheticProbe', () => {
  it('returns true for telemetry API records', () => {
    const record = makeNetworkRecord({ name: '/api/telemetry?probe=1' })
    expect(isSyntheticProbe(record)).toBe(true)
  })

  it('returns false for regular records', () => {
    const record = makeNetworkRecord({ name: '/api/data' })
    expect(isSyntheticProbe(record)).toBe(false)
  })
})

describe('isServiceWorkerProbe', () => {
  it('returns true for service worker probe records', () => {
    const record = makeNetworkRecord({ name: '/api/telemetry?via=service-worker' })
    expect(isServiceWorkerProbe(record)).toBe(true)
  })

  it('returns false for regular records', () => {
    const record = makeNetworkRecord({ name: '/api/data' })
    expect(isServiceWorkerProbe(record)).toBe(false)
  })
})

function makeTimingEntry(overrides: Record<string, unknown> = {}): PerformanceResourceTiming {
  return {
    name: 'https://example.com/script.js',
    entryType: 'resource',
    startTime: 0,
    duration: 120,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 10,
    domainLookupStart: 10,
    domainLookupEnd: 20,
    connectStart: 20,
    connectEnd: 30,
    secureConnectionStart: 0,
    requestStart: 35,
    responseStart: 80,
    responseEnd: 120,
    transferSize: 2048,
    encodedBodySize: 2000,
    decodedBodySize: 4096,
    workerStart: 0,
    serverTiming: [],
    toJSON: () => ({}),
    ...overrides,
  } as unknown as PerformanceResourceTiming
}

describe('resourceToRecord', () => {
  it('creates a resource record from a PerformanceResourceTiming entry', () => {
    const entry = makeTimingEntry()
    const record = resourceToRecord(entry, '/')
    expect(record.kind).toBe('resource')
    expect(record.initiatorType).toBe('script')
    expect(record.duration).toBe(120)
    expect(record.nextHopProtocol).toBe('h2')
    expect(record.path).toBe('/')
  })

  it('shortens the name to pathname+search', () => {
    const entry = makeTimingEntry({ name: 'https://example.com/api/data?q=1' })
    const record = resourceToRecord(entry, '/page')
    expect(record.name).toBe('/api/data?q=1')
  })

  it('keeps name as-is when it is not a valid URL', () => {
    const entry = makeTimingEntry({ name: 'not-a-url' })
    const record = resourceToRecord(entry, '/')
    expect(record.name).toBe('not-a-url')
  })

  it('uses transferSize converted to kb', () => {
    const entry = makeTimingEntry({ transferSize: 1024 })
    const record = resourceToRecord(entry, '/')
    expect(record.transferSizeKb).toBe(1)
  })

  it('returns zero for transferSizeKb when transferSize is zero', () => {
    const entry = makeTimingEntry({ transferSize: 0 })
    const record = resourceToRecord(entry, '/')
    expect(record.transferSizeKb).toBe(0)
  })

  it('calculates tlsNegotiationMs when secureConnectionStart is set', () => {
    const entry = makeTimingEntry({ secureConnectionStart: 25, connectEnd: 30 })
    const record = resourceToRecord(entry, '/')
    expect(record.tlsNegotiationMs).toBe(5)
  })

  it('calculates serviceWorkerMs when workerStart is set', () => {
    const entry = makeTimingEntry({ workerStart: 5, fetchStart: 10 })
    const record = resourceToRecord(entry, '/')
    expect(record.serviceWorkerMs).toBe(5)
  })

  it('uses "other" as fallback for missing initiatorType', () => {
    const entry = makeTimingEntry({ initiatorType: '' })
    const record = resourceToRecord(entry, '/')
    expect(record.initiatorType).toBe('other')
  })

  it('falls back to network when deliveryType is missing', () => {
    const entry = makeTimingEntry()
    const record = resourceToRecord(entry, '/')
    expect(record.deliveryType).toBe('network')
  })

  it('returns zero redirectMs when redirectEnd is before redirectStart', () => {
    const entry = makeTimingEntry({ redirectStart: 100, redirectEnd: 0 })
    const record = resourceToRecord(entry, '/')
    expect(record.redirectMs).toBe(0)
  })

  it('formats serverTiming entries correctly', () => {
    const entry = makeTimingEntry({
      serverTiming: [
        { name: 'cache', duration: 0 },
        { name: 'db', duration: 12.345 },
      ]
    })
    const record = resourceToRecord(entry, '/')
    expect(record.serverTiming).toEqual(['cache', 'db:12.35ms'])
  })
})

describe('navigationToRecord', () => {
  it('creates a navigation record', () => {
    const entry = makeTimingEntry({ entryType: 'navigation' }) as unknown as PerformanceNavigationTiming
    const record = navigationToRecord(entry, '/home')
    expect(record.kind).toBe('navigation')
    expect(record.path).toBe('/home')
  })
})

describe('networkMeasurementValues', () => {
  it('maps NetworkRecord fields to measurement keys', () => {
    const record = makeNetworkRecord({ duration: 100, ttfbMs: 50, transferSizeKb: 2 })
    const values = networkMeasurementValues(record)
    expect(values.duration_ms).toBe(100)
    expect(values.ttfb_ms).toBe(50)
    expect(values.transfer_kb).toBe(2)
  })
})

describe('eventTimingToRecord', () => {
  it('creates an event timing record', () => {
    const entry = {
      name: 'click',
      entryType: 'event',
      startTime: 100,
      duration: 20,
      processingStart: 104,
      processingEnd: 112,
      interactionId: 5,
      toJSON: () => ({}),
    }
    const record = eventTimingToRecord(entry as PerformanceEntry & { processingStart: number; processingEnd: number; interactionId: number }, '/page')
    expect(record.name).toBe('click')
    expect(record.duration).toBe(20)
    expect(record.inputDelayMs).toBe(4)
    expect(record.path).toBe('/page')
    expect(record.interactionId).toBe(5)
  })
})

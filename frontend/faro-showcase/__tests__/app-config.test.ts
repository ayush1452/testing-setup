import { describe, it, expect } from 'vitest'
import { sectionFromPath, appConfig, navItems } from '@/lib/app-config'

describe('sectionFromPath', () => {
  it('returns overview for root path', () => {
    expect(sectionFromPath('/')).toBe('overview')
  })

  it('returns the first path segment', () => {
    expect(sectionFromPath('/web-vitals')).toBe('web-vitals')
    expect(sectionFromPath('/js-errors')).toBe('js-errors')
    expect(sectionFromPath('/http-lab')).toBe('http-lab')
  })

  it('returns only the first segment for nested paths', () => {
    expect(sectionFromPath('/journeys/detail')).toBe('journeys')
  })

  it('falls back to overview for empty segment', () => {
    expect(sectionFromPath('')).toBe('overview')
  })
})

describe('appConfig', () => {
  it('has the correct app name', () => {
    expect(appConfig.name).toBe('faro-showcase')
  })

  it('defaults collectorUrl to /collect', () => {
    expect(appConfig.collectorUrl).toBe('/collect')
  })
})

describe('navItems', () => {
  it('contains an entry for the root path', () => {
    const root = navItems.find((item) => item.href === '/')
    expect(root).toBeDefined()
    expect(root?.label).toBe('Overview')
  })

  it('has unique step values', () => {
    const steps = navItems.map((item) => item.step)
    expect(new Set(steps).size).toBe(steps.length)
  })
})

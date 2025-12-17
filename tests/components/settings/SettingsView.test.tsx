import { render, screen } from '@testing-library/react'
import SettingsView from '@/components/settings/SettingsView'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('wagmi', () => ({
  useChainId: () => 31,
}))

vi.mock('@/hooks/useNetworkConfig', () => ({
  useNetworkConfig: () => ({
    config: {
      enabled: false,
      rpcUrl: '',
      rpcChainId: null,
      updatedAtMs: 0,
    },
    hasCustomRpc: false,
    setEnabled: vi.fn(),
    saveRpc: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/hooks/useABIManager', () => ({
  useABIManager: () => ({
    entries: [],
    upsert: vi.fn(),
    remove: vi.fn(),
    clearAll: vi.fn(),
    exportAll: () => [],
  }),
}))

describe('SettingsView', () => {
  it('renders the main heading', () => {
    render(<SettingsView />)
    const heading = screen.getByText('Configuration')
    expect(heading).toBeInTheDocument()
  })
})

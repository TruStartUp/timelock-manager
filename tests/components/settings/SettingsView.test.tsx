import { render, screen } from '@testing-library/react'
import SettingsView from '@/components/settings/SettingsView'
import '@testing-library/jest-dom'

describe('SettingsView', () => {
  it('renders the main heading', () => {
    render(<SettingsView />)
    const heading = screen.getByText('Configuration')
    expect(heading).toBeInTheDocument()
  })
})

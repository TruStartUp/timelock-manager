import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import DashboardView from '@/components/dashboard/DashboardView';
import React from 'react';

describe('DashboardView', () => {
  test('renders dashboard elements correctly', () => {
    render(<DashboardView />);

    // Check for the "Timelock Contract" label and select
    expect(screen.getByLabelText(/Timelock Contract/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Timelock Contract/i })).toBeInTheDocument();

    // Check for network status
    expect(screen.getByText(/Connected to:/i)).toBeInTheDocument();
    expect(screen.getByText(/Rootstock Mainnet/i)).toBeInTheDocument();

    // Check for "Operations Overview" section
    expect(screen.getByRole('heading', { name: /Operations Overview/i })).toBeInTheDocument();
    expect(screen.getByText(/Pending Operations/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready for Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/Executed Operations/i)).toBeInTheDocument();

    // Check for "Access Manager Roles" section
    expect(screen.getByRole('heading', { name: /Access Manager Roles/i })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/PROPOSER_ROLE/i)).toBeInTheDocument();
    expect(screen.getByText(/EXECUTOR_ROLE/i)).toBeInTheDocument();
  });
});

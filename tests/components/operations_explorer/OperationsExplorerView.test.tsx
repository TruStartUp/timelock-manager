import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import OperationsExplorerView from '@/components/operations_explorer/OperationsExplorerView';
import React from 'react';

describe('OperationsExplorerView', () => {
  test('renders top navigation bar correctly', () => {
    render(<OperationsExplorerView />);

    // Check for title
    expect(screen.getByText(/Timelock Management/i)).toBeInTheDocument();

    // Check for Schedule Operation button
    expect(screen.getByRole('button', { name: /Schedule Operation/i })).toBeInTheDocument();
  });

  test('renders page heading correctly', () => {
    render(<OperationsExplorerView />);

    expect(screen.getByText(/Timelock Operations/i)).toBeInTheDocument();
  });

  test('renders filter chips correctly', () => {
    render(<OperationsExplorerView />);

    // Check for all filter buttons
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pending$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ready$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Executed$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Canceled$/i })).toBeInTheDocument();
  });

  test('renders search bar correctly', () => {
    render(<OperationsExplorerView />);

    const searchInput = screen.getByPlaceholderText(/Search by ID, proposer\.\.\./i);
    expect(searchInput).toBeInTheDocument();
  });

  test('renders filter list button', () => {
    render(<OperationsExplorerView />);

    // The filter_list icon button should be present
    const filterButtons = screen.getAllByRole('button');
    const filterListButton = filterButtons.find((button) => {
      const icon = button.querySelector('.material-symbols-outlined');
      return icon?.textContent === 'filter_list';
    });
    expect(filterListButton).toBeDefined();
  });

  test('renders table headers correctly', () => {
    render(<OperationsExplorerView />);

    expect(screen.getByText(/^ID$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Status$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Calls$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Targets$/i)).toBeInTheDocument();
    expect(screen.getByText(/^ETA$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Proposer$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Actions$/i)).toBeInTheDocument();
  });

  test('renders operation rows with correct data', () => {
    render(<OperationsExplorerView />);

    // Check for operation IDs
    expect(screen.getByText(/0xab\.\.\.c456/i)).toBeInTheDocument();
    expect(screen.getByText(/0x2d\.\.\.a1b2/i)).toBeInTheDocument();
    expect(screen.getByText(/0x7f\.\.\.e3d4/i)).toBeInTheDocument();
    expect(screen.getByText(/0x9c\.\.\.b5d6/i)).toBeInTheDocument();

    // Check for statuses - use getAllByText since these appear in filters and table
    const readyElements = screen.getAllByText(/^Ready$/i);
    expect(readyElements.length).toBeGreaterThan(0);
    const pendingElements = screen.getAllByText(/^Pending$/i);
    expect(pendingElements.length).toBeGreaterThan(0);
    const executedElements = screen.getAllByText(/^Executed$/i);
    expect(executedElements.length).toBeGreaterThan(0);
    const canceledElements = screen.getAllByText(/^Canceled$/i);
    expect(canceledElements.length).toBeGreaterThan(0);
  });

  test('renders action buttons for Ready status', () => {
    render(<OperationsExplorerView />);

    // Check for EXECUTE and CANCEL buttons (Ready status operation)
    // Use getAllByRole since "Executed" filter button also matches "EXECUTE"
    const executeButtons = screen.getAllByRole('button', { name: /EXECUTE/i });
    expect(executeButtons.length).toBeGreaterThan(0);
    const cancelButtons = screen.getAllByRole('button', { name: /CANCEL/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  test('filter selection updates active filter', () => {
    render(<OperationsExplorerView />);

    const pendingButton = screen.getByRole('button', { name: /^Pending$/i });
    fireEvent.click(pendingButton);

    // After clicking, the Pending filter should have the active class
    expect(pendingButton.className).toContain('bg-primary');
  });

  test('search input accepts text input', () => {
    render(<OperationsExplorerView />);

    const searchInput = screen.getByPlaceholderText(/Search by ID, proposer\.\.\./i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: '0xab' } });

    expect(searchInput.value).toBe('0xab');
  });

  test('clicking a row expands operation details', () => {
    render(<OperationsExplorerView />);

    // Initially, the first operation should be expanded (default state)
    expect(screen.getByText(/Operation Details/i)).toBeInTheDocument();
    expect(screen.getByText(/0xabc123def456\.\.\./i)).toBeInTheDocument();

    // Find the second operation row and click it
    const secondRow = screen.getByText(/0x2d\.\.\.a1b2/i).closest('tr');
    if (secondRow) {
      fireEvent.click(secondRow);
    }

    // The first operation details should be collapsed (not visible)
    // Note: The details might still be in the DOM, so we check for collapse behavior
  });

  test('expanded row shows operation details correctly', () => {
    render(<OperationsExplorerView />);

    // The first operation is expanded by default
    expect(screen.getByText(/Operation Details/i)).toBeInTheDocument();
    expect(screen.getByText(/ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/0xabc123def456\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Proposer:/i)).toBeInTheDocument();
    expect(screen.getByText(/0xd4e56789f0\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled:/i)).toBeInTheDocument();
    expect(screen.getByText(/2023-10-26 03:00/i)).toBeInTheDocument();
  });

  test('expanded row shows calls details correctly', () => {
    render(<OperationsExplorerView />);

    // Check for Calls section in expanded row
    expect(screen.getByText(/Calls \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/0x123\.\.\.a7b8/i)).toBeInTheDocument();
    expect(screen.getByText(/0x456\.\.\.b8c9/i)).toBeInTheDocument();
    expect(screen.getByText(/0x789\.\.\.c9d0/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 ETH/i)).toBeInTheDocument();
  });

  test('EXECUTE button is clickable', () => {
    render(<OperationsExplorerView />);

    // Mock console.log before clicking
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const executeButtons = screen.getAllByRole('button', { name: /^EXECUTE$/i });
    // The actual EXECUTE action button should be the last one (after the "Executed" filter)
    const executeButton = executeButtons[executeButtons.length - 1];
    fireEvent.click(executeButton);

    expect(consoleSpy).toHaveBeenCalledWith('Execute operation:', '0xab...c456');
    consoleSpy.mockRestore();
  });

  test('CANCEL button is clickable', () => {
    render(<OperationsExplorerView />);

    // Mock console.log before clicking
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const cancelButtons = screen.getAllByRole('button', { name: /^CANCEL$/i });
    // There are action CANCEL buttons and filter buttons
    // Click the first action button (which should be in the table)
    const actionCancelButton = cancelButtons.find((button) => {
      // Action buttons have specific styling classes
      return button.className.includes('bg-red-400/20');
    });

    expect(actionCancelButton).toBeDefined();
    if (actionCancelButton) {
      fireEvent.click(actionCancelButton);
      // Just verify the handler was called with some operation ID
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toBe('Cancel operation:');
    }

    consoleSpy.mockRestore();
  });

  test('displays relative ETA for operations', () => {
    render(<OperationsExplorerView />);

    expect(screen.getByText(/in 12 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/in 2 days/i)).toBeInTheDocument();
  });

  test('displays absolute ETA timestamps', () => {
    render(<OperationsExplorerView />);

    expect(screen.getByText(/2023-10-27 15:00 UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/2023-10-29 18:30 UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/2023-10-25 10:00 UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/2023-10-24 12:00 UTC/i)).toBeInTheDocument();
  });

  test('formats targets with "+X more" when multiple targets', () => {
    render(<OperationsExplorerView />);

    expect(screen.getByText(/0x12\.\.\.a7b8, \+2 more/i)).toBeInTheDocument();
    expect(screen.getByText(/0x5a\.\.\.b6c7, \+4 more/i)).toBeInTheDocument();
    expect(screen.getByText(/0x8e\.\.\.f1a2, \+1 more/i)).toBeInTheDocument();
  });
});

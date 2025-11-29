import { render, screen } from '@testing-library/react';
import PermissionsView from '@/components/permissions/PermissionsView';
import '@testing-library/jest-dom';

describe('PermissionsView', () => {
  it('renders the main heading', () => {
    render(<PermissionsView />);
    const heading = screen.getByText('All Roles');
    expect(heading).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import Layout from '@/components/common/Layout';
import React from 'react';

describe('Layout', () => {
  test('renders header, footer and children correctly', () => {
    render(
      <Layout>
        <h1>Test Child Content</h1>
      </Layout>
    );

    // Check if header content is present
    expect(screen.getByText('Rootstock Timelock Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule New Operation/i })).toBeInTheDocument();

    // Check if children content is present
    expect(screen.getByRole('heading', { name: /Test Child Content/i })).toBeInTheDocument();

    // Check if footer content is present
    expect(screen.getByText(/© 2024 Rootstock. All rights reserved./i)).toBeInTheDocument();
  });
});

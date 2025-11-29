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
    expect(screen.getByText('Rootstock')).toBeInTheDocument();
    expect(screen.getByText('Timelock Management')).toBeInTheDocument();

    // Check if children content is present
    expect(
      screen.getByRole('heading', { name: /Test Child Content/i })
    ).toBeInTheDocument();
  });
});

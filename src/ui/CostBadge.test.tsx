import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostBadge from './CostBadge';

describe('CostBadge', () => {
  it('renders a green cost with the GreenRupee icon when green > 0', () => {
    const { container } = render(<CostBadge green={4} />);
    const badge = screen.getByTestId('cost-badge-green');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('4');

    // GreenRupee svg is labeled 'green-shard' by default.
    const greenSvg = container.querySelector('svg[aria-label="green-shard"]');
    expect(greenSvg).not.toBeNull();
  });

  it('omits a resource that is zero or undefined', () => {
    render(<CostBadge green={3} />);
    expect(screen.queryByTestId('cost-badge-red')).toBeNull();
    expect(screen.queryByTestId('cost-badge-keys')).toBeNull();
  });

  it('renders nothing (null) when every cost is zero', () => {
    const { container } = render(<CostBadge green={0} red={0} keys={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple resource badges side by side', () => {
    const { container } = render(<CostBadge green={2} red={1} keys={3} />);
    expect(screen.getByTestId('cost-badge-green')).toHaveTextContent('2');
    expect(screen.getByTestId('cost-badge-red')).toHaveTextContent('1');
    expect(screen.getByTestId('cost-badge-keys')).toHaveTextContent('3');
    expect(container.querySelectorAll('svg').length).toBe(3);
  });
});

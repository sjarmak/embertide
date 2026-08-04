import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { applyHCFlagMock, createRootMock, renderMock, resolveHCFlagMock } = vi.hoisted(() => ({
  applyHCFlagMock: vi.fn(),
  createRootMock: vi.fn(),
  renderMock: vi.fn(),
  resolveHCFlagMock: vi.fn(() => 'on' as const),
}));

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock.mockReturnValue({ render: renderMock }),
}));

vi.mock('./App', () => ({ default: () => null }));

vi.mock('./hc/flag', () => ({
  applyHCFlag: applyHCFlagMock,
  resolveHCFlag: resolveHCFlagMock,
}));

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resolveHCFlagMock.mockReturnValue('on');
    createRootMock.mockReturnValue({ render: renderMock });
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies the HC flag before mounting the application', async () => {
    const root = document.getElementById('root');

    await import('./main');

    expect(resolveHCFlagMock).toHaveBeenCalledWith({
      search: '',
      storage: window.localStorage,
      env: 'test',
    });
    expect(applyHCFlagMock).toHaveBeenCalledWith('on');
    expect(createRootMock).toHaveBeenCalledWith(root);
    expect(renderMock).toHaveBeenCalledOnce();
    expect(applyHCFlagMock.mock.invocationCallOrder[0]).toBeLessThan(
      createRootMock.mock.invocationCallOrder[0],
    );
  });

  it('mounts with a null storage fallback when localStorage access is blocked', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    });

    await import('./main');

    expect(resolveHCFlagMock).toHaveBeenCalledWith({
      search: '',
      storage: null,
      env: 'test',
    });
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledOnce();
  });

  it('throws after applying the flag when the root element is missing', async () => {
    document.body.innerHTML = '';

    await expect(import('./main')).rejects.toThrow('Root element #root not found in index.html');

    expect(applyHCFlagMock).toHaveBeenCalledWith('on');
    expect(createRootMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });
});

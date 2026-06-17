import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../app/FileMenu', () => ({ default: () => <div>FileMenu</div> }));
vi.mock('../components/BinderTree', () => ({ default: () => <div>BinderTree</div> }));
vi.mock('../app/TemplateTree', () => ({ default: () => <div>TemplateTree</div> }));
vi.mock('../../bindings/main/window', () => ({
  OpenSearchWindow: vi.fn(),
}));
vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => Promise.resolve({})),
}));

import Menu from '../app/Menu';

describe('Menu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMenu, () => {});
    evt.register('test', Event.ToggleSidebar, () => {});
    evt.register('test', Event.ReloadTitle, () => {});
    evt.register('test', Event.ReloadBinderTitle, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});

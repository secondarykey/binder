import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../components/BinderRegister', () => ({ default: () => <div>Register</div> }));
vi.mock('../components/BinderRemote', () => ({ default: () => <div>Remote</div> }));
vi.mock('../components/BinderHistory', () => ({ default: () => <div>History</div> }));
vi.mock('../components/editor/Component', () => ({ default: () => <div>Editor</div> }));
vi.mock('../components/AssetViewer', () => ({ default: () => <div>Asset</div> }));
vi.mock('../components/LayerEditor', () => ({ default: () => <div>Layer</div> }));
vi.mock('../pages/History', () => ({ default: () => <div>HistoryPage</div> }));

import Content from '../app/Content';

describe('Content', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <Content />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});

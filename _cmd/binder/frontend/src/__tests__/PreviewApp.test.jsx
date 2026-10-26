import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Events } from '@wailsio/runtime';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetPreviewScrollbar: vi.fn(() => Promise.resolve(true)),
  IsBinderTrusted: vi.fn(() => Promise.resolve(false)),
}));

// HTMLFrame は iframe の読み込みを待つため、止めたかどうかの知らせだけを差し替えて返す
const blocked = { value: false };
vi.mock('../components/editor/HTMLFrame', () => ({
  default: ({ onScriptsBlocked }) => {
    queueMicrotask(() => onScriptsBlocked?.(blocked.value));
    return <div>HTMLFrame</div>;
  },
}));

import PreviewApp from '../app/PreviewApp';

function renderPreview() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  return render(
    <EventContext.Provider value={evt}>
      <PreviewApp />
    </EventContext.Provider>
  );
}

describe('PreviewApp', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <PreviewApp />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  it('does not show the blocked-scripts icon when nothing is blocked', async () => {
    blocked.value = false;
    renderPreview();
    await screen.findByText('HTMLFrame');
    expect(screen.queryByLabelText('scripts-blocked')).toBeNull();
  });

  // スクリプトを止めたときだけ知らせ、押すとメインウィンドウでバインダー設定を開く
  it('shows the blocked-scripts icon and asks the main window to open binder settings', async () => {
    blocked.value = true;
    renderPreview();
    const button = await screen.findByLabelText('scripts-blocked');
    fireEvent.click(button);
    expect(Events.Emit).toHaveBeenCalledWith('binder:binderSetting:open');
  });
});

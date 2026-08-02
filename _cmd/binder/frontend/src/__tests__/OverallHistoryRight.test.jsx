import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../app/OverallHistoryDetail', () => ({ default: () => <div>Detail</div> }));
vi.mock('../dialogs/BranchModal', () => ({ BranchPanel: () => <div>BranchPanel</div> }));
vi.mock('../dialogs/ImportPanel', () => ({ default: () => <div>ImportPanel</div> }));

import OverallHistoryRight from '../app/OverallHistoryRight';

describe('OverallHistoryRight', () => {
  it('renders without crashing', () => {
    const { container } = render(<OverallHistoryRight onBack={() => {}} />);
    expect(container).toBeTruthy();
  });

  // 未オープンのバインダーには Merge 系 API（ByPath 版が無い）を使えないため、
  // binderPath 指定時は取り込みタブを出してはいけない
  it('binderPath 指定時は取り込みタブを出さない', () => {
    render(<OverallHistoryRight binderPath="C:/tmp/binder" onBack={() => {}} />);
    expect(screen.queryByText('share.importTab')).toBeNull();
    expect(screen.getByText('BranchPanel')).toBeTruthy();
  });
});

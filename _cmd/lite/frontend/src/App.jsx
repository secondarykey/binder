import { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Events } from '@wailsio/runtime';

import { ReadFile, SaveFile } from '../bindings/binder/lite/app';
import { OpenFileDialog, NewFile, Terminate } from '../bindings/main/window';

import TabBar from './TabBar';
import EditorPane from './EditorPane';
import PreviewPane from './PreviewPane';
import TitleBar from './TitleBar';
import ConfirmDialog from './ConfirmDialog';

import './language';
import { useTranslation } from 'react-i18next';

const MERMAID_EXTENSIONS = ['.mmd', '.mermaid'];

function isMermaidFile(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return MERMAID_EXTENSIONS.some(ext => lower.endsWith(ext));
}

let nextTabId = 1;

/**
 * binder-lite メインアプリケーション
 * タブ管理 + 左右分割エディタ
 */
function App() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const splitterRef = useRef(null);
  const [splitterPos, setSplitterPos] = useState(50); // パーセント

  const activeTab = tabs.find(tab => tab.id === activeTabId) || null;

  // --- 確認ダイアログ ---
  const [confirmState, setConfirmState] = useState({ open: false, message: '', resolve: null });

  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({ open: true, message, resolve });
    });
  }, []);

  const handleConfirmOk = useCallback(() => {
    confirmState.resolve?.(true);
    setConfirmState({ open: false, message: '', resolve: null });
  }, [confirmState]);

  const handleConfirmCancel = useCallback(() => {
    confirmState.resolve?.(false);
    setConfirmState({ open: false, message: '', resolve: null });
  }, [confirmState]);

  // --- ファイル操作 ---

  // パスを指定してファイルを開く（ダイアログ・ドロップ共通）
  const openFilePath = useCallback(async (path) => {
    if (!path) return;

    // 既に開いているファイルならタブをアクティブにするだけ
    const existing = tabs.find(tab => tab.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    try {
      const content = await ReadFile(path);
      const filename = path.split(/[/\\]/).pop();
      const id = nextTabId++;
      setTabs(prev => [...prev, {
        id,
        path,
        filename,
        content,
        savedContent: content,
        mermaidMode: isMermaidFile(filename),
      }]);
      setActiveTabId(id);
    } catch (err) {
      console.error('Open file error:', err);
    }
  }, [tabs]);

  const openFile = useCallback(async () => {
    const path = await OpenFileDialog();
    openFilePath(path);
  }, [openFilePath]);

  const newFile = useCallback(async () => {
    try {
      const path = await NewFile();
      if (!path) return;

      const filename = path.split(/[/\\]/).pop();
      const id = nextTabId++;
      setTabs(prev => [...prev, {
        id,
        path,
        filename,
        content: '',
        savedContent: '',
        mermaidMode: isMermaidFile(filename),
      }]);
      setActiveTabId(id);
    } catch (err) {
      console.error('New file error:', err);
    }
  }, []);

  const saveActiveTab = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.content === activeTab.savedContent) return;

    try {
      await SaveFile(activeTab.path, activeTab.content);
      setTabs(prev => prev.map(tab =>
        tab.id === activeTab.id
          ? { ...tab, savedContent: tab.content }
          : tab
      ));
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [activeTab]);

  const removeTab = useCallback((tabId) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive ? newActive.id : null);
      }
      return next;
    });
  }, [activeTabId]);

  const closeTab = useCallback(async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.content !== tab.savedContent) {
      const ok = await showConfirm(t('lite.unsavedConfirm'));
      if (!ok) return;
    }

    removeTab(tabId);
  }, [tabs, t, showConfirm, removeTab]);

  const updateContent = useCallback((newContent) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, content: newContent }
        : tab
    ));
  }, [activeTabId]);

  const toggleMermaidMode = useCallback(() => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, mermaidMode: !tab.mermaidMode }
        : tab
    ));
  }, [activeTabId]);

  // --- ファイルドロップ ---

  useEffect(() => {
    const cancel = Events.On('lite:file:dropped', (event) => {
      const path = event.data;
      if (path) openFilePath(path);
    });
    return () => cancel();
  }, [openFilePath]);

  // --- キーボードショートカット ---

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveActiveTab();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFile();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveTab, openFile, closeTab, activeTabId, newFile]);

  // --- スプリッター ---

  const [dragging, setDragging] = useState(false);

  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPos = splitterPos;
    const container = splitterRef.current?.parentElement;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;

    setDragging(true);

    const handleMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newPos = startPos + (dx / containerWidth) * 100;
      setSplitterPos(Math.max(20, Math.min(80, newPos)));
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitterPos]);

  // --- 終了処理 ---

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const hasDirty = tabs.some(t => t.content !== t.savedContent);
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  return (
    <Box data-file-drop-target="" sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-app)' }}>

      <TitleBar
        onClose={async () => {
          const hasDirty = tabs.some(t => t.content !== t.savedContent);
          if (hasDirty) {
            const ok = await showConfirm(t('lite.unsavedConfirm'));
            if (!ok) return;
          }
          Terminate();
        }}
        onNew={newFile}
        onOpen={openFile}
        onSave={saveActiveTab}
        hasDirty={activeTab ? activeTab.content !== activeTab.savedContent : false}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
      />

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab ? (
          <>
            <Box sx={{ width: `${splitterPos}%`, overflow: 'hidden', position: 'relative' }}>
              {dragging && <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'col-resize' }} />}
              <EditorPane
                text={activeTab.content}
                onChange={updateContent}
              />
            </Box>

            {/* スプリッター */}
            <Box
              ref={splitterRef}
              onMouseDown={handleSplitterMouseDown}
              sx={{
                width: '6px',
                cursor: 'col-resize',
                backgroundColor: 'var(--border-primary)',
                '&:hover': { backgroundColor: 'var(--accent-primary)' },
                flexShrink: 0,
                position: 'relative',
                // ドラッグ判定を広げる透明な領域
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: '-4px',
                  right: '-4px',
                },
              }}
            />

            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {/* ドラッグ中はiframeの上にオーバーレイを被せてマウスイベントの吸収を防ぐ */}
              {dragging && <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'col-resize' }} />}
              <PreviewPane text={activeTab.content} mermaidMode={activeTab.mermaidMode} onToggleMode={toggleMermaidMode} />
            </Box>
          </>
        ) : (
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}>
            {t('lite.openFileHint')}
          </Box>
        )}
      </Box>

      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        onCancel={handleConfirmCancel}
        onConfirm={handleConfirmOk}
      />
    </Box>
  );
}

export default App;

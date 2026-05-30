import { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Events } from '@wailsio/runtime';

import { ReadFile, SaveFile } from '../bindings/binder/lite/app';
import { OpenFileDialog, NewFile, Terminate } from '../bindings/main/window';

import TabBar from './TabBar';
import EditorPane from './EditorPane';
import PreviewPane from './PreviewPane';
import TitleBar from './TitleBar';

import './language';
import { useTranslation } from 'react-i18next';

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

  const closeTab = useCallback((tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.content !== tab.savedContent) {
      // TODO: 未保存確認ダイアログ
      if (!window.confirm(t('lite.unsavedConfirm'))) return;
    }

    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive ? newActive.id : null);
      }
      return next;
    });
  }, [tabs, activeTabId, t]);

  const updateContent = useCallback((newContent) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, content: newContent }
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

  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPos = splitterPos;
    const container = splitterRef.current?.parentElement;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;

    const handleMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newPos = startPos + (dx / containerWidth) * 100;
      setSplitterPos(Math.max(20, Math.min(80, newPos)));
    };

    const handleMouseUp = () => {
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
        onClose={() => {
          const hasDirty = tabs.some(t => t.content !== t.savedContent);
          if (hasDirty && !window.confirm(t('lite.unsavedConfirm'))) return;
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
            <Box sx={{ width: `${splitterPos}%`, overflow: 'hidden' }}>
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
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'var(--border-primary)',
                '&:hover': { backgroundColor: 'var(--border-strong)' },
                flexShrink: 0,
              }}
            />

            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <PreviewPane text={activeTab.content} filename={activeTab.filename} />
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
    </Box>
  );
}

export default App;

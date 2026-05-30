import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Events } from '@wailsio/runtime';

import { ReadFile, SaveFile, InitialFiles, GetTheme } from '../bindings/binder/lite/app';
import { OpenFileDialog, NewFile, Terminate } from '../bindings/main/window';
import { setThemeMode } from './theme';

import TabBar from './TabBar';
import EditorPane from './EditorPane';
import PreviewPane from './PreviewPane';
import TitleBar from './TitleBar';
import ConfirmDialog from './ConfirmDialog';
import { useScrollbarOffset } from './useHasScrollbar';

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
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [themeMode, setThemeMode_] = useState('system');

  // 起動時に保存済みのテーマモードを取得
  useEffect(() => {
    GetTheme().then(saved => {
      const mode = saved || 'system';
      setThemeMode_(mode);
    }).catch(() => {});
  }, []);

  const themeCycle = ['system', 'light', 'dark'];
  const handleThemeToggle = useCallback(() => {
    setThemeMode_(prev => {
      const idx = themeCycle.indexOf(prev);
      const next = themeCycle[(idx + 1) % themeCycle.length];
      setThemeMode(next);
      return next;
    });
  }, []);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || null;

  // エディタのスクロールバー検出（展開ボタンの位置調整用）
  const expandBtnRight = useScrollbarOffset('#editor', 6, activeTab?.content);

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

  // --- 起動時の初期ファイル ---

  useEffect(() => {
    InitialFiles().then(paths => {
      if (!paths || paths.length === 0) return;
      for (const path of paths) {
        openFilePath(path);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        themeMode={themeMode}
        onThemeToggle={handleThemeToggle}
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
            {/* エディタペイン */}
            <Box sx={{
              width: previewCollapsed ? '100%' : `${splitterPos}%`,
              overflow: 'hidden',
              position: 'relative',
              transition: dragging ? 'none' : 'width 0.25s ease',
            }}>
              {dragging && <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'col-resize' }} />}
              <EditorPane
                text={activeTab.content}
                onChange={updateContent}
              />
              {/* プレビュー展開ボタン（折りたたみ時、エディタ右端に表示） */}
              {previewCollapsed && (
                <Tooltip title={t('lite.showPreview')} placement="left">
                  <IconButton
                    size="small"
                    onClick={() => setPreviewCollapsed(false)}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: expandBtnRight,
                      zIndex: 10,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      width: 28,
                      height: 28,
                      opacity: 0.7,
                      '&:hover': { opacity: 1, backgroundColor: 'var(--bg-overlay)' },
                    }}
                  >
                    <ChevronLeftIcon sx={{ fontSize: '18px' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* スプリッター */}
            <Box
              ref={splitterRef}
              onMouseDown={previewCollapsed ? undefined : handleSplitterMouseDown}
              sx={{
                width: previewCollapsed ? '0px' : '6px',
                cursor: previewCollapsed ? 'default' : 'col-resize',
                backgroundColor: 'var(--border-primary)',
                '&:hover': previewCollapsed ? {} : { backgroundColor: 'var(--accent-primary)' },
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
                transition: dragging ? 'none' : 'width 0.25s ease',
                '&::before': previewCollapsed ? {} : {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: '-4px',
                  right: '-4px',
                },
              }}
            />

            {/* プレビューペイン */}
            <Box sx={{
              width: previewCollapsed ? '0%' : `${100 - splitterPos}%`,
              overflow: 'hidden',
              position: 'relative',
              transition: dragging ? 'none' : 'width 0.25s ease',
            }}>
              {dragging && <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'col-resize' }} />}
              {/* プレビュー折りたたみボタン（左上） */}
              {!previewCollapsed && (
                <Tooltip title={t('lite.hidePreview')} placement="right">
                  <IconButton
                    size="small"
                    onClick={() => setPreviewCollapsed(true)}
                    sx={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      zIndex: 10,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      width: 28,
                      height: 28,
                      opacity: 0.7,
                      '&:hover': { opacity: 1, backgroundColor: 'var(--bg-overlay)' },
                    }}
                  >
                    <ChevronRightIcon sx={{ fontSize: '18px' }} />
                  </IconButton>
                </Tooltip>
              )}
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

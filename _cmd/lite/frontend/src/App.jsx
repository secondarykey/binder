import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Events } from '@wailsio/runtime';

import { ReadFile, SaveFile, InitialFiles, GetTheme, GetLanguage, GetEditorSettings, GetFont, ListWorks, CreateWork, SaveWork, DeleteWork } from '../bindings/binder/api/lite/app';
import { OpenFileDialog, SaveFileDialog, Terminate, OpenInNewWindow, CopyToClipboard, PasteFilePath } from '../bindings/main/window';
import { setThemeMode } from './theme';
import Mermaid from '@shared/editor/engines/Mermaid';

import TabBar from './TabBar';
import EditorPane from './EditorPane';
import PreviewPane from './PreviewPane';
import TitleBar from './TitleBar';
import ConfirmDialog from './ConfirmDialog';
import SettingDialog from './SettingDialog';
import { useScrollbarOffset } from './useHasScrollbar';

import './language';
import { useTranslation } from 'react-i18next';

const MERMAID_EXTENSIONS = ['.mmd', '.mermaid'];

// ワーク（Untitled タブのバックアップ）を書き出す間隔
const WORK_SAVE_INTERVAL = 60 * 1000;

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
  const [wordWrap, setWordWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [tabSize, setTabSize] = useState(4);
  const [themeMode, setThemeMode_] = useState('system');
  const [language, setLanguage_] = useState('en');
  const [settingOpen, setSettingOpen] = useState(false);
  const [editorFont, setEditorFont] = useState(null);

  // フォント設定を読み込む
  const loadFont = useCallback((theme) => {
    const effectiveTheme = (!theme || theme === 'system')
      ? (document.documentElement.dataset.theme || 'dark')
      : theme;
    GetFont(effectiveTheme).then(f => {
      if (f) setEditorFont(f);
    }).catch(() => {});
  }, []);

  // 起動時に保存済みの設定を取得
  useEffect(() => {
    GetTheme().then(saved => {
      const mode = saved || 'system';
      setThemeMode_(mode);
      loadFont(mode);
    }).catch(() => {});
    GetLanguage().then(saved => {
      if (saved) setLanguage_(saved);
    }).catch(() => {});
    GetEditorSettings().then(s => {
      if (s) {
        if (s.showLineNumbers !== undefined) setShowLineNumbers(s.showLineNumbers);
        if (s.wordWrap !== undefined) setWordWrap(s.wordWrap);
        if (s.tabSize) setTabSize(s.tabSize);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 設定ダイアログの保存時に一括反映
  const handleSettingsSaved = useCallback((saved) => {
    setThemeMode_(saved.themeMode);
    setLanguage_(saved.language);
    setShowLineNumbers(saved.showLineNumbers);
    setWordWrap(saved.wordWrap);
    if (saved.tabSize) setTabSize(saved.tabSize);
    loadFont(saved.themeMode);
  }, [loadFont]);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || null;

  // コールバック内から最新のタブ一覧を参照するためのミラー
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // --- ワーク（保存前の Untitled タブ）のバックアップ ---
  // あくまで裏側のバックアップなので、書き出してもタブの未保存表示は変えない。
  // 保留中の { ワーク名: 内容 } と、まとめて書き出すためのタイマー
  const pendingWorks = useRef(new Map());
  const workTimer = useRef(null);

  const flushWorkSaves = useCallback(async () => {
    if (workTimer.current) {
      clearTimeout(workTimer.current);
      workTimer.current = null;
    }
    const entries = [...pendingWorks.current.entries()];
    pendingWorks.current.clear();
    await Promise.all(entries.map(([name, content]) =>
      SaveWork(name, content).catch((err) => {
        console.error('SaveWork error:', err);
      })
    ));
  }, []);

  // 打鍵ごとではなく WORK_SAVE_INTERVAL に1回だけ書き出す。
  // タイマーが動いている間は内容の差し替えのみ行い、再スケジュールしない
  const scheduleWorkSave = useCallback((name, content) => {
    pendingWorks.current.set(name, content);
    if (workTimer.current) return;
    workTimer.current = setTimeout(() => {
      workTimer.current = null;
      flushWorkSaves();
    }, WORK_SAVE_INTERVAL);
  }, [flushWorkSaves]);

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

      // 拡張子で判定、それ以外は内容から自動検出
      let mermaidMode = isMermaidFile(filename);
      if (!mermaidMode && content) {
        mermaidMode = await Mermaid.detectType(content);
      }

      const id = nextTabId++;
      setTabs(prev => [...prev, {
        id,
        path,
        filename,
        work: null,
        content,
        savedContent: content,
        mermaidMode,
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

  // 新規タブはワークとして即座にファイル化する。
  // 名前（Untitled / Untitled-2 ...）は Go 側が未使用のものを選んで予約するため、
  // 既存のワークを上書きすることはない。
  const newFile = useCallback(async () => {
    let name;
    try {
      name = await CreateWork();
    } catch (err) {
      console.error('CreateWork error:', err);
      return;
    }
    const id = nextTabId++;
    setTabs(prev => [...prev, {
      id,
      path: null,
      filename: name,
      work: name,
      content: '',
      savedContent: '',
      mermaidMode: false,
    }]);
    setActiveTabId(id);
  }, []);

  // ファイルとして保存できたらワークは不要になるので削除する
  const applySavedPath = useCallback(async (tab, savePath) => {
    const filename = savePath.split(/[/\\]/).pop();
    const content = tab.content;
    if (tab.work) {
      pendingWorks.current.delete(tab.work);
      try {
        await DeleteWork(tab.work);
      } catch (err) {
        console.error('DeleteWork error:', err);
      }
    }
    setTabs(prev => prev.map(t =>
      t.id === tab.id
        ? { ...t, path: savePath, filename, work: null, savedContent: content }
        : t
    ));
  }, []);

  const saveActiveTab = useCallback(async () => {
    if (!activeTab) return;

    let savePath = activeTab.path;

    // パス未設定（新規タブ）なら保存先を選択
    if (!savePath) {
      try {
        savePath = await SaveFileDialog('untitled.md');
      } catch (err) {
        console.error('SaveFileDialog error:', err);
        return;
      }
      if (!savePath) return; // キャンセル
    }

    // 既にパスがある場合は内容が変わっていなければスキップ
    if (activeTab.path && activeTab.content === activeTab.savedContent) return;

    try {
      await SaveFile(savePath, activeTab.content);
      await applySavedPath(activeTab, savePath);
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [activeTab, applySavedPath]);

  const saveAsActiveTab = useCallback(async () => {
    if (!activeTab) return;

    const defaultPath = activeTab.path || 'untitled.md';

    let savePath;
    try {
      savePath = await SaveFileDialog(defaultPath);
    } catch (err) {
      console.error('SaveFileDialog error:', err);
      return;
    }
    if (!savePath) return;

    try {
      await SaveFile(savePath, activeTab.content);
      await applySavedPath(activeTab, savePath);
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [activeTab, applySavedPath]);

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

    // 未保存の変更がある場合は確認（新規タブで内容がある場合も含む）
    const isDirty = tab.path ? tab.content !== tab.savedContent : tab.content !== '';
    if (isDirty) {
      const ok = await showConfirm(t('lite.unsavedConfirm'));
      if (!ok) return;
    }

    // タブを閉じたらバックアップも破棄する
    if (tab.work) {
      pendingWorks.current.delete(tab.work);
      try {
        await DeleteWork(tab.work);
      } catch (err) {
        console.error('DeleteWork error:', err);
      }
    }

    removeTab(tabId);
  }, [tabs, t, showConfirm, removeTab]);

  const updateContent = useCallback((newContent) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, content: newContent }
        : tab
    ));
    // ワークタブは編集内容をそのままワークへ書き戻す
    const tab = tabsRef.current.find(t => t.id === activeTabId);
    if (tab?.work) scheduleWorkSave(tab.work, newContent);
  }, [activeTabId, scheduleWorkSave]);

  const reorderTabs = useCallback((dragId, dropId) => {
    setTabs(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(t => t.id === dragId);
      const toIdx = next.findIndex(t => t.id === dropId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const toggleMermaidMode = useCallback(() => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, mermaidMode: !tab.mermaidMode }
        : tab
    ));
  }, [activeTabId]);

  // --- 起動時の初期ファイル ---

  // 保存されているワークをタブとして復元する
  const restoreWorks = useCallback(async (works) => {
    const restored = await Promise.all(works.map(async (w) => ({
      id: nextTabId++,
      path: null,
      filename: w.name,
      work: w.name,
      content: w.content ?? '',
      // ワークは保存ではないので未保存（*付き）のまま復元する
      savedContent: '',
      mermaidMode: w.content ? await Mermaid.detectType(w.content) : false,
    })));
    if (restored.length === 0) return false;
    setTabs(prev => [...prev, ...restored]);
    setActiveTabId(restored[0].id);
    return true;
  }, []);

  // StrictMode の二重実行でワークが余計に作られないよう一度だけ走らせる
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    InitialFiles().then(async (paths) => {
      if (paths && paths.length > 0) {
        // ファイル指定で起動した場合はワークを開かない（＋ を押した時は未使用の名前が使われる）
        for (const path of paths) {
          openFilePath(path);
        }
        return;
      }
      // 単独起動時は残っているワークを全て復元する。無ければ新規ワークを1つ作る
      let works = [];
      try {
        works = await ListWorks();
      } catch (err) {
        console.error('ListWorks error:', err);
      }
      const ok = await restoreWorks(works || []);
      if (!ok) newFile();
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

  // ワークはバックアップなので未保存判定には影響させない（元のまま）
  const hasDirty = tabs.some(t => t.path ? t.content !== t.savedContent : t.content !== '');

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirty]);

  return (
    <Box data-file-drop-target="" sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-app)' }}>

      <TitleBar
        onClose={async () => {
          if (hasDirty) {
            const ok = await showConfirm(t('lite.unsavedConfirm'));
            if (!ok) return;
          }
          // 保留中のワークを書き出してから終了する
          await flushWorkSaves();
          Terminate();
        }}
        onOpen={openFile}
        onSave={saveAsActiveTab}
        hasActiveTab={!!activeTab}
        onOpenSettings={() => setSettingOpen(true)}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onNew={newFile}
        onReorder={reorderTabs}
        onOpenNewWindow={async (tabId) => {
          const tab = tabs.find(t => t.id === tabId);
          if (tab?.path) {
            await OpenInNewWindow(tab.path);
          }
        }}
        onCopyTab={async (tabId) => {
          const tab = tabs.find(t => t.id === tabId);
          if (tab?.path) {
            await CopyToClipboard(tab.path);
          }
        }}
        onPasteTab={async () => {
          const path = await PasteFilePath();
          if (path) openFilePath(path);
        }}
      />

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', margin: '0px 4px 4px 4px' }}>
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
                wordWrap={wordWrap}
                onWordWrapToggle={() => setWordWrap(prev => !prev)}
                showLineNumbers={showLineNumbers}
                onLineNumbersToggle={() => setShowLineNumbers(prev => !prev)}
                font={editorFont}
                tabSize={tabSize}
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
                      opacity: 0.4,
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
                width: previewCollapsed ? '0px' : '8px',
                cursor: previewCollapsed ? 'default' : 'col-resize',
                backgroundColor: 'var(--border-primary)',
                transition: dragging ? 'none' : 'width 0.25s ease, background-color 0.2s ease',
                '&:hover': previewCollapsed ? {} : { backgroundColor: 'var(--accent-blue)' },
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
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
                      opacity: 0.4,
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

      <SettingDialog
        open={settingOpen}
        onClose={() => setSettingOpen(false)}
        settings={{ themeMode, language, showLineNumbers, wordWrap, tabSize }}
        onSettingsSaved={handleSettingsSaved}
        onOpenFiles={(paths) => {
          for (const p of paths) {
            openFilePath(p);
          }
        }}
      />
    </Box>
  );
}

export default App;

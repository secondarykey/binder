import { useState, useEffect, useContext } from 'react';

import { Toolbar, Tooltip, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import ContrastIcon from '@mui/icons-material/Contrast';

import { Events, Window, Browser } from '@wailsio/runtime';
import { GetConfig, GetPreviewScrollbar } from '../../bindings/binder/api/app';

import { SystemMessage } from '../Message';
import { copyClipboard } from './App';
import { EventContext } from '../Event';
import { resolveBinderLink } from '../components/editor/binder-link';
import HTMLFrame from '../components/editor/HTMLFrame';
import PreviewContextMenu from '@shared/editor/PreviewContextMenu';
import Mermaid from '../components/editor/engines/Mermaid';

import '../assets/App.css';
import '../assets/PreviewApp.css';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * プレビュー表示ウィンドウ
 * エディタからのイベントを受信してリアルタイムにプレビューを更新する
 */
function PreviewApp() {

  const { t } = useTranslation();
  const evt = useContext(EventContext);

  // URL search params から初期値を取得
  const params = new URLSearchParams(window.location.search);
  const [typ, setTyp]   = useState(params.get('type') ?? 'note');
  const [id, setId]     = useState(params.get('id') ?? '');
  const [name, setName] = useState(params.get('name') ?? '');
  const [html, setHTML] = useState('');
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [colorSchemeConfig, setColorSchemeConfig] = useState(null);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  // プレビューのスクロールバーをエディタ画面と揃えるか（アプリ設定・デフォルトON）
  const [previewScrollbar, setPreviewScrollbar] = useState(true);
  // エディタ閲覧履歴の可否（メインウィンドウが持つ状態の写し）
  const [historyState, setHistoryState] = useState({ canBack: false, canForward: false });

  useEffect(() => {
    GetPreviewScrollbar().then((v) => setPreviewScrollbar(!!v)).catch(() => {});
    const cleanup = Events.On('binder:preview:scrollbarChanged', (event) => {
      const data = event.data?.[0] ?? event.data;
      setPreviewScrollbar(!!data);
    });
    const cleanupHistory = Events.On('binder:editor:historyState', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      setHistoryState({ canBack: !!data.canBack, canForward: !!data.canForward });
    });
    return () => { cleanup(); cleanupHistory(); };
  }, []);

  useEffect(() => {
    // プレビュー内容の更新イベント
    const cleanupUpdate = Events.On('binder:preview:update', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      if (data.id === id || !id) {
        if (data.typ) setTyp(data.typ);
        if (data.id) setId(data.id);
        if (data.name) setName(data.name);
        if (data.typ === 'diagram') {
          // ダイアグラムは mermaidViewer に直接レンダリング
          const el = document.querySelector('#previewMermaidViewer');
          if (el && data.html) {
            Mermaid.parse(data.html, data.styleTemplateId).then((result) => {
              el.innerHTML = result.svg;
            }).catch(() => {
              el.innerHTML = data.html;
            });
          }
          setHTML('');
        } else {
          setHTML(data.html ?? '');
        }
      }
    });

    GetConfig().then((conf) => {
      if (conf.previewColorScheme) {
        setColorSchemeConfig(conf.previewColorScheme);
      }
    }).catch(() => {});

    // 起動完了をエディタに通知（初期コンテンツを要求）
    Events.Emit('binder:preview:ready', { id });

    // ナビゲーション（ツリーでアイテム切替）イベント
    const cleanupNav = Events.On('binder:preview:navigate', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      setTyp(data.typ ?? 'note');
      setId(data.id ?? '');
      setName(data.name ?? '');
      setHTML('');
      // ダイアグラムビューアもクリア
      const el = document.querySelector('#previewMermaidViewer');
      if (el) el.innerHTML = '';
    });

    return () => {
      cleanupUpdate();
      cleanupNav();
    };
  }, [id]);

  const handleClose = () => {
    Window.Close();
  };

  // プレビューのコンテキストメニュー（WebView既定のメニューは HTMLFrame 側で止めている）
  const [menu, setMenu] = useState({ open: false, x: 0, y: 0, kind: null, href: '', selection: '' });
  const handleContextMenu = (info) => setMenu({ ...info, open: true, ...historyState });
  const closeMenu = () => setMenu((m) => ({ ...m, open: false }));

  // 戻る/進む はメインウィンドウのエディタ閲覧履歴を辿るため、依頼するだけ
  const handleHistoryBack = () => Events.Emit('binder:editor:historyNav', { dir: 'back' });
  const handleHistoryForward = () => Events.Emit('binder:editor:historyNav', { dir: 'forward' });

  // プレビュー内の外部リンク: OSのブラウザで開く
  const handleLinkExternal = (url) => {
    Browser.OpenURL(url).catch((err) => evt.showErrorMessage(err));
  };

  // プレビュー内のバインダー内リンク: 別ウィンドウのため、メインウィンドウへ遷移を依頼する
  const handleLinkInternal = (href) => {
    resolveBinderLink(href).then((target) => {
      if (!target) {
        evt.showWarningMessage(`${t("preview.linkNotFound")}: ${href}`);
        return;
      }
      Events.Emit('binder:link:navigate', { url: target.url, id: target.id });
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleToggleAlwaysOnTop = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    Window.SetAlwaysOnTop(next);
  };

  return (
    <div id="PreviewApp">

      {/** タイトルバー */}
      <Toolbar id="previewTitle" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
          {t('preview.windowTitle')}{name ? ` — ${name}` : ''}
        </Typography>
        {colorSchemeConfig && colorSchemeConfig.values.length > 0 &&
          <Tooltip title={`${t("preview.colorScheme")}: ${colorSchemeConfig.values[colorSchemeIndex]}`} placement="bottom">
            <IconButton size="small" color="inherit" aria-label="color-scheme"
              onClick={() => setColorSchemeIndex((prev) => (prev + 1) % colorSchemeConfig.values.length)}
            >
              <ContrastIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
        <Tooltip title={t('preview.alwaysOnTop')} placement="bottom">
          <IconButton size="small" color="inherit" aria-label="always on top" onClick={handleToggleAlwaysOnTop}
            sx={{ color: alwaysOnTop ? 'var(--accent-primary)' : 'inherit', backgroundColor: alwaysOnTop ? 'var(--bg-button)' : 'transparent' }}>
            {alwaysOnTop
              ? <PushPinIcon fontSize="small" />
              : <PushPinOutlinedIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} />
            }
          </IconButton>
        </Tooltip>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** プレビューエリア */}
      <div id="previewArea">
        {(typ === 'note' || typ === 'template') &&
          <HTMLFrame html={html} cursorLine={null} colorSchemeAttr={colorSchemeConfig?.attribute} colorSchemeValue={colorSchemeConfig?.values[colorSchemeIndex]} customScrollbar={previewScrollbar} onLinkExternal={handleLinkExternal} onLinkInternal={handleLinkInternal} onContextMenu={handleContextMenu} />
        }
        {typ === 'diagram' &&
          <div id="previewMermaidViewer" style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
          }}></div>
        }
        {typ !== 'note' && typ !== 'template' && typ !== 'diagram' &&
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', m: 'auto' }}>
            {t('preview.notSupported')}
          </Typography>
        }
      </div>

      <PreviewContextMenu
        state={menu}
        onClose={closeMenu}
        onBack={handleHistoryBack}
        onForward={handleHistoryForward}
        onCopy={copyClipboard}
        onCopyLink={copyClipboard}
        onOpenExternal={handleLinkExternal}
        onOpenInternal={handleLinkInternal}
      />

      <SystemMessage />
    </div>
  );
}

export default PreviewApp;

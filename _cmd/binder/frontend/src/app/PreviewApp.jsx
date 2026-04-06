import { useState, useEffect } from 'react';

import { Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { Events, Window } from '@wailsio/runtime';

import { SystemMessage } from '../Message';
import HTMLFrame from '../components/editor/HTMLFrame';
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

  // URL search params から初期値を取得
  const params = new URLSearchParams(window.location.search);
  const [typ, setTyp]   = useState(params.get('type') ?? 'note');
  const [id, setId]     = useState(params.get('id') ?? '');
  const [name, setName] = useState(params.get('name') ?? '');
  const [html, setHTML] = useState('');

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
            Mermaid.render(data.html).then((svg) => {
              el.innerHTML = svg;
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

  return (
    <div id="PreviewApp">

      {/** タイトルバー */}
      <Toolbar id="previewTitle" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
          {t('preview.windowTitle')}{name ? ` — ${name}` : ''}
        </Typography>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/** プレビューエリア */}
      <div id="previewArea">
        {typ === 'note' &&
          <HTMLFrame html={html} cursorLine={null} />
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
      </div>

      <SystemMessage />
    </div>
  );
}

export default PreviewApp;

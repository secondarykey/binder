import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip } from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import DownloadIcon from '@mui/icons-material/Download';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AttachFileIcon from '@mui/icons-material/AttachFile';

import { GetAsset, GetAssetContent, EditAsset, Generate, Unpublish, MigrateAssetToNote, GetFont } from '../../bindings/binder/api/app';
import { Events } from '@wailsio/runtime';
import { SelectFile } from '../../bindings/main/window';
import { EventContext } from '../Event';
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * MIMEタイプが画像かどうかを判定する
 */
function isImageMime(mime) {
  return mime != null && mime.startsWith('image/');
}

/**
 * MIMEタイプがテキストかどうかを判定する
 */
function isTextMime(mime) {
  return mime != null && mime.startsWith('text/');
}

/**
 * 画像ビューア（ドラッグ移動・ホイール拡大縮小）
 * SVGビューア（Editor/Component.jsx viewDiagram）と同じロジックを流用。
 * - 初期表示: コンテナに収まるようにフィットし中央配置
 * - ドラッグ: pointermove で移動
 * - ズーム: wheel で拡大縮小（0.1 刻み）
 */
function ImageViewer({ src, alt }) {
  const containerRef = useRef(null);
  const imgRef      = useRef(null);
  // React state を使わず ref で transform 値を保持（ポインタ移動ごとの再レンダーを避ける）
  const tfRef = useRef({ left: 0, top: 0, scale: 1 });

  const applyTransform = () => {
    if (!imgRef.current) return;
    const { left, top, scale } = tfRef.current;
    imgRef.current.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  };

  // ホイールはブラウザのデフォルト（ページスクロール）を抑制する必要があるため
  // passive: false の native リスナーで登録する
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      e.preventDefault();
      const s = e.deltaY > 0 ? -0.1 : 0.1;
      tfRef.current.scale = Math.max(0.1, tfRef.current.scale + s);
      applyTransform();
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // 画像読み込み後: コンテナにフィットするスケールで中央配置
  const handleLoad = () => {
    const container = containerRef.current;
    const img       = imgRef.current;
    if (!container || !img) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.min(cw / iw, ch / ih);
    const left  = (cw - iw * scale) / 2;
    const top   = (ch - ih * scale) / 2;

    tfRef.current = { left, top, scale };
    applyTransform();
  };

  // ドラッグ移動（SVGビューアと同じ pointermove + movementX/Y）
  const handlePointerMove = (e) => {
    if (!e.buttons) return;
    tfRef.current.left += e.movementX;
    tfRef.current.top  += e.movementY;
    applyTransform();
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'grab',
        userSelect: 'none',
      }}
      onPointerMove={handlePointerMove}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          maxWidth: 'none', // CSS による自動リサイズを無効化
          userSelect: 'none',
        }}
      />
    </div>
  );
}

/**
 * アセットビューア
 * - 画像ファイル: ドラッグ移動・ホイール拡大縮小付き画像表示
 * - テキストファイル: テキスト表示
 * - その他バイナリ: 非表示通知
 * - ファイルが見つからない場合: メッセージ表示
 * - ヘッダーに Generate ボタンを表示
 */
function AssetViewer() {
  const evt = useContext(EventContext);
  const { id } = useParams();
  const nav = useNavigate();
  const {t} = useTranslation();

  // ロード中: assetContent=null, error=null
  // 成功:     assetContent=object, error=null
  // エラー:   assetContent=null, error=string, assetName=string
  const [assetContent, setAssetContent] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [assetMeta, setAssetMeta] = useState(null);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ソースエディタと同じフォント設定
  const [editorStyle, setEditorStyle] = useState({});

  useEffect(() => {
    GetFont().then((s) => {
      setEditorStyle({
        fontFamily: s.name,
        fontSize: s.size + 'px',
        color: s.color,
        backgroundColor: s.backgroundColor,
      });
    }).catch(() => {});

    // フォント変更イベントを受信して同期
    const cleanup = Events.On('binder:editor:fontChanged', (event) => {
      const s = event.data?.[0] ?? event.data ?? {};
      setEditorStyle({
        fontFamily: s.name,
        fontSize: s.size + 'px',
        color: s.color,
        backgroundColor: s.backgroundColor,
      });
    });
    return () => { cleanup(); };
  }, []);

  useEffect(() => {
    if (!id) return;
    setAssetContent(null);
    setAssetName('');
    setAssetMeta(null);
    setError(null);

    // メタデータ取得（タイトルはファイルが見つからなくても表示したい）
    GetAsset(id).then((meta) => {
      setAssetMeta(meta);
      if (meta?.name) {
        setAssetName(meta.name);
        evt.changeTitle(meta.name);
      }
    }).catch(() => {
      // メタデータ取得失敗は無視（コンテンツ取得のエラーを優先表示）
    });

    // コンテンツ取得
    GetAssetContent(id).then((resp) => {
      setAssetContent(resp);
      if (resp?.name) {
        setAssetName(resp.name);
        evt.changeTitle(resp.name);
      }
    }).catch(() => {
      // エラーポップアップではなくビューア内にメッセージを表示
      setError(t('assetViewer.loadError'));
    });
  }, [id]);

  /** Generate ボタン押下: アセットを公開する */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await Generate("assets", id, "");
      evt.showSuccessMessage(t("assetViewer.generateSuccess"));
    } catch (e) {
      evt.showErrorMessage(t("assetViewer.generateError", { error: e }));
    } finally {
      setGenerating(false);
    }
  };

  /** Migrate ボタン押下: 確認ダイアログを開く */
  const handleMigrate = () => setConfirmOpen(true);

  /** 確認ダイアログで「移行」を選択した場合 */
  const handleMigrateConfirm = async () => {
    setConfirmOpen(false);
    setMigrating(true);
    try {
      const note = await MigrateAssetToNote(id);
      evt.refreshTree();
      evt.showSuccessMessage(t("assetViewer.migrateSuccess"));
      nav(`/editor/note/${note.id}`);
    } catch (e) {
      evt.showErrorMessage(t("assetViewer.migrateError", { error: e }));
    } finally {
      setMigrating(false);
    }
  };

  /** ファイル更新ボタン押下: ファイルを選択してアセットを更新する */
  const handleUpdateFile = () => {
    SelectFile("Any File", "*").then((f) => {
      if (!f) return;
      setUpdating(true);
      const data = {
        id: assetMeta?.id ?? id,
        parentId: assetMeta?.parentId ?? '',
        name: assetMeta?.name ?? '',
        alias: assetMeta?.alias ?? '',
        detail: assetMeta?.detail ?? '',
        binary: assetMeta?.binary ?? false,
      };
      EditAsset(data, f).then(() => {
        // コンテンツを再読み込み
        GetAssetContent(id).then((resp) => {
          setAssetContent(resp);
          evt.showSuccessMessage(t("assetViewer.updateFileSuccess"));
        }).catch(() => {
          evt.showSuccessMessage(t("assetViewer.updateFileSuccess"));
        });
      }).catch((e) => {
        evt.showErrorMessage(t("assetViewer.updateFileError", { error: e }));
      }).finally(() => {
        setUpdating(false);
      });
    }).catch(() => {});
  };

  /** Unpublish ボタン押下: docs からアセットを削除する */
  const handleUnpublish = () => {
    Unpublish("assets", id).then(() => {
      evt.showSuccessMessage(t("assetViewer.unpublishSuccess"));
    }).catch((e) => {
      evt.showErrorMessage(t("assetViewer.unpublishError", { error: e }));
    });
  };

  /** ダウンロードボタン押下: アセットファイルをダウンロードする */
  const handleDownload = () => {
    if (!assetContent) return;
    const { name, mime, content: fileContent } = assetContent;
    const byteChars = atob(fileContent);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const dlMime = mime || 'application/octet-stream';
    const blob = new Blob([byteArray], { type: dlMime });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', name);
    link.click();
  };

  // コンテンツ部分を変数で組み立てる（早期returnを避けてヘッダーと共通化）
  let content;

  if (error) {
    content = (
      <div style={{ padding: '16px' }}>
        {assetName && (
          <div style={{ marginBottom: '8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>{assetName}</div>
        )}
        <div style={{ color: 'var(--accent-error)' }}>{error}</div>
      </div>
    );
  } else if (!assetContent) {
    content = (
      <div style={{ padding: '16px', color: 'var(--text-muted)' }}>Loading...</div>
    );
  } else {
    const { name, mime, content: fileContent } = assetContent;
    const isImage = isImageMime(mime);
    const isText = isTextMime(mime);

    if (isImage) {
      content = (
        <ImageViewer
          src={`data:${mime};base64,${fileContent}`}
          alt={name}
        />
      );
    } else if (isText) {
      // テキストファイル: base64 → UTF-8 テキスト
      let text = '';
      try {
        text = decodeURIComponent(escape(atob(fileContent)));
      } catch {
        text = atob(fileContent);
      }
      // ソースエディタ（textarea#editor）と同じスタイルで読み取り専用表示
      content = (
        <textarea
          readOnly
          value={text}
          style={{
            ...editorStyle,
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: '5px',
            margin: 0,
            border: 0,
            resize: 'none',
            outline: 'none',
          }}
        />
      );
    } else {
      // その他バイナリ
      content = (
        <div style={{ padding: '16px', color: 'var(--text-muted)' }}>
          {t("assetViewer.binaryNotSupported", { name })}
        </div>
      );
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* メニューバー */}
      <div id="previewMenu">
        <div className="previewMenuLeft">
          <Tooltip title={t("preview.unpublish")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="unpublish" onClick={handleUnpublish} disabled={!id} className="editorBtn">
                <UnpublishedIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
        </div>
        <div className="previewMenuRight">
          <Tooltip title={t("assetViewer.updateFile")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="update file" onClick={handleUpdateFile} disabled={updating || !id} className="editorBtn">
                <AttachFileIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
          {assetContent && isTextMime(assetContent.mime) && (
            <Tooltip title={t("assetViewer.migrate")} placement="bottom">
              <span>
                <IconButton size="small" aria-label="migrate to note" onClick={handleMigrate} disabled={migrating || !id} className="editorBtn">
                  <NoteAddIcon sx={{ fontSize: '16px' }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={t("preview.download")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="download" onClick={handleDownload} disabled={!assetContent || !id} className="editorBtn">
                <DownloadIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("preview.publish")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="publish" onClick={handleGenerate} disabled={generating || !id} className="editorBtn">
                <PublishIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>
      {/* コンテンツ */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {content}
      </div>

      {/* ノート移行確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t("assetViewer.migrateTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            {t("assetViewer.migrateConfirm", { name: assetName })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleMigrateConfirm} color="primary">{t("assetViewer.migrate")}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default AssetViewer;

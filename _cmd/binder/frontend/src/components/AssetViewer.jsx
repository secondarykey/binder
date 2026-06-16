import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControlLabel, IconButton, ListSubheader, Menu, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import DownloadIcon from '@mui/icons-material/Download';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ImageIcon from '@mui/icons-material/Image';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { GetAsset, GetAssetContent, EditAsset, Generate, Unpublish, Commit, MigrateAssetToNote, SetAssetAsMetaImage, GetFont, SaveAssetContent, GetModifiedIds, EnsureAddress, ParseAsset, DetectAssetMime } from '../../bindings/binder/api/app';
import CommitBar from './CommitBar';
import EditorArea from './editor/EditorArea';
import { Events, Browser } from '@wailsio/runtime';
import { SelectFile } from '../../bindings/main/window';
import { EventContext } from '../Event';
import { ActionButton } from '../dialogs/components/ActionButton';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * ユーザー向けMIME選択肢: ラベル(グループ/表示名)とvalue
 */
const MIME_OPTIONS = [
  { group: "image", label: "PNG",  value: "image/png" },
  { group: "image", label: "JPEG", value: "image/jpeg" },
  { group: "image", label: "GIF",  value: "image/gif" },
  { group: "image", label: "WebP", value: "image/webp" },
  { group: "image", label: "SVG",  value: "image/svg+xml" },
  { group: "image", label: "BMP",  value: "image/bmp" },
  { group: "image", label: "ICO",  value: "image/x-icon" },
  { group: "image", label: "AVIF", value: "image/avif" },
  { group: "image", label: "TIFF", value: "image/tiff" },
  { group: "text",  label: "CSS",          value: "text/css" },
  { group: "text",  label: "JavaScript",   value: "text/javascript" },
  { group: "text",  label: "HTML",         value: "text/html" },
  { group: "text",  label: "JSON",         value: "application/json" },
  { group: "text",  label: "XML",          value: "text/xml" },
  { group: "text",  label: "Markdown",     value: "text/markdown" },
  { group: "text",  label: "Plain Text",   value: "text/plain" },
  { group: "other", label: "PDF",          value: "application/pdf" },
];

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

function isSvgMime(mime) {
  return mime === 'image/svg+xml';
}

function isHtmlMime(mime) {
  return mime === 'text/html';
}

//指定秒数での実行処理
const debouncePromiss = (fn, delay) => {
  var timer = null;
  return function (...args) {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(fn.apply(this, args));
      }, delay);
    });
  }
}

//テキストアセットの保存処理（デバウンス）
const saveAssetText = debouncePromiss((id, text) => {
  return SaveAssetContent(id, text);
}, 1000);

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
  const [displayScale, setDisplayScale] = useState(null);

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
      setDisplayScale(Math.round(tfRef.current.scale * 100));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // 画像読み込み後: 100%表示を基本とし、画像がコンテナより大きい場合はフィット
  const handleLoad = () => {
    const container = containerRef.current;
    const img       = imgRef.current;
    if (!container || !img) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const fitScale = Math.min(cw / iw, ch / ih);
    const scale = Math.min(1.0, fitScale);
    const left  = (cw - iw * scale) / 2;
    const top   = (ch - ih * scale) / 2;

    tfRef.current = { left, top, scale };
    applyTransform();
    setDisplayScale(Math.round(scale * 100));
  };

  // ホイールドラッグ（中ボタン）による移動。LayerEditor と統一。
  const handlePointerDown = (e) => {
    if (e.button !== 1) return;
    e.preventDefault(); // ブラウザのオートスクロールモードを抑制
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };
  const handlePointerMove = (e) => {
    if (!(e.buttons & 4)) return; // 中ボタン押下中のみ移動（ビット2）
    tfRef.current.left += e.movementX;
    tfRef.current.top  += e.movementY;
    applyTransform();
  };
  const handlePointerUp = (e) => {
    if (e.button === 1 && containerRef.current) containerRef.current.style.cursor = '';
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
      {displayScale !== null && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.45)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {displayScale}%
        </div>
      )}
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
  const [comment, setComment] = useState('');
  const [updated, setUpdated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [migrateDeleteAsset, setMigrateDeleteAsset] = useState(true);
  // MoreVert メニュー
  const [moreMenu, setMoreMenu] = useState({ open: false, el: null });
  const openMoreMenu = (el) => setMoreMenu({ open: true, el });
  const closeMoreMenu = () => setMoreMenu({ open: false, el: null });
  // メタ画像設定ダイアログ
  const [metaImageDlg, setMetaImageDlg] = useState(false);
  const [metaImageDeleteAsset, setMetaImageDeleteAsset] = useState(true);
  // テキストアセット編集用
  const [editText, setEditText] = useState('');
  // ソースエディタと同じフォント設定
  const [editorStyle, setEditorStyle] = useState({});
  // MIMEタイプ修正ダイアログ
  const [mimeFixDlg, setMimeFixDlg] = useState(false);
  const [selectedMime, setSelectedMime] = useState('');
  const [detectedMime, setDetectedMime] = useState(null);
  // SVG/HTML デュアルモードのプレビュー表示切替（SVG: デフォルトtrue, HTML: デフォルトfalse）
  const [showPreview, setShowPreview] = useState(true);


  useEffect(() => {
    GetFont(document.documentElement.dataset.theme || 'dark').then((s) => {
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
    setShowPreview(true);

    // メタデータ取得（タイトルはファイルが見つからなくても表示したい）
    GetAsset(id).then((meta) => {
      setAssetMeta(meta);
      if (meta?.name) {
        setAssetName(meta.name);
        evt.changeTitle(meta.name);
        setComment('Updated: ' + meta.name);
      }
    }).catch(() => {
      // メタデータ取得失敗は無視（コンテンツ取得のエラーを優先表示）
    });

    // ツリーと同じソース（git status）で未コミット状態を判定
    GetModifiedIds().then((ids) => {
      setUpdated((ids ?? []).includes(id));
    }).catch(() => {});

    // コンテンツ取得
    GetAssetContent(id).then((resp) => {
      setAssetContent(resp);
      if (resp?.name) {
        setAssetName(resp.name);
        evt.changeTitle(resp.name);
      }
      // HTML はデフォルトでソース表示
      if (resp && isHtmlMime(resp.mime)) {
        setShowPreview(false);
      }
      // テキストアセットまたはSVGの場合、base64デコードして編集用stateに設定
      if (resp && (isTextMime(resp.mime) || isSvgMime(resp.mime))) {
        try {
          setEditText(decodeURIComponent(escape(atob(resp.content))));
        } catch {
          setEditText(atob(resp.content));
        }
      }
    }).catch(() => {
      // エラーポップアップではなくビューア内にメッセージを表示
      setError(t('assetViewer.loadError'));
    });
  }, [id]);

  /** Commit ボタン押下: アセットを個別コミットする */
  const handleCommit = () => {
    Commit("assets", id, comment).then(() => {
      setUpdated(false);
      evt.commitDone();
      evt.showSuccessMessage("Commit.");
    }).catch((e) => {
      evt.showErrorMessage(String(e));
    });
  };


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

  const handleOpenInBrowser = () => {
    const a = assetMeta?.alias;
    if (!a) return;
    // HTTPサーバを遅延起動してから開く
    EnsureAddress().then((addr) => {
      if (addr) Browser.OpenURL(`${addr}/assets/${a}`);
    }).catch((err) => evt.showErrorMessage(err));
  };

  /** Migrate ボタン押下: 確認ダイアログを開く */
  const handleMigrate = () => setConfirmOpen(true);

  /** 確認ダイアログで「移行」を選択した場合 */
  const handleMigrateConfirm = async () => {
    setConfirmOpen(false);
    setMigrating(true);
    try {
      const note = await MigrateAssetToNote(id, migrateDeleteAsset);
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
  const [unpublishConfirm, setUnpublishConfirm] = useState(false);
  const handleUnpublish = () => setUnpublishConfirm(true);
  const doUnpublish = () => {
    setUnpublishConfirm(false);
    Unpublish("assets", id).then(() => {
      evt.showSuccessMessage(t("assetViewer.unpublishSuccess"));
    }).catch((e) => {
      evt.showErrorMessage(t("assetViewer.unpublishError", { error: e }));
    });
  };

  /** MIMEタイプ修正ダイアログを開く: コンテンツ推定をバックグラウンドで実行 */
  const handleOpenMimeFixDlg = () => {
    const current = assetContent?.mime || '';
    setSelectedMime(current);
    setDetectedMime(null);
    setMimeFixDlg(true);
    if (id) {
      DetectAssetMime(id).then((detected) => {
        setDetectedMime(detected);
        // ユーザーがまだ何も変更していなければ推定結果を提案として反映
        setSelectedMime(prev => prev === current ? detected : prev);
      }).catch(() => {});
    }
  };

  /** MIMEタイプ修正を確定して保存・再読み込み */
  const handleMimeFix = () => {
    if (!selectedMime || !assetMeta) return;
    EditAsset({ ...assetMeta, mime: selectedMime }, "")
      .then(() => GetAssetContent(id))
      .then((resp) => {
        setAssetContent(resp);
        if (resp && (isTextMime(resp.mime) || isSvgMime(resp.mime))) {
          try { setEditText(decodeURIComponent(escape(atob(resp.content)))); }
          catch { setEditText(atob(resp.content)); }
        }
        setShowPreview(isHtmlMime(resp?.mime) ? false : true);
        setMimeFixDlg(false);
        evt.showSuccessMessage(t("assetViewer.mimeFixSuccess"));
      })
      .catch((e) => evt.showErrorMessage(String(e)));
  };

  /** メタ画像設定ダイアログを開く */
  const handleSetMetaImage = () => {
    setMetaImageDeleteAsset(true);
    setMetaImageDlg(true);
  };

  /** メタ画像設定確定 */
  const handleSetMetaImageConfirm = async () => {
    setMetaImageDlg(false);
    try {
      await SetAssetAsMetaImage(id, metaImageDeleteAsset);
      evt.refreshTree();
      evt.showSuccessMessage(t("assetViewer.setMetaImageSuccess"));
      if (metaImageDeleteAsset && assetMeta?.parentId) {
        nav(`/editor/note/${assetMeta.parentId}`);
        evt.selectTreeNode(assetMeta.parentId);
      }
    } catch (e) {
      evt.showErrorMessage(t("assetViewer.setMetaImageError", { error: e }));
    }
  };

  // テキストダウンロードサブメニューのアンカー要素
  const [textDownloadMenuAnchor, setTextDownloadMenuAnchor] = useState(null);

  /** Blob を生成してテキストファイルをダウンロードする */
  const triggerTextDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
  };

  /** テキストをそのままダウンロード */
  const handleDownloadRaw = () => {
    setTextDownloadMenuAnchor(null);
    triggerTextDownload(editText, assetName);
  };

  /** テンプレート関数を展開したテキストをダウンロード */
  const handleDownloadExpanded = () => {
    setTextDownloadMenuAnchor(null);
    ParseAsset(id, false, editText)
      .then(result => {
        if (result.error) { evt.showErrorMessage(result.error); return; }
        triggerTextDownload(result.html, assetName);
      })
      .catch(err => evt.showErrorMessage(err));
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
    const isSvg = isSvgMime(mime);
    const isHtml = isHtmlMime(mime);

    if (isImage && !isSvg) {
      // 画像（SVG以外）: ImageViewer のみ
      content = (
        <ImageViewer
          src={`data:${mime};base64,${fileContent}`}
          alt={name}
        />
      );
    } else if (isSvg && showPreview) {
      // SVG プレビューモード: editText から生成して編集結果を即反映
      const svgSrc = editText
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(editText)}`
        : `data:${mime};base64,${fileContent}`;
      content = (
        <ImageViewer
          src={svgSrc}
          alt={name}
        />
      );
    } else if (isHtml && showPreview) {
      // HTML プレビューモード: iframe で描画
      content = (
        <iframe
          srcDoc={editText}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
          sandbox="allow-same-origin"
        />
      );
    } else if (isText || isSvg) {
      // テキスト/SVGソース: EditorArea（行番号付き、デバウンス自動保存）
      content = (
        <EditorArea
          text={editText}
          style={editorStyle}
          onChange={(e) => {
            setEditText(e.target.value);
            setUpdated(true);
            saveAssetText(id, e.target.value).then(() => {
              evt.markModified(id);
              evt.markPublishDirty(id);
            }).catch(() => {});
          }}
        />
      );
    } else {
      // その他バイナリ: MIMEタイプが表示不可形式
      content = (
        <div style={{ padding: '24px' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 1 }}>
            {t("assetViewer.binaryNotSupported", { name })}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-tertiary)', display: 'block', mb: 2 }}>
            {t("assetViewer.currentMime", { mime: mime || 'unknown' })}
          </Typography>
          <Button size="small" variant="outlined" onClick={handleOpenMimeFixDlg}
            sx={{ fontSize: '12px', textTransform: 'none', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}>
            {t("assetViewer.fixMimeType")}
          </Button>
        </div>
      );
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* メニューバー */}
      <div id="previewMenu">
        <div className="previewMenuLeft">
          <Tooltip title={t("assetViewer.updateFile")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="update file" onClick={handleUpdateFile} disabled={updating || !id} className="editorBtn">
                <AttachFileIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
          {assetContent && (isSvgMime(assetContent.mime) || isHtmlMime(assetContent.mime)) && (
            <Tooltip title={showPreview ? t("assetViewer.editSource") : t("assetViewer.showPreview")} placement="bottom">
              <span>
                <IconButton size="small" onClick={() => setShowPreview(v => !v)} className="editorBtn">
                  {showPreview ? <CodeIcon sx={{ fontSize: '16px' }} /> : <VisibilityIcon sx={{ fontSize: '16px' }} />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>
        <div className="previewMenuRight">
          <Tooltip title={t("preview.download")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="download" onClick={handleDownload} disabled={!assetContent || !id} className="editorBtn">
                <DownloadIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
          <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />
          <IconButton
            size="small"
            onClick={(e) => openMoreMenu(e.currentTarget)}
            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' }, padding: '5px 0px' }}
          >
            <MoreVertIcon sx={{ fontSize: '18px' }} />
          </IconButton>
        </div>
      </div>

      {/* MoreVert ドロップダウンメニュー */}
      <Menu
        open={moreMenu.open}
        anchorEl={moreMenu.el ?? undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClose={closeMoreMenu}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        {assetContent && isImageMime(assetContent.mime) && (
          <MenuItem onClick={() => { closeMoreMenu(); handleSetMetaImage(); }} disabled={!id}>
            <ImageIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("assetViewer.setMetaImage")}
          </MenuItem>
        )}
        {assetContent && isTextMime(assetContent.mime) && (
          <MenuItem onClick={() => { closeMoreMenu(); handleMigrate(); }} disabled={migrating || !id}>
            <NoteAddIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("assetViewer.migrate")}
          </MenuItem>
        )}
        {assetContent && isTextMime(assetContent.mime) && (
          <MenuItem onClick={(e) => { e.stopPropagation(); setTextDownloadMenuAnchor(e.currentTarget); }} sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><DownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.download")}</span><span>▶</span>
          </MenuItem>
        )}
        {assetContent && (isImageMime(assetContent.mime) || isTextMime(assetContent.mime)) && <Divider />}
        <MenuItem onClick={() => { closeMoreMenu(); handleGenerate(); }} disabled={generating || !id}>
          <PublishIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.publish")}
        </MenuItem>
        <MenuItem onClick={() => { closeMoreMenu(); handleOpenInBrowser(); }} disabled={!assetMeta?.alias}>
          <OpenInBrowserIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.openBrowser")}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { closeMoreMenu(); handleUnpublish(); }} disabled={!id}>
          <UnpublishedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.unpublish")}
        </MenuItem>
      </Menu>
      {/* テキストダウンロードサブメニュー */}
      <Menu
        open={Boolean(textDownloadMenuAnchor)}
        onClose={() => setTextDownloadMenuAnchor(null)}
        anchorEl={textDownloadMenuAnchor}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        <MenuItem onClick={handleDownloadRaw}>{t("tree.downloadText")}</MenuItem>
        <MenuItem onClick={handleDownloadExpanded}>{t("tree.downloadExpanded")}</MenuItem>
      </Menu>

      {/* コンテンツ */}
      <div className="assetTextEditor" style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {content}
      </div>

      {/* ステータスバー */}
      <CommitBar
        comment={comment}
        onCommentChange={setComment}
        updated={updated}
        onCommit={handleCommit}
      />

      {/* ノート移行確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t("assetViewer.migrateTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            {t("assetViewer.migrateConfirm", { name: assetName })}
          </DialogContentText>
          <FormControlLabel
            control={
              <Checkbox
                checked={migrateDeleteAsset}
                onChange={(e) => setMigrateDeleteAsset(e.target.checked)}
              />
            }
            label={t("assetViewer.migrateDeleteAsset")}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setConfirmOpen(false)} />
          <ActionButton variant="save" label={t("common.ok")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleMigrateConfirm} />
        </DialogActions>
      </Dialog>

      {/* メタ画像設定確認ダイアログ */}
      <Dialog open={metaImageDlg} onClose={() => setMetaImageDlg(false)}>
        <DialogTitle>{t("assetViewer.setMetaImageTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            {t("assetViewer.setMetaImageConfirm", { name: assetName })}
          </DialogContentText>
          <FormControlLabel
            control={
              <Checkbox
                checked={metaImageDeleteAsset}
                onChange={(e) => setMetaImageDeleteAsset(e.target.checked)}
              />
            }
            label={t("assetViewer.setMetaImageDeleteAsset")}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setMetaImageDlg(false)} />
          <ActionButton variant="save" label={t("common.ok")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleSetMetaImageConfirm} />
        </DialogActions>
      </Dialog>

      {/** 未公開確認ダイアログ */}
      <Dialog open={unpublishConfirm} onClose={() => setUnpublishConfirm(false)}>
        <DialogTitle>{t("preview.unpublishConfirm")}</DialogTitle>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishConfirm(false)} />
          <ActionButton variant="delete" label={t("preview.unpublish")} icon={<UnpublishedIcon />} onClick={doUnpublish} />
        </DialogActions>
      </Dialog>

      {/** MIMEタイプ修正ダイアログ */}
      <Dialog open={mimeFixDlg} onClose={() => setMimeFixDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("assetViewer.fixMimeTypeTitle")}</DialogTitle>
        <DialogContent>
          {detectedMime && (
            <DialogContentText sx={{ fontSize: '13px', color: 'var(--text-secondary)', mb: 2 }}>
              {t("assetViewer.detectedMime", { mime: detectedMime })}
            </DialogContentText>
          )}
          <Select
            value={selectedMime}
            onChange={(e) => setSelectedMime(e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            sx={{ mt: 1, color: 'var(--text-primary)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-input)' } }}
          >
            <MenuItem value="" disabled sx={{ fontSize: '13px' }}>{t("assetViewer.selectMimeType")}</MenuItem>
            <ListSubheader sx={{ fontSize: '11px', lineHeight: '24px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-elevated)' }}>{t("assetViewer.mimeGroupImage")}</ListSubheader>
            {MIME_OPTIONS.filter(o => o.group === 'image').map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: '13px' }}>{o.label} <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.value}</span></MenuItem>
            ))}
            <ListSubheader sx={{ fontSize: '11px', lineHeight: '24px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-elevated)' }}>{t("assetViewer.mimeGroupText")}</ListSubheader>
            {MIME_OPTIONS.filter(o => o.group === 'text').map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: '13px' }}>{o.label} <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.value}</span></MenuItem>
            ))}
            <ListSubheader sx={{ fontSize: '11px', lineHeight: '24px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-elevated)' }}>{t("assetViewer.mimeGroupOther")}</ListSubheader>
            {MIME_OPTIONS.filter(o => o.group === 'other').map(o => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: '13px' }}>{o.label} <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.value}</span></MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setMimeFixDlg(false)} />
          <ActionButton variant="save" label={t("common.save")} icon={<CheckIcon />} onClick={handleMimeFix} disabled={!selectedMime} />
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default AssetViewer;

import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControlLabel, IconButton, Menu, MenuItem, TextField, Tooltip } from '@mui/material';
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

import { GetAsset, GetAssetContent, EditAsset, Generate, Unpublish, Commit, MigrateAssetToNote, SetAssetAsMetaImage, GetFont, SaveAssetContent, GetModifiedIds, Address } from '../../bindings/binder/api/app';
import CommitBar from './CommitBar';
import EditorArea from './editor/EditorArea';
import { Events, Browser } from '@wailsio/runtime';
import { SelectFile } from '../../bindings/main/window';
import { EventContext } from '../Event';
import { ActionButton } from '../dialogs/components/ActionButton';
import "../language";
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
  const [serverAddress, setServerAddress] = useState('');
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

  useEffect(() => {
    Address().then((addr) => setServerAddress(addr)).catch(() => {});
  }, []);

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
      // テキストアセットの場合、base64デコードして編集用stateに設定
      if (resp && isTextMime(resp.mime)) {
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
    if (!a || !serverAddress) return;
    Browser.OpenURL(`${serverAddress}/assets/${a}`);
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
  const handleUnpublish = () => {
    Unpublish("assets", id).then(() => {
      evt.showSuccessMessage(t("assetViewer.unpublishSuccess"));
    }).catch((e) => {
      evt.showErrorMessage(t("assetViewer.unpublishError", { error: e }));
    });
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
      // テキストファイル: EditorArea（行番号付き、デバウンス自動保存）
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
          <Tooltip title={t("assetViewer.updateFile")} placement="bottom">
            <span>
              <IconButton size="small" aria-label="update file" onClick={handleUpdateFile} disabled={updating || !id} className="editorBtn">
                <AttachFileIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
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
    </div>
  );
}

export default AssetViewer;

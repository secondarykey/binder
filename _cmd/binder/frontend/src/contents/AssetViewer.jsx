import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

import { GetAsset, GetAssetContent, Generate, Unpublish, GetSetting, MigrateAssetToNote } from '../../bindings/binder/api/app';
import { EventContext } from '../Event';

/** 画像拡張子の判定セット */
const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']);

/**
 * ファイル名の拡張子から MIME タイプを返す
 */
function getMimeType(name) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png':  return 'image/png';
    case 'gif':  return 'image/gif';
    case 'svg':  return 'image/svg+xml';
    case 'webp': return 'image/webp';
    case 'bmp':  return 'image/bmp';
    case 'ico':  return 'image/x-icon';
    default:     return 'application/octet-stream';
  }
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

  // ロード中: assetContent=null, error=null
  // 成功:     assetContent=object, error=null
  // エラー:   assetContent=null, error=string, assetName=string
  const [assetContent, setAssetContent] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // ソースエディタと同じフォント設定
  const [editorStyle, setEditorStyle] = useState({});

  useEffect(() => {
    GetSetting().then((s) => {
      const t = s.lookAndFeel.editor.text;
      setEditorStyle({
        fontFamily: t.name,
        fontSize: t.size + 'px',
        color: t.color,
        backgroundColor: t.backgroundColor,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setAssetContent(null);
    setAssetName('');
    setError(null);

    // メタデータ取得（タイトルはファイルが見つからなくても表示したい）
    GetAsset(id).then((meta) => {
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
      setError('ファイルの内容を読み込めませんでした。ファイルがディスク上に存在しない可能性があります。');
    });
  }, [id]);

  /** Generate ボタン押下: アセットを公開する */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await Generate("assets", id, "");
      evt.showSuccessMessage("Generate が完了しました。");
    } catch (e) {
      evt.showErrorMessage("Generate に失敗しました: " + e);
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
      evt.showSuccessMessage("ノートに移行しました。");
      nav(`/editor/note/${note.id}`);
    } catch (e) {
      evt.showErrorMessage("移行に失敗しました: " + e);
    } finally {
      setMigrating(false);
    }
  };

  /** Unpublish ボタン押下: docs からアセットを削除する */
  const handleUnpublish = () => {
    Unpublish("assets", id).then(() => {
      evt.showSuccessMessage("Unpublish が完了しました。");
    }).catch((e) => {
      evt.showErrorMessage("Unpublish に失敗しました: " + e);
    });
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
    const { name, binary, content: fileContent } = assetContent;
    const ext     = name.split('.').pop()?.toLowerCase() ?? '';
    const isImage = binary && imageExts.has(ext);

    if (isImage) {
      const mime = getMimeType(name);
      content = (
        <ImageViewer
          src={`data:${mime};base64,${fileContent}`}
          alt={name}
        />
      );
    } else if (!binary) {
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
          バイナリファイルのため表示できません: {name}
        </div>
      );
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {content}
      {/* フローティングノート移行ボタン（テキストアセットのみ表示、右上） */}
      {assetContent && !assetContent.binary && (
        <IconButton
          className="floatTopRightBtn"
          size="small"
          aria-label="migrate to note"
          onClick={handleMigrate}
          disabled={migrating || !id}
        >
          <NoteAddIcon fontSize="small" style={{ color: "var(--text-primary)" }} />
        </IconButton>
      )}
      {/* フローティング公開ボタン（右下） */}
      <IconButton
        className="floatPublishBtn"
        size="small"
        aria-label="publish"
        onClick={handleGenerate}
        disabled={generating || !id}
      >
        <PublishIcon fontSize="small" style={{ color: "var(--text-primary)" }} />
      </IconButton>
      {/* フローティング非公開ボタン（左下） */}
      <IconButton
        className="floatUnpublishBtn"
        size="small"
        aria-label="unpublish"
        onClick={handleUnpublish}
        disabled={!id}
      >
        <UnpublishedIcon fontSize="small" style={{ color: "var(--text-primary)" }} />
      </IconButton>

      {/* ノート移行確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>ノートに移行</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: "var(--text-secondary)" }}>
            「{assetName}」をノートに移行します。元のアセットは削除されます。よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleMigrateConfirm} color="primary">移行</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default AssetViewer;

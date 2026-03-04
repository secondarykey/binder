import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router';

import { GetAsset, GetAssetContent } from '../../bindings/binder/api/app';
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
 * アセットビューア
 * - テキストファイル: テキスト表示
 * - 画像ファイル: 画像表示
 * - その他バイナリ: 非表示通知
 * - ファイルが見つからない場合: メッセージ表示
 */
function AssetViewer() {
  const evt = useContext(EventContext);
  const { id } = useParams();

  // ロード中: assetContent=null, error=null
  // 成功:     assetContent=object, error=null
  // エラー:   assetContent=null, error=string, assetName=string
  const [assetContent, setAssetContent] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [error, setError] = useState(null);

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

  // エラー状態
  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        {assetName && (
          <div style={{ marginBottom: '8px', color: '#ccc', fontSize: '13px' }}>{assetName}</div>
        )}
        <div style={{ color: '#f88' }}>{error}</div>
      </div>
    );
  }

  // ロード中
  if (!assetContent) {
    return (
      <div style={{ padding: '16px', color: '#aaa' }}>Loading...</div>
    );
  }

  const { name, binary, content } = assetContent;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = binary && imageExts.has(ext);

  if (isImage) {
    const mime = getMimeType(name);
    return (
      <div style={{ padding: '16px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
        <img
          src={`data:${mime};base64,${content}`}
          alt={name}
          style={{ maxWidth: '100%', display: 'block' }}
        />
      </div>
    );
  }

  if (!binary) {
    // テキストファイル: base64 → UTF-8 テキスト
    let text = '';
    try {
      text = decodeURIComponent(escape(atob(content)));
    } catch {
      text = atob(content);
    }
    return (
      <div style={{ padding: '16px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.5',
        }}>
          {text}
        </pre>
      </div>
    );
  }

  // その他バイナリ
  return (
    <div style={{ padding: '16px', color: '#aaa' }}>
      バイナリファイルのため表示できません: {name}
    </div>
  );
}

export default AssetViewer;

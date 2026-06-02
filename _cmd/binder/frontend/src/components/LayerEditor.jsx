import { useState, useEffect, useContext, useRef } from 'react';
import { useParams } from 'react-router';
import { Box, Paper, ToggleButton, ToggleButtonGroup, IconButton, Tooltip, TextField, Typography, Divider, Menu, MenuItem, FormControl, InputLabel, Select, Dialog, DialogTitle, DialogActions } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import NearMeIcon from '@mui/icons-material/NearMe';
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import PublishIcon from '@mui/icons-material/Publish';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TimelineIcon from '@mui/icons-material/Timeline';
import GestureIcon from '@mui/icons-material/Gesture';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import { GetLayerWithParent, GetLayerContent, SaveLayerContent, Address, Generate, Unpublish, Commit, GetModifiedIds } from '../../bindings/binder/api/app';
import { GetFontNames } from '../../bindings/binder/api/shared/shared';
import { Browser } from '@wailsio/runtime';
import CommitBar from './CommitBar';
import { ActionButton } from '../dialogs/components/ActionButton';
import { EventContext } from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';
import '../assets/Editor.css';

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const defaultShapeProps = {
  color: '#ff0000',
  // strokeWidth はピクセル単位 (vector-effect="non-scaling-stroke" のため
  // 画像の表示サイズに依らず常に同じ太さで描画される)。
  strokeWidth: 5,
  fill: 'none',
};

// 新規テキストのデフォルトフォントサイズ (px)。
const DEFAULT_FONT_SIZE_PX = 16;
// フォントサイズ fallback 用の想定画像高さ (px)。実計測できない場面で使用。
const DEFAULT_REFERENCE_HEIGHT_PX = 400;

// 過去の正規化座標ベースの strokeWidth (< 1) を legacy とみなし、
// 400 倍してピクセル単位 (0.005 → 2) にマップする。
// Go 側 normalizeStrokeWidth と同一ロジック。
const normalizeStrokeWidth = (sw) => {
  if (!sw || sw <= 0) return 2;
  if (sw < 1) return sw * 400;
  return sw;
};

// フォントサイズを「viewBox (0-1) 座標系」の値に正規化する。
// 新形式: px 単位で保存 (>= 1)。表示時に svg の表示高さ (px) で割って
// viewBox y 座標の割合に変換。画像を自然サイズで表示しているとき
// 指定 px で描画される。legacy (< 1) は従来の正規化値としてそのまま使う。
// Go 側 normalizeFontSizeViewBox と同一ロジック。
const effectiveFontSizeVB = (fontSize, svgHeightPx) => {
  const raw = fontSize && fontSize > 0 ? fontSize : DEFAULT_FONT_SIZE_PX;
  if (raw < 1) return raw; // legacy normalized
  const h = svgHeightPx > 0 ? svgHeightPx : DEFAULT_REFERENCE_HEIGHT_PX;
  return raw / h;
};

// テキストの改行行数を返す (空文字でも 1 行とする)。
const textLineCount = (text) => {
  if (!text) return 1;
  const n = text.split('\n').length;
  return n > 0 ? n : 1;
};

// テキスト行間係数 (em 単位)。SVG <tspan dy="1.2em"> と一致させる。
const TEXT_LINE_HEIGHT = 1.2;

// lineSpacing (px) を viewBox y 単位へ変換する。Go 側 lineSpacingViewBox と同一。
const lineSpacingVB = (lineSpacingPx, svgHeightPx) => {
  if (!lineSpacingPx || lineSpacingPx <= 0) return 0;
  const h = svgHeightPx > 0 ? svgHeightPx : DEFAULT_REFERENCE_HEIGHT_PX;
  return lineSpacingPx / h;
};

// 複数行テキストの連続する行間の dy 値 (viewBox y 単位) を返す。
// = 通常行間 (1.2em = 1.2 * fs_vb) + lineSpacing_vb。
// Go 側 lineDyViewBox と同一ロジック。
const lineDyVB = (s, svgHeightPx) => {
  const fs = effectiveFontSizeVB(s.fontSize, svgHeightPx);
  const ls = lineSpacingVB(s.lineSpacing, svgHeightPx);
  return fs * TEXT_LINE_HEIGHT + ls;
};

// テキスト全体の高さ (viewBox y 単位)。
// dominant-baseline="hanging" で y は最上行の top、各行は lineDy (viewBox 単位) 下へ。
// 全体高 = fs_vb + (n-1) * lineDy_vb。
const textTotalHeight = (s, svgHeightPx = 0) => {
  const fs = effectiveFontSizeVB(s.fontSize, svgHeightPx);
  const n = textLineCount(s.text);
  if (n <= 1) return fs;
  return fs + (n - 1) * lineDyVB(s, svgHeightPx);
};

// 選択中 shape のバウンディングボックスを計算
// imgAspect: 親画像の width/height。text はレンダ時に x 方向を 1/aspect 倍するため
// viewBox 上の実幅も 1/aspect 倍となる。
const getBBox = (s, imgAspect = 1, svgHeightPx = 0) => {
  if (!s) return null;
  if (s.type === 'line') {
    return {
      x: Math.min(s.x1, s.x2),
      y: Math.min(s.y1, s.y2),
      width: Math.abs(s.x2 - s.x1),
      height: Math.abs(s.y2 - s.y1),
    };
  }
  if (s.type === 'polyline') {
    const pts = s.points || [];
    if (pts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (s.type === 'curve') {
    const xs = [s.x1, s.cpx, s.x2];
    const ys = [s.y1, s.cpy, s.y2];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (s.type === 'rect') {
    return { x: s.x, y: s.y, width: s.width, height: s.height };
  }
  if (s.type === 'ellipse') {
    return { x: s.cx - s.rx, y: s.cy - s.ry, width: s.rx * 2, height: s.ry * 2 };
  }
  if (s.type === 'text') {
    // プロポーショナルフォントは文字ごとに幅が異なるため、文字数ベースの
    // 可変サイズは採用せず「高さと同じサイズの正方形アンカー」を返す。
    // 正規化 (0-1) x 空間では fs/aspect、レンダ時に vbX で aspect 倍されて
    // viewBox-x では fs となり、等比スケールの viewBox で fs × fs 正方形になる。
    // 複数行のときは height を行数分に伸ばす（幅は最初の行アンカー相当のまま）。
    const fs = effectiveFontSizeVB(s.fontSize, svgHeightPx);
    const aspect = imgAspect > 0 ? imgAspect : 1;
    return { x: s.x, y: s.y, width: fs / aspect, height: textTotalHeight(s, svgHeightPx) };
  }
  return null;
};

// 選択中 shape に表示するリサイズハンドル位置を計算
const getHandles = (s, imgAspect = 1, svgHeightPx = 0) => {
  if (!s) return [];
  if (s.type === 'line') {
    return [
      { id: 'start', x: s.x1, y: s.y1, cursor: 'move' },
      { id: 'end', x: s.x2, y: s.y2, cursor: 'move' },
    ];
  }
  if (s.type === 'polyline') {
    return (s.points || []).map((p, i) => ({
      id: `pt-${i}`, x: p.x, y: p.y, cursor: 'move',
    }));
  }
  if (s.type === 'curve') {
    return [
      { id: 'start', x: s.x1, y: s.y1, cursor: 'move' },
      { id: 'end', x: s.x2, y: s.y2, cursor: 'move' },
      { id: 'cp', x: s.cpx, y: s.cpy, cursor: 'move', isControlPoint: true },
    ];
  }
  if (s.type === 'rect') {
    const x2 = s.x + s.width;
    const y2 = s.y + s.height;
    return [
      { id: 'nw', x: s.x, y: s.y, cursor: 'nwse-resize' },
      { id: 'ne', x: x2, y: s.y, cursor: 'nesw-resize' },
      { id: 'sw', x: s.x, y: y2, cursor: 'nesw-resize' },
      { id: 'se', x: x2, y: y2, cursor: 'nwse-resize' },
    ];
  }
  if (s.type === 'ellipse') {
    return [
      { id: 'nw', x: s.cx - s.rx, y: s.cy - s.ry, cursor: 'nwse-resize' },
      { id: 'ne', x: s.cx + s.rx, y: s.cy - s.ry, cursor: 'nesw-resize' },
      { id: 'sw', x: s.cx - s.rx, y: s.cy + s.ry, cursor: 'nesw-resize' },
      { id: 'se', x: s.cx + s.rx, y: s.cy + s.ry, cursor: 'nwse-resize' },
    ];
  }
  if (s.type === 'text') {
    // テキストは右下ハンドルのみでフォントサイズを調整
    const bbox = getBBox(s, imgAspect, svgHeightPx);
    return [
      { id: 'se', x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: 'nwse-resize' },
    ];
  }
  return [];
};

// ハンドル操作時の固定点（ドラッグする点と対になる位置）を返す
const getFixedPoint = (s, handle) => {
  if (s.type === 'line') {
    if (handle === 'start') return { x: s.x2, y: s.y2 };
    if (handle === 'end') return { x: s.x1, y: s.y1 };
  } else if (s.type === 'polyline') {
    return null;
  } else if (s.type === 'curve') {
    if (handle === 'start') return { x: s.x2, y: s.y2 };
    if (handle === 'end') return { x: s.x1, y: s.y1 };
    if (handle === 'cp') return null;
  } else if (s.type === 'rect') {
    const x2 = s.x + s.width;
    const y2 = s.y + s.height;
    if (handle === 'nw') return { x: x2, y: y2 };
    if (handle === 'ne') return { x: s.x, y: y2 };
    if (handle === 'sw') return { x: x2, y: s.y };
    if (handle === 'se') return { x: s.x, y: s.y };
  } else if (s.type === 'ellipse') {
    if (handle === 'nw') return { x: s.cx + s.rx, y: s.cy + s.ry };
    if (handle === 'ne') return { x: s.cx - s.rx, y: s.cy + s.ry };
    if (handle === 'sw') return { x: s.cx + s.rx, y: s.cy - s.ry };
    if (handle === 'se') return { x: s.cx - s.rx, y: s.cy - s.ry };
  } else if (s.type === 'text') {
    // text は se ハンドルのみ。固定点は左上 (x, y)
    if (handle === 'se') return { x: s.x, y: s.y };
  }
  return null;
};

// shape の視覚中心を正規化座標 (0-1) で返す。rotation の回転中心に使う。
// text は viewBox 上の正方形 (fs × fs) の中心なので、正規化 x では
// アンカー + fs/(2*aspect) となる。
const getShapeCenter = (s, imgAspect = 1, svgHeightPx = 0) => {
  if (!s) return { x: 0.5, y: 0.5 };
  if (s.type === 'line') return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
  if (s.type === 'polyline') {
    const pts = s.points || [];
    if (pts.length === 0) return { x: 0.5, y: 0.5 };
    const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { x: sx, y: sy };
  }
  if (s.type === 'curve') return { x: (s.x1 + s.cpx + s.x2) / 3, y: (s.y1 + s.cpy + s.y2) / 3 };
  if (s.type === 'rect') return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  if (s.type === 'ellipse') return { x: s.cx, y: s.cy };
  if (s.type === 'text') {
    const fs = effectiveFontSizeVB(s.fontSize, svgHeightPx);
    const aspect = imgAspect > 0 ? imgAspect : 1;
    // 複数行の場合、中心 y は行数ぶんのテキスト全体高の中央。
    return { x: s.x + fs / (2 * aspect), y: s.y + textTotalHeight(s, svgHeightPx) / 2 };
  }
  return { x: 0.5, y: 0.5 };
};

// (px, py) を (cx, cy) 中心に angleDeg 度回転する（時計回り、SVG と同じ向き）。
const rotatePoint = (px, py, cx, cy, angleDeg) => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
};

// Shift キーが押された状態で線を引く際に、(pivotX, pivotY) から (x, y) への
// 方向を 45度 刻み (水平・垂直・斜め 45度) にスナップした端点を返す。
// 入力・出力はいずれも正規化座標 (0-1)。viewBox が "0 0 aspect 1" で等比
// スケールされて表示されるため、aspect を掛けた viewBox 座標で角度判定し、
// 投影距離も viewBox 空間で計算する。これで aspect != 1 でも表示上の
// 45度 が保たれる。
const snapAngle = (pivotX, pivotY, x, y, aspect) => {
  const a = aspect > 0 ? aspect : 1;
  const dxvb = (x - pivotX) * a;
  const dyvb = y - pivotY;
  if (dxvb === 0 && dyvb === 0) return { x, y };
  const angle = Math.atan2(dyvb, dxvb);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const len = Math.hypot(dxvb, dyvb);
  const nx = Math.cos(snapped) * len;
  const ny = Math.sin(snapped) * len;
  return { x: pivotX + nx / a, y: pivotY + ny };
};

const ARROW_WING_FACTOR = 3.5;
const ARROW_WING_ANGLE = Math.PI / 6; // 30 degrees

const LINE_TOOL_TYPES = ['line', 'polyline', 'curve'];
const ARROW_HEAD_OPTIONS = ['none', 'end', 'start', 'both'];
const DEFAULT_ARROW_SIZE = 5;

const lineToolIcon = (type) => {
  const sx = { fontSize: '16px' };
  switch (type) {
    case 'polyline': return <TimelineIcon sx={sx} />;
    case 'curve': return <GestureIcon sx={sx} />;
    default: return <RemoveIcon sx={sx} />;
  }
};

/**
 * Layer の描画エディタ。
 * 画像アセットビューアと同レイアウト（上: メニューバー、中: キャンバス、下: ステータスバー）。
 * 図形一覧・プロパティはキャンバス右上のフローティングパネルに表示する。
 * 変更は debounce で自動保存される。
 */
function LayerEditor() {
  const { id } = useParams();
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [layer, setLayer] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [shapes, setShapes] = useState([]);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [dragging, setDragging] = useState(null); // { shapeId, startX, startY, orig }
  const [resizing, setResizing] = useState(null); // { shapeId, handle, orig, fixed }
  const [rotating, setRotating] = useState(null); // { shapeId, orig, center, startAngle }
  const [ctxMenu, setCtxMenu] = useState(null); // { mouseX, mouseY, shapeId }
  const [generating, setGenerating] = useState(false);
  const [moreMenu, setMoreMenu] = useState({ open: false, el: null });
  const [lineSubMenu, setLineSubMenu] = useState(null);
  const [lineToolType, setLineToolType] = useState('line');
  const [polylinePoints, setPolylinePoints] = useState([]);
  const [comment, setComment] = useState('');
  const [updated, setUpdated] = useState(false);

  // フローティングパネルの位置（canvas コンテナの右上を原点とする top/right 指定）
  const [panelPos, setPanelPos] = useState({ top: 12, right: 12 });
  const [panelDrag, setPanelDrag] = useState(null); // { startX, startY, origTop, origRight, containerWidth }

  // フォント一覧（テキスト shape の font-family 設定用）
  const [fontNames, setFontNames] = useState([]);

  // 親画像のアスペクト比 (width/height)。viewBox="0 0 1 1" + preserveAspectRatio="none"
  // の引き伸ばしでテキスト字形が歪むため、text レンダリング時に x 方向を 1/aspect 倍する。
  const [imgAspect, setImgAspect] = useState(1);

  // 親画像の自然サイズ（ピクセル）高さ。フォントサイズ計算の基準に使う。
  // Go 側の normalizeFontSizeViewBox は自然サイズを基準にするため、エディタ側も
  // 表示サイズではなく自然サイズを使うことで WYSIWYG が保たれる。
  const [imgNaturalHeight, setImgNaturalHeight] = useState(0);

  // 画像の自然サイズを ref で保持（イベントハンドラから参照するため）。
  const imgNaturalRef = useRef({ w: 0, h: 0 });

  // ImageViewer と同じ transform ベースの表示。
  // tfRef: translate/scale を ref で保持し、直接 DOM style に適用（余分な再レンダを避ける）。
  // wrapperRef: img + svg を囲むラッパー（transform 適用先）。
  // panRef: ドラッグ中の初期情報（null = パン未開始）。
  const tfRef      = useRef({ left: 0, top: 0, scale: 1 });
  const wrapperRef = useRef(null);
  const panRef     = useRef(null); // { startX, startY, origLeft, origTop }
  // ズーム倍率の React state（レンダリングが必要なハンドルサイズ計算に使う）。
  const [zoomScale, setZoomScale] = useState(1);

  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);
  // ダブルクリックで text shape の編集 TextField にフォーカスを移すため ref を保持する。
  const textInputRef = useRef(null);
  // ダブルクリックでフォーカス予約中か。選択→描画→props panel 再レンダの後に
  // フォーカスを当てるため、useEffect で遅延実行する。
  const focusTextOnNextRenderRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    loadedRef.current = false;
    let cancelled = false;

    Promise.all([
      GetLayerWithParent(id),
      GetLayerContent(id),
      Address(),
    ]).then(([lw, content, addr]) => {
      if (cancelled) return;
      setLayer(lw);
      setServerAddress(addr);
      if (lw?.name) setComment('Updated: ' + lw.name);
      if (lw?.parentId) {
        setImageUrl(`${addr}/binder-assets/${lw.parentId}`);
      }
      try {
        const parsed = content ? JSON.parse(content) : { shapes: [] };
        setShapes(Array.isArray(parsed.shapes) ? parsed.shapes : []);
      } catch {
        setShapes([]);
      }
      setTimeout(() => { if (!cancelled) loadedRef.current = true; }, 0);
    }).catch((err) => { if (!cancelled) evt.showErrorMessage(err); });

    GetModifiedIds().then((ids) => {
      if (!cancelled) setUpdated((ids ?? []).includes(id));
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [id]);

  // フォント一覧の取得（テキスト shape の font-family 候補）
  useEffect(() => {
    GetFontNames()
      .then((names) => setFontNames(Array.isArray(names) ? names : []))
      .catch((err) => evt.showErrorMessage(err));
  }, []);

  // imageUrl が変わったとき（親アセットが異なるレイヤーへ切り替え）のみリセット。
  // 同一 imageUrl ならリセット不要（onLoad が再発火しないため transform を維持する）。
  useEffect(() => {
    imgNaturalRef.current = { w: 0, h: 0 };
    tfRef.current = { left: 0, top: 0, scale: 1 };
    if (wrapperRef.current) wrapperRef.current.style.transform = '';
    setZoomScale(1);
  }, [imageUrl]);

  // ホイールズーム。ブラウザのデフォルトスクロールを抑制するため passive: false。
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.target.closest && e.target.closest('.layerFloatingPanel')) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const next = Math.max(0.1, Math.round((tfRef.current.scale + delta) * 10) / 10);
      tfRef.current.scale = next;
      if (wrapperRef.current) {
        const { left, top } = tfRef.current;
        wrapperRef.current.style.transform = `translate(${left}px, ${top}px) scale(${next})`;
      }
      setZoomScale(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // shapes 変更時の自動保存（debounce）
  useEffect(() => {
    if (!id) return;
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      SaveLayerContent(id, JSON.stringify({ shapes }))
        .then(() => {
          if (evt?.markModified) evt.markModified(id);
          setUpdated(true);
        })
        .catch((err) => evt.showErrorMessage(err));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [shapes, id]);

  // transform を wrapperRef の DOM style に直接適用する（再レンダ不要）。
  const applyTransform = () => {
    if (!wrapperRef.current) return;
    const { left, top, scale } = tfRef.current;
    wrapperRef.current.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  };

  // ImageViewer と同じ fit + center 計算でトランスフォームを初期化する。
  // 画像ロード時・同一 URL で別レイヤーに切り替えた時に呼ぶ。
  const fitToCanvas = () => {
    const container = canvasRef.current;
    const { w: iw, h: ih } = imgNaturalRef.current;
    if (!container || !iw || !ih) return;
    const PADDING = 16;
    const cw = Math.max(1, container.clientWidth - PADDING * 2);
    const ch = Math.max(1, container.clientHeight - PADDING * 2);
    const scale = Math.min(1, cw / iw, ch / ih);
    const left = PADDING + (cw - iw * scale) / 2;
    const top  = PADDING + (ch - ih * scale) / 2;
    tfRef.current = { left, top, scale };
    applyTransform();
    setZoomScale(scale);
  };

  // キャンバス背景 or 空の SVG 領域でのドラッグをパンとして扱う。
  // shape の handleShapePointerDown が stopPropagation するため、
  // shape をクリックした場合はここに届かず shape 操作が優先される。
  const handleCanvasPanStart = (e) => {
    if (e.button !== 1) return; // ホイールクリック（中ボタン）のみパン
    e.preventDefault(); // ブラウザのオートスクロールモードを抑制
    panRef.current = { startX: e.clientX, startY: e.clientY,
                       origLeft: tfRef.current.left, origTop: tfRef.current.top };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const handleCanvasPanMove = (e) => {
    if (!panRef.current) return;
    tfRef.current.left = panRef.current.origLeft + (e.clientX - panRef.current.startX);
    tfRef.current.top  = panRef.current.origTop  + (e.clientY - panRef.current.startY);
    applyTransform();
  };
  const handleCanvasPanEnd = () => {
    panRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = '';
  };

  const toClientPos = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    if (tool === 'select') return;
    const { x, y } = toClientPos(e);
    const base = { id: uuid(), ...defaultShapeProps };
    let shape;
    if (tool === 'line') {
      shape = { ...base, type: 'line', x1: x, y1: y, x2: x, y2: y };
    } else if (tool === 'polyline') {
      if (polylinePoints.length === 0) {
        setPolylinePoints([{ x, y }]);
        setDrawing({
          shape: { ...base, type: 'polyline', points: [{ x, y }, { x, y }] },
          startX: x, startY: y,
        });
      } else {
        setPolylinePoints((prev) => [...prev, { x, y }]);
        setDrawing((prev) => {
          if (!prev) return prev;
          const pts = [...polylinePoints, { x, y }, { x, y }];
          return { ...prev, shape: { ...prev.shape, points: pts } };
        });
      }
      return;
    } else if (tool === 'curve') {
      shape = { ...base, type: 'curve', x1: x, y1: y, x2: x, y2: y, cpx: x, cpy: y };
    } else if (tool === 'rect') {
      shape = { ...base, type: 'rect', x, y, width: 0, height: 0 };
    } else if (tool === 'ellipse') {
      shape = { ...base, type: 'ellipse', cx: x, cy: y, rx: 0, ry: 0 };
    } else if (tool === 'text') {
      const textShape = {
        ...base,
        type: 'text',
        x, y,
        text: t("layer.defaultText"),
        fontSize: DEFAULT_FONT_SIZE_PX,
      };
      setShapes((prev) => [...prev, textShape]);
      setSelectedId(textShape.id);
      setTool('select');
      return;
    } else {
      return;
    }
    setDrawing({ shape, startX: x, startY: y });
  };

  const handlePointerMove = (e) => {
    // 回転中
    if (rotating) {
      const { x, y } = toClientPos(e);
      const { orig, center, startAngle } = rotating;
      // 回転の角度計算は viewBox 座標 (x 側を aspect 倍) で行う。
      const curAngle = Math.atan2(y - center.y, (x - center.x) * aspect);
      const deltaDeg = ((curAngle - startAngle) * 180) / Math.PI;
      let newRot = (orig.rotation || 0) + deltaDeg;
      // 0-360 に正規化。Shift 押下で 45度 スナップ、通常は 1度 単位。
      newRot = ((newRot % 360) + 360) % 360;
      newRot = e.shiftKey ? Math.round(newRot / 45) * 45 % 360 : Math.round(newRot) % 360;
      setShapes((prev) => prev.map((s) => (s.id === rotating.shapeId ? { ...s, rotation: newRot } : s)));
      return;
    }
    // リサイズ中
    if (resizing) {
      let { x, y } = toClientPos(e);
      const { orig, handle, fixed } = resizing;
      // shape が回転している場合、ポインタを逆回転して local frame で計算する。
      // 回転は viewBox 座標系 (x 側が aspect 倍) で行われているため、
      // 一旦 viewBox に写してから逆回転し、正規化座標へ戻す。
      if (orig.rotation) {
        const c = getShapeCenter(orig, aspect, naturalH);
        const p = rotatePoint(
          x * aspect, y,
          c.x * aspect, c.y,
          -orig.rotation
        );
        x = p.x / aspect;
        y = p.y;
      }
      let resized = orig;
      if (orig.type === 'line' || orig.type === 'arrow') {
        let ex = x, ey = y;
        if (e.shiftKey && fixed) {
          const p = snapAngle(fixed.x, fixed.y, x, y, aspect);
          ex = p.x; ey = p.y;
        }
        if (handle === 'start') resized = { ...orig, x1: ex, y1: ey };
        else if (handle === 'end') resized = { ...orig, x2: ex, y2: ey };
      } else if (orig.type === 'polyline') {
        const m = handle.match(/^pt-(\d+)$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          const pts = [...(orig.points || [])];
          if (idx >= 0 && idx < pts.length) {
            pts[idx] = { x, y };
            resized = { ...orig, points: pts };
          }
        }
      } else if (orig.type === 'curve') {
        if (handle === 'start') resized = { ...orig, x1: x, y1: y };
        else if (handle === 'end') resized = { ...orig, x2: x, y2: y };
        else if (handle === 'cp') resized = { ...orig, cpx: x, cpy: y };
      } else if (orig.type === 'rect') {
        resized = {
          ...orig,
          x: Math.min(fixed.x, x),
          y: Math.min(fixed.y, y),
          width: Math.abs(fixed.x - x),
          height: Math.abs(fixed.y - y),
        };
      } else if (orig.type === 'ellipse') {
        resized = {
          ...orig,
          cx: (fixed.x + x) / 2,
          cy: (fixed.y + y) / 2,
          rx: Math.abs(fixed.x - x) / 2,
          ry: Math.abs(fixed.y - y) / 2,
        };
      } else if (orig.type === 'text') {
        // フォントサイズは px 単位で保存する。
        // ドラッグ距離 (正規化 y) × 自然高さ (px) = 実ピクセル。
        // naturalH を使うことで Go 側出力と WYSIWYG を保つ。
        const dyNorm = Math.max(0, Math.abs(y - fixed.y));
        const newFontSizePx = Math.max(4, Math.round(dyNorm * naturalH));
        resized = { ...orig, fontSize: newFontSizePx };
      }
      setShapes((prev) => prev.map((s) => (s.id === resizing.shapeId ? resized : s)));
      return;
    }
    // ドラッグ移動中
    if (dragging) {
      const { x, y } = toClientPos(e);
      const dx = x - dragging.startX;
      const dy = y - dragging.startY;
      const { orig } = dragging;
      let moved = orig;
      if (orig.type === 'line' || orig.type === 'arrow') {
        moved = { ...orig, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
      } else if (orig.type === 'polyline') {
        moved = { ...orig, points: (orig.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy })) };
      } else if (orig.type === 'curve') {
        moved = { ...orig, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy, cpx: orig.cpx + dx, cpy: orig.cpy + dy };
      } else if (orig.type === 'rect') {
        moved = { ...orig, x: orig.x + dx, y: orig.y + dy };
      } else if (orig.type === 'ellipse') {
        moved = { ...orig, cx: orig.cx + dx, cy: orig.cy + dy };
      } else if (orig.type === 'text') {
        moved = { ...orig, x: orig.x + dx, y: orig.y + dy };
      }
      setShapes((prev) => prev.map((s) => (s.id === dragging.shapeId ? moved : s)));
      return;
    }
    if (!drawing) return;
    const { x, y } = toClientPos(e);
    const { shape, startX, startY } = drawing;
    let next;
    if (shape.type === 'line' || shape.type === 'arrow') {
      let ex = x, ey = y;
      if (e.shiftKey) {
        const p = snapAngle(startX, startY, x, y, aspect);
        ex = p.x; ey = p.y;
      }
      next = { ...shape, x2: ex, y2: ey };
    } else if (shape.type === 'polyline') {
      const pts = [...polylinePoints, { x, y }];
      next = { ...shape, points: pts };
    } else if (shape.type === 'curve') {
      let ex = x, ey = y;
      if (e.shiftKey) {
        const p = snapAngle(startX, startY, x, y, aspect);
        ex = p.x; ey = p.y;
      }
      const mx = (startX + ex) / 2, my = (startY + ey) / 2;
      next = { ...shape, x2: ex, y2: ey, cpx: mx, cpy: my };
    } else if (shape.type === 'rect') {
      next = {
        ...shape,
        x: Math.min(startX, x), y: Math.min(startY, y),
        width: Math.abs(x - startX), height: Math.abs(y - startY),
      };
    } else if (shape.type === 'ellipse') {
      next = {
        ...shape,
        cx: (startX + x) / 2, cy: (startY + y) / 2,
        rx: Math.abs(x - startX) / 2, ry: Math.abs(y - startY) / 2,
      };
    }
    setDrawing({ ...drawing, shape: next });
  };

  const finishPolyline = () => {
    if (!drawing || drawing.shape.type !== 'polyline') return;
    if (polylinePoints.length >= 2) {
      const final = { ...drawing.shape, points: [...polylinePoints] };
      setShapes((prev) => [...prev, final]);
      setSelectedId(final.id);
    }
    setPolylinePoints([]);
    setDrawing(null);
    setTool('select');
  };

  const cancelPolyline = () => {
    setPolylinePoints([]);
    setDrawing(null);
  };

  const handlePointerUp = () => {
    if (rotating) {
      setRotating(null);
      return;
    }
    if (resizing) {
      setResizing(null);
      return;
    }
    if (dragging) {
      setDragging(null);
      return;
    }
    if (!drawing) return;
    if (drawing.shape.type === 'polyline') return;
    setShapes((prev) => [...prev, drawing.shape]);
    setSelectedId(drawing.shape.id);
    setDrawing(null);
    setTool('select');
  };

  const handleShapePointerDown = (e, shapeId) => {
    if (tool !== 'select') return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const orig = shapes.find((s) => s.id === shapeId);
    if (!orig) return;
    const { x, y } = toClientPos(e);
    setSelectedId(shapeId);
    setDragging({ shapeId, startX: x, startY: y, orig });
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
  };

  const handleHandlePointerDown = (e, handle, shapeId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const orig = shapes.find((s) => s.id === shapeId);
    if (!orig) return;
    const fixed = getFixedPoint(orig, handle);
    setResizing({ shapeId, handle, orig, fixed });
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
  };

  // 回転ハンドルをドラッグ開始。startAngle はポインタが図形中心から見た
  // viewBox 座標上の角度。以降 move で現在角度との差分を rotation に加算する。
  const handleRotateHandlePointerDown = (e, shapeId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const orig = shapes.find((s) => s.id === shapeId);
    if (!orig) return;
    const { x, y } = toClientPos(e);
    const c = getShapeCenter(orig, aspect, naturalH);
    const startAngle = Math.atan2(y - c.y, (x - c.x) * aspect);
    setRotating({ shapeId, orig, center: c, startAngle });
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
  };

  const handleShapeClick = (e, shapeId) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedId(shapeId);
  };

  // text shape のダブルクリック: 選択状態にして、テキスト編集 TextField に
  // フォーカスを当てる。
  // - 既に選択中のときは TextField が既にマウントされているため即フォーカス。
  // - 未選択のときはまず選択状態に変え、再レンダで TextField がマウントされた
  //   あとに useEffect でフォーカスするためフラグを立てる。
  const focusTextInput = () => {
    const el = textInputRef.current;
    if (!el) return;
    el.focus();
    try {
      const len = el.value ? el.value.length : 0;
      el.setSelectionRange(len, len);
    } catch (_) { /* noop */ }
  };
  const handleTextShapeDoubleClick = (e, shapeId) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();
    if (selectedId === shapeId && textInputRef.current) {
      focusTextInput();
      return;
    }
    setSelectedId(shapeId);
    focusTextOnNextRenderRef.current = true;
  };

  // focusTextOnNextRenderRef が立っていて、TextField がマウントされていれば
  // フォーカスする。TextField は内部で <textarea> (multiline) を持つため
  // input.focus() で OK。毎レンダ後に走るが、フラグが立っていないときは即 return。
  useEffect(() => {
    if (!focusTextOnNextRenderRef.current) return;
    if (textInputRef.current) {
      focusTextInput();
      focusTextOnNextRenderRef.current = false;
    }
  });

  useEffect(() => {
    if (tool !== 'polyline' || polylinePoints.length === 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { cancelPolyline(); }
      else if (e.key === 'Enter') { finishPolyline(); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && polylinePoints.length > 1) {
        setPolylinePoints((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, polylinePoints.length]);

  const handleShapeContextMenu = (e, shapeId) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(shapeId);
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY, shapeId });
  };

  const closeCtxMenu = () => setCtxMenu(null);

  const deleteShape = (shapeId) => {
    setShapes((prev) => prev.filter((s) => s.id !== shapeId));
    setSelectedId((curr) => (curr === shapeId ? null : curr));
  };

  const handleCtxDelete = () => {
    if (ctxMenu) deleteShape(ctxMenu.shapeId);
    closeCtxMenu();
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setShapes((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  };

  // フローティングパネルのドラッグ開始
  const handlePanelDragStart = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const container = canvasRef.current;
    const containerWidth = container ? container.clientWidth : window.innerWidth;
    setPanelDrag({
      startX: e.clientX,
      startY: e.clientY,
      origTop: panelPos.top,
      origRight: panelPos.right,
      containerWidth,
    });
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
  };

  const handlePanelDragMove = (e) => {
    if (!panelDrag) return;
    const dx = e.clientX - panelDrag.startX;
    const dy = e.clientY - panelDrag.startY;
    const nextTop = Math.max(0, panelDrag.origTop + dy);
    const nextRight = Math.max(0, panelDrag.origRight - dx);
    setPanelPos({ top: nextTop, right: nextRight });
  };

  const handlePanelDragEnd = () => {
    setPanelDrag(null);
  };

  const handleCommit = () => {
    Commit("layer", id, comment).then(() => {
      setUpdated(false);
      evt.commitDone();
      evt.showSuccessMessage("Commit.");
    }).catch((err) => evt.showErrorMessage(String(err)));
  };

  const handlePublish = async () => {
    setGenerating(true);
    try {
      await Generate("layer", id, "");
      evt.showSuccessMessage(t("layer.publishSuccess"));
      evt.reloadUnpublished();
    } catch (err) {
      evt.showErrorMessage(err);
    } finally {
      setGenerating(false);
    }
  };

  const openMoreMenu = (el) => setMoreMenu({ open: true, el });
  const closeMoreMenu = () => setMoreMenu({ open: false, el: null });

  const [unpublishConfirm, setUnpublishConfirm] = useState(false);
  const handleUnpublish = () => setUnpublishConfirm(true);
  const doUnpublish = () => {
    setUnpublishConfirm(false);
    Unpublish("layer", id).then(() => {
      evt.reloadUnpublished();
      evt.showSuccessMessage(t("preview.unpublish"));
    }).catch((err) => evt.showErrorMessage(err));
  };

  const handleOpenInBrowser = () => {
    const a = layer?.alias;
    if (!a || !serverAddress) return;
    Browser.OpenURL(`${serverAddress}/layers/${a}.svg`);
  };

  const renderArrowhead = (tipX, tipY, fromX, fromY, stroke, sw, arrowSize, keyPrefix = '') => {
    const dx = tipX - fromX, dy = tipY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) return null;
    const h = naturalH > 0 ? naturalH : 1;
    const factor = arrowSize > 0 ? arrowSize : DEFAULT_ARROW_SIZE;
    const wingLen = (sw * factor) / h;
    const angle = Math.atan2(dy, dx);
    const wings = [1, -1].map((sign, i) => {
      const a = angle + Math.PI + sign * ARROW_WING_ANGLE;
      const wx = tipX + wingLen * Math.cos(a);
      const wy = tipY + wingLen * Math.sin(a);
      return (
        <line key={`${keyPrefix}ah${i}`} x1={tipX} y1={tipY} x2={wx} y2={wy}
          stroke={stroke} strokeWidth={sw} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" pointerEvents="none" />
      );
    });
    return <>{wings}</>;
  };

  const renderShapeArrowheads = (s, startX, startY, endX, endY, fromStartX, fromStartY, fromEndX, fromEndY, stroke, sw) => {
    const ah = s.arrowHead;
    if (!ah || ah === 'none') return null;
    return (
      <>
        {(ah === 'end' || ah === 'both') && renderArrowhead(endX, endY, fromEndX, fromEndY, stroke, sw, s.arrowSize, 'e')}
        {(ah === 'start' || ah === 'both') && renderArrowhead(startX, startY, fromStartX, fromStartY, stroke, sw, s.arrowSize, 's')}
      </>
    );
  };

  const renderShape = (s, isPreview = false) => {
    const stroke = s.color || '#ff0000';
    const sw = normalizeStrokeWidth(s.strokeWidth);
    const fill = s.fill || 'none';
    const svgFill = fill === 'none' ? 'transparent' : fill;
    const common = {
      stroke,
      strokeWidth: sw,
      fill: svgFill,
      vectorEffect: 'non-scaling-stroke',
      onPointerDown: (e) => handleShapePointerDown(e, s.id),
      onClick: (e) => handleShapeClick(e, s.id),
      onContextMenu: (e) => handleShapeContextMenu(e, s.id),
      style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
    };
    let el = null;
    if (s.type === 'line') {
      const gProps = {
        onPointerDown: (e) => handleShapePointerDown(e, s.id),
        onClick: (e) => handleShapeClick(e, s.id),
        onContextMenu: (e) => handleShapeContextMenu(e, s.id),
        style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
      };
      el = (
        <g {...gProps}>
          <line stroke="transparent" strokeWidth={Math.max(sw, 8)} fill="none"
            vectorEffect="non-scaling-stroke" pointerEvents="stroke"
            x1={vbX(s.x1)} y1={s.y1} x2={vbX(s.x2)} y2={s.y2} />
          <line stroke={stroke} strokeWidth={sw} fill="none" vectorEffect="non-scaling-stroke"
            x1={vbX(s.x1)} y1={s.y1} x2={vbX(s.x2)} y2={s.y2} strokeLinecap="round" />
          {renderShapeArrowheads(s,
            vbX(s.x1), s.y1, vbX(s.x2), s.y2,
            vbX(s.x2), s.y2, vbX(s.x1), s.y1,
            stroke, sw)}
        </g>
      );
    } else if (s.type === 'polyline') {
      const pts = (s.points || []).map((p) => `${vbX(p.x)},${p.y}`).join(' ');
      const pArr = s.points || [];
      const gProps = {
        onPointerDown: (e) => handleShapePointerDown(e, s.id),
        onClick: (e) => handleShapeClick(e, s.id),
        onContextMenu: (e) => handleShapeContextMenu(e, s.id),
        style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
      };
      el = (
        <g {...gProps}>
          <polyline points={pts} stroke={stroke} strokeWidth={sw} fill="none"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline points={pts} stroke="transparent" strokeWidth={Math.max(sw, 8)} fill="none"
            vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
          {pArr.length >= 2 && renderShapeArrowheads(s,
            vbX(pArr[0].x), pArr[0].y,
            vbX(pArr[pArr.length - 1].x), pArr[pArr.length - 1].y,
            vbX(pArr[1].x), pArr[1].y,
            vbX(pArr[pArr.length - 2].x), pArr[pArr.length - 2].y,
            stroke, sw)}
        </g>
      );
    } else if (s.type === 'curve') {
      const d = `M ${vbX(s.x1)} ${s.y1} Q ${vbX(s.cpx)} ${s.cpy} ${vbX(s.x2)} ${s.y2}`;
      const gProps = {
        onPointerDown: (e) => handleShapePointerDown(e, s.id),
        onClick: (e) => handleShapeClick(e, s.id),
        onContextMenu: (e) => handleShapeContextMenu(e, s.id),
        style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
      };
      el = (
        <g {...gProps}>
          <path d={d} stroke={stroke} strokeWidth={sw} fill="none"
            strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} stroke="transparent" strokeWidth={Math.max(sw, 8)} fill="none"
            vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
          {renderShapeArrowheads(s,
            vbX(s.x1), s.y1, vbX(s.x2), s.y2,
            vbX(s.cpx), s.cpy, vbX(s.cpx), s.cpy,
            stroke, sw)}
        </g>
      );
    } else if (s.type === 'rect') {
      el = <rect {...common} x={vbX(s.x)} y={s.y} width={vbX(s.width)} height={s.height} />;
    } else if (s.type === 'ellipse') {
      el = <ellipse {...common} cx={vbX(s.cx)} cy={s.cy} rx={vbX(s.rx)} ry={s.ry} />;
    } else if (s.type === 'text') {
      // viewBox が "0 0 aspect 1" で等比スケールになったため counter-scale は不要。
      // fontSize は px 単位で保存されるため、自然高さ (naturalH) で割って viewBox 単位へ。
      // naturalH を使うことで Go 側 normalizeFontSizeViewBox と一致し WYSIWYG を保つ。
      const fs = effectiveFontSizeVB(s.fontSize, naturalH);
      const textProps = {
        x: vbX(s.x),
        y: s.y,
        fontSize: fs,
        fill: stroke,
        stroke: 'none',
        dominantBaseline: 'hanging',
        style: { cursor: tool === 'select' ? 'move' : 'crosshair', whiteSpace: 'pre', userSelect: 'none' },
        onPointerDown: (e) => handleShapePointerDown(e, s.id),
        onClick: (e) => handleShapeClick(e, s.id),
        onDoubleClick: (e) => handleTextShapeDoubleClick(e, s.id),
        onContextMenu: (e) => handleShapeContextMenu(e, s.id),
      };
      if (s.fontFamily) textProps.fontFamily = s.fontFamily;
      // 改行ごとに <tspan dy="..."> で下へ送る。dy は viewBox 単位の絶対値
      // (fs_vb * 1.2 + lineSpacing_vb)。em 単位だと lineSpacing の px を反映できないため。
      // 全 tspan に x を指定して行頭を揃える。
      const lines = (s.text || '').split('\n');
      const dyVB = lineDyVB(s, naturalH);
      el = (
        <text {...textProps}>
          {lines.map((ln, i) => (
            <tspan key={i} x={vbX(s.x)} dy={i === 0 ? 0 : dyVB}>
              {ln === '' ? ' ' : ln}
            </tspan>
          ))}
        </text>
      );
    }
    if (!el) return null;
    // rotation > 0 の場合は <g transform="rotate(angle cx cy)"> でラップする。
    // 回転中心は viewBox 座標 (x のみ aspect 倍) で指定する。
    const rot = s.rotation || 0;
    if (rot) {
      const c = getShapeCenter(s, aspect, naturalH);
      return (
        <g key={s.id} transform={`rotate(${rot} ${vbX(c.x)} ${c.y})`}>{el}</g>
      );
    }
    return <g key={s.id}>{el}</g>;
  };

  const selected = shapes.find((s) => s.id === selectedId) || null;
  const selPad = 0.008;
  // viewBox を "0 0 aspect 1" にして viewBox→表示を等比スケールにする。
  // shape データは正規化座標 (0-1) のまま保持し、レンダ時に x のみ aspect 倍して
  // viewBox 空間へ写像する (vbX)。これで stroke の太さが全方向一様になり、
  // 円（楕円）のストロークが辺ごとに太さが変わる問題が解消する。
  const aspect = imgAspect > 0 ? imgAspect : 1;
  const vbX = (v) => v * aspect;
  // naturalH: フォント WYSIWYG 計算用（Go 側 normalizeFontSizeViewBox と一致）。
  // svgH: ハンドルのピクセルサイズ計算用 = 自然高さ × ズーム倍率（= 画面上の表示高さ）。
  const naturalH = imgNaturalHeight > 0 ? imgNaturalHeight : 1;
  const svgH = naturalH * zoomScale;
  // リサイズハンドルは「表示上で常に一定ピクセル」。1 viewBox 単位 = svgH 画面ピクセル。
  const HANDLE_INNER_PX = 10;
  const HANDLE_HIT_PX = 20;
  const handleSize = HANDLE_INNER_PX / svgH;
  const hitSize = HANDLE_HIT_PX / svgH;
  // selBBox は naturalH 確定後に計算する（text の bbox はフォントサイズに依存）。
  const selBBox = getBBox(selected, imgAspect, naturalH);

  // ToggleButton 共通スタイル（#previewMenu にフィットするよう小さく）
  const toggleBtnSx = {
    padding: '4px',
    border: 'none',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    '&.Mui-selected': {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: 'var(--text-primary)',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
    },
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 選択枠の行進する蟻アニメーション用 keyframe
          vectorEffect="non-scaling-stroke" により dashoffset もピクセル単位 */}
      <style>{`
        @keyframes layerMarchingAnts {
          to { stroke-dashoffset: -9; }
        }
      `}</style>

      {/* メニューバー（画像アセットビューアと同形） */}
      <div id="previewMenu">
        <div className="previewMenuLeft">
          <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)}>
            <Tooltip title={t("layer.toolSelect")} placement="bottom">
              <ToggleButton value="select" sx={toggleBtnSx}><NearMeIcon sx={{ fontSize: '16px' }} /></ToggleButton>
            </Tooltip>
            <Tooltip title={t(`layer.tool${lineToolType.charAt(0).toUpperCase() + lineToolType.slice(1)}`)} placement="bottom">
              <ToggleButton
                value={lineToolType}
                sx={{ ...toggleBtnSx, pr: '2px' }}
                selected={LINE_TOOL_TYPES.includes(tool)}
                onClick={() => setTool(lineToolType)}
              >
                {lineToolIcon(lineToolType)}
                <ArrowDropDownIcon
                  sx={{ fontSize: '12px', ml: '-2px', opacity: 0.6 }}
                  onClick={(e) => { e.stopPropagation(); setLineSubMenu(e.currentTarget); }}
                />
              </ToggleButton>
            </Tooltip>
            <Tooltip title={t("layer.toolRect")} placement="bottom">
              <ToggleButton value="rect" sx={toggleBtnSx}><RectangleOutlinedIcon sx={{ fontSize: '16px' }} /></ToggleButton>
            </Tooltip>
            <Tooltip title={t("layer.toolEllipse")} placement="bottom">
              <ToggleButton value="ellipse" sx={toggleBtnSx}><CircleOutlinedIcon sx={{ fontSize: '16px' }} /></ToggleButton>
            </Tooltip>
            <Tooltip title={t("layer.toolText")} placement="bottom">
              <ToggleButton value="text" sx={toggleBtnSx}><TextFieldsIcon sx={{ fontSize: '16px' }} /></ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </div>
        <div className="previewMenuRight">
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
        <MenuItem onClick={() => { closeMoreMenu(); handlePublish(); }} disabled={generating || !id}>
          <PublishIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.publish")}
        </MenuItem>
        <MenuItem onClick={() => { closeMoreMenu(); handleOpenInBrowser(); }} disabled={!layer?.alias}>
          <OpenInBrowserIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.openBrowser")}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { closeMoreMenu(); handleUnpublish(); }} disabled={!id}>
          <UnpublishedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.unpublish")}
        </MenuItem>
      </Menu>

      {/* 線種サブメニュー */}
      <Menu
        open={lineSubMenu !== null}
        anchorEl={lineSubMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={() => setLineSubMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 140 } } }}
      >
        {LINE_TOOL_TYPES.map((lt) => (
          <MenuItem
            key={lt}
            selected={lineToolType === lt}
            onClick={() => { setLineToolType(lt); setTool(lt); setLineSubMenu(null); }}
          >
            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>{lineToolIcon(lt)}</Box>
            {t(`layer.tool${lt.charAt(0).toUpperCase() + lt.slice(1)}`)}
          </MenuItem>
        ))}
      </Menu>

      {/* コンテンツ: キャンバス + フローティングパネル */}
      <div
        ref={canvasRef}
        style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}
        onPointerDown={handleCanvasPanStart}
        onPointerMove={handleCanvasPanMove}
        onPointerUp={handleCanvasPanEnd}
        onPointerCancel={handleCanvasPanEnd}
      >
        {imageUrl && (
          /* wrapperRef に transformOrigin:'0 0' + translate/scale を直接適用。
             img と svg が同じ wrapper 内にあるため一緒に動く。
             自然サイズを layout サイズとし、transform で表示を制御する。 */
          <div
            ref={wrapperRef}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              // imgNaturalHeight は state なので変化時に再レンダされる。
              // imgAspect も state。両方揃ったとき正しいサイズになる。
              width:  imgNaturalHeight > 0 ? Math.round(imgNaturalHeight * imgAspect) : 0,
              height: imgNaturalHeight > 0 ? imgNaturalHeight : 0,
              transformOrigin: '0 0',
            }}
          >
              <img
                src={imageUrl}
                alt=""
                onLoad={(e) => {
                  const w = e.target.naturalWidth;
                  const h = e.target.naturalHeight;
                  if (w > 0 && h > 0) {
                    setImgAspect(w / h);
                    setImgNaturalHeight(h);
                    imgNaturalRef.current = { w, h };
                    fitToCanvas();
                  }
                }}
                style={{ display: 'block', width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }}
              />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${aspect} 1`}
                preserveAspectRatio="none"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  cursor: tool === 'select' ? 'default' : 'crosshair',
                  touchAction: 'none',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={(e) => { if (tool === 'select' && e.target === svgRef.current) setSelectedId(null); }}
                onDoubleClick={(e) => { if (tool === 'polyline' && polylinePoints.length >= 2) { e.preventDefault(); finishPolyline(); } }}
                onContextMenu={(e) => {
                  if (e.target === svgRef.current) e.preventDefault();
                }}
              >
                {shapes.map((s) => renderShape(s))}
                {drawing && renderShape(drawing.shape, true)}
                {/* 選択枠 + リサイズハンドルは選択 shape の rotation と同じ回転を適用する */}
                {(() => {
                  if (!selected) return null;
                  const rot = selected.rotation || 0;
                  const c = getShapeCenter(selected, aspect, naturalH);
                  const transform = rot ? `rotate(${rot} ${vbX(c.x)} ${c.y})` : undefined;
                  return (
                    <g transform={transform}>
                      {selBBox && (
                        <rect
                          x={vbX(selBBox.x) - selPad}
                          y={selBBox.y - selPad}
                          width={vbX(selBBox.width) + selPad * 2}
                          height={selBBox.height + selPad * 2}
                          fill="none"
                          stroke="#00aaff"
                          strokeWidth={1.5}
                          strokeDasharray="6,3"
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                          style={{ animation: 'layerMarchingAnts 1s linear infinite' }}
                        />
                      )}
                      {/* curve の制御点スケルトン線 */}
                      {tool === 'select' && !drawing && selected.type === 'curve' && (
                        <>
                          <line x1={vbX(selected.x1)} y1={selected.y1} x2={vbX(selected.cpx)} y2={selected.cpy}
                            stroke="#ff8800" strokeWidth={1} strokeDasharray="4,3"
                            vectorEffect="non-scaling-stroke" pointerEvents="none" />
                          <line x1={vbX(selected.x2)} y1={selected.y2} x2={vbX(selected.cpx)} y2={selected.cpy}
                            stroke="#ff8800" strokeWidth={1} strokeDasharray="4,3"
                            vectorEffect="non-scaling-stroke" pointerEvents="none" />
                        </>
                      )}
                      {tool === 'select' && !drawing && getHandles(selected, imgAspect, naturalH).map((h) => (
                        <g key={h.id} style={{ cursor: h.cursor }}
                           onPointerDown={(e) => handleHandlePointerDown(e, h.id, selected.id)}>
                          <rect
                            x={vbX(h.x) - hitSize / 2} y={h.y - hitSize / 2}
                            width={hitSize} height={hitSize}
                            fill="transparent"
                          />
                          {h.isControlPoint ? (
                            <circle
                              cx={vbX(h.x)} cy={h.y} r={handleSize / 2}
                              fill="#ffffff"
                              stroke="#ff8800"
                              strokeWidth={1.5}
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : (
                            <rect
                              x={vbX(h.x) - handleSize / 2} y={h.y - handleSize / 2}
                              width={handleSize} height={handleSize}
                              fill="#ffffff"
                              stroke="#00aaff"
                              strokeWidth={1}
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </g>
                      ))}
                      {/* 回転ハンドル: bbox 右下からさらに外側 (固定ピクセル) に配置。
                          グループは rotate() でラップされているため shape と一緒に回る。 */}
                      {tool === 'select' && !drawing && selBBox && (() => {
                        const ROTATE_OFFSET_PX = 22;
                        const off = ROTATE_OFFSET_PX / svgH;
                        const hx = vbX(selBBox.x + selBBox.width) + off;
                        const hy = selBBox.y + selBBox.height + off;
                        const r = handleSize / 2;
                        const hitR = hitSize / 2;
                        return (
                          <g style={{ cursor: 'crosshair' }}
                             onPointerDown={(e) => handleRotateHandlePointerDown(e, selected.id)}>
                            <circle cx={hx} cy={hy} r={hitR} fill="transparent" />
                            <circle cx={hx} cy={hy} r={r}
                                    fill="#ffffff"
                                    stroke="#ff8800"
                                    strokeWidth={1.5}
                                    vectorEffect="non-scaling-stroke" />
                          </g>
                        );
                      })()}
                    </g>
                  );
                })()}
              </svg>
          </div>
        )}

        {/* ズーム倍率バッジ（ImageViewer と同じスタイル） */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(0,0,0,0.45)', color: '#fff',
          padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
          pointerEvents: 'none', userSelect: 'none',
        }}>
          {Math.round(zoomScale * 100)}%
        </div>

        {/* フローティングパネル: 図形一覧・プロパティ（ドラッグで移動可能） */}
        <Paper
          elevation={6}
          className="layerFloatingPanel"
          sx={{
            position: 'absolute',
            top: panelPos.top,
            right: panelPos.right,
            width: 260,
            p: 1.5,
            pt: 0.5,
            backgroundColor: 'var(--bg-elevated, rgba(30,30,30,0.92))',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(6px)',
            userSelect: panelDrag ? 'none' : 'auto',
          }}
        >
          {/* ドラッグハンドル（ヘッダー行） */}
          <Box
            onPointerDown={handlePanelDragStart}
            onPointerMove={handlePanelDragMove}
            onPointerUp={handlePanelDragEnd}
            onPointerCancel={handlePanelDragEnd}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: panelDrag ? 'grabbing' : 'grab',
              mx: -1.5,
              px: 1.5,
              py: 0.5,
              mb: 0.5,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              touchAction: 'none',
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
              {t("layer.shapes")} ({shapes.length})
            </Typography>
          </Box>
          <Box sx={{ maxHeight: 104, overflow: 'auto', mb: 1 }}>
            {shapes.map((s) => (
              <Box
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                onContextMenu={(e) => handleShapeContextMenu(e, s.id)}
                sx={{
                  p: 0.5, cursor: 'pointer', fontSize: 12, lineHeight: 1.4,
                  color: 'var(--text-primary)',
                  backgroundColor: s.id === selectedId ? 'var(--bg-selected, rgba(255,255,255,0.1))' : 'transparent',
                  borderRadius: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {s.type} — {s.type === 'text' ? (s.text || '') : s.color}
              </Box>
            ))}
          </Box>
          <Divider sx={{ mb: 1 }} />
          {selected ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'var(--text-primary)' }}>{t("layer.properties")}</Typography>
              <TextField
                label={t("layer.color")} size="small" type="color"
                value={selected.color || '#ff0000'}
                onChange={(e) => updateSelected({ color: e.target.value })}
              />
              <TextField
                label={t("layer.rotation")} size="small" type="number"
                inputProps={{ step: 1, min: 0, max: 360 }}
                value={Math.round(selected.rotation ?? 0)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  updateSelected({ rotation: Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0 });
                }}
              />
              {selected.type === 'text' ? (
                <>
                  <TextField
                    label={t("layer.text")} size="small" multiline maxRows={4}
                    inputRef={textInputRef}
                    value={selected.text || ''}
                    onChange={(e) => updateSelected({ text: e.target.value })}
                  />
                  <TextField
                    label={t("layer.fontSize")} size="small" type="number"
                    inputProps={{ step: 1, min: 4, max: 256 }}
                    value={selected.fontSize ?? DEFAULT_FONT_SIZE_PX}
                    onChange={(e) => updateSelected({ fontSize: parseFloat(e.target.value) || DEFAULT_FONT_SIZE_PX })}
                  />
                  <TextField
                    label={t("layer.lineSpacing")} size="small" type="number"
                    inputProps={{ step: 1, min: 0, max: 256 }}
                    value={selected.lineSpacing ?? 0}
                    onChange={(e) => updateSelected({ lineSpacing: parseFloat(e.target.value) || 0 })}
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id="layer-fontfamily-label">{t("layer.fontFamily")}</InputLabel>
                    <Select
                      labelId="layer-fontfamily-label"
                      label={t("layer.fontFamily")}
                      value={selected.fontFamily || ''}
                      onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                      MenuProps={{ PaperProps: { style: { maxHeight: 10 * 36 } } }}
                      renderValue={(v) => v || t("layer.fontFamilyDefault")}
                    >
                      <MenuItem value=""><em>{t("layer.fontFamilyDefault")}</em></MenuItem>
                      {fontNames.map((f) => (
                        <MenuItem key={f} value={f} sx={{ fontFamily: f }}>{f}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              ) : (
                <>
                  <TextField
                    label={t("layer.strokeWidth")} size="small" type="number"
                    inputProps={{ step: 0.5, min: 0.5, max: 50 }}
                    value={normalizeStrokeWidth(selected.strokeWidth ?? 5)}
                    onChange={(e) => updateSelected({ strokeWidth: parseFloat(e.target.value) || 5 })}
                  />
                  {['line', 'polyline', 'curve'].includes(selected.type) && (
                    <>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="layer-arrowhead-label">{t("layer.arrowHead")}</InputLabel>
                        <Select
                          labelId="layer-arrowhead-label"
                          label={t("layer.arrowHead")}
                          value={selected.arrowHead || 'none'}
                          onChange={(e) => updateSelected({ arrowHead: e.target.value === 'none' ? '' : e.target.value })}
                        >
                          {ARROW_HEAD_OPTIONS.map((opt) => (
                            <MenuItem key={opt} value={opt}>{t(`layer.arrowHead_${opt}`)}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {selected.arrowHead && selected.arrowHead !== 'none' && (
                        <TextField
                          label={t("layer.arrowSize")} size="small" type="number"
                          inputProps={{ step: 0.5, min: 1, max: 20 }}
                          value={selected.arrowSize || DEFAULT_ARROW_SIZE}
                          onChange={(e) => updateSelected({ arrowSize: parseFloat(e.target.value) || 0 })}
                        />
                      )}
                    </>
                  )}
                  {!['line', 'polyline', 'curve'].includes(selected.type) && (
                    <TextField
                      label={t("layer.fill")} size="small"
                      value={selected.fill || 'none'}
                      onChange={(e) => updateSelected({ fill: e.target.value })}
                      helperText={t("layer.fillHint")}
                    />
                  )}
                </>
              )}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              {t("layer.noSelection")}
            </Typography>
          )}
        </Paper>
      </div>

      {/* ステータスバー */}
      <CommitBar
        comment={comment}
        onCommentChange={setComment}
        updated={updated}
        onCommit={handleCommit}
      />

      {/* 右クリックメニュー (BinderTree と同じスタイル) */}
      <Menu
        open={ctxMenu !== null}
        onClose={closeCtxMenu}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { minWidth: 150 } } }}
      >
        <MenuItem onClick={handleCtxDelete} sx={{ color: 'var(--accent-red)' }}>
          <DeleteIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("common.delete")}
        </MenuItem>
      </Menu>

      {/** 未公開確認ダイアログ */}
      <Dialog open={unpublishConfirm} onClose={() => setUnpublishConfirm(false)}>
        <DialogTitle>{t("preview.unpublishConfirm")}</DialogTitle>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishConfirm(false)} />
          <ActionButton variant="delete" label={t("preview.unpublish")} icon={<UnpublishedIcon />} onClick={doUnpublish} />
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default LayerEditor;

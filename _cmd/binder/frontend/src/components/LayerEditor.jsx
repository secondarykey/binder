import { useState, useEffect, useContext, useRef } from 'react';
import { useParams } from 'react-router';
import { Box, Paper, ToggleButton, ToggleButtonGroup, IconButton, Tooltip, TextField, Typography, Divider, Menu, MenuItem, ListItemIcon, ListItemText, FormControl, InputLabel, Select } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import NearMeIcon from '@mui/icons-material/NearMe';
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import PublishIcon from '@mui/icons-material/Publish';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import { GetLayerWithParent, GetLayerContent, SaveLayerContent, Address, Generate, GetFontNames } from '../../bindings/binder/api/app';
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
  strokeWidth: 2,
  fill: 'none',
};

// 過去の正規化座標ベースの strokeWidth (< 1) を legacy とみなし、
// 400 倍してピクセル単位 (0.005 → 2) にマップする。
// Go 側 normalizeStrokeWidth と同一ロジック。
const normalizeStrokeWidth = (sw) => {
  if (!sw || sw <= 0) return 2;
  if (sw < 1) return sw * 400;
  return sw;
};

// 選択中 shape のバウンディングボックスを計算
// imgAspect: 親画像の width/height。text はレンダ時に x 方向を 1/aspect 倍するため
// viewBox 上の実幅も 1/aspect 倍となる。
const getBBox = (s, imgAspect = 1) => {
  if (!s) return null;
  if (s.type === 'line') {
    return {
      x: Math.min(s.x1, s.x2),
      y: Math.min(s.y1, s.y2),
      width: Math.abs(s.x2 - s.x1),
      height: Math.abs(s.y2 - s.y1),
    };
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
    const fs = s.fontSize || 0.04;
    const aspect = imgAspect > 0 ? imgAspect : 1;
    return { x: s.x, y: s.y, width: fs / aspect, height: fs };
  }
  return null;
};

// 選択中 shape に表示するリサイズハンドル位置を計算
const getHandles = (s, imgAspect = 1) => {
  if (!s) return [];
  if (s.type === 'line') {
    return [
      { id: 'start', x: s.x1, y: s.y1, cursor: 'move' },
      { id: 'end', x: s.x2, y: s.y2, cursor: 'move' },
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
    const bbox = getBBox(s, imgAspect);
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
const getShapeCenter = (s, imgAspect = 1) => {
  if (!s) return { x: 0.5, y: 0.5 };
  if (s.type === 'line') return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
  if (s.type === 'rect') return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  if (s.type === 'ellipse') return { x: s.cx, y: s.cy };
  if (s.type === 'text') {
    const fs = s.fontSize || 0.04;
    const aspect = imgAspect > 0 ? imgAspect : 1;
    return { x: s.x + fs / (2 * aspect), y: s.y + fs / 2 };
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
  const [shapes, setShapes] = useState([]);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [dragging, setDragging] = useState(null); // { shapeId, startX, startY, orig }
  const [resizing, setResizing] = useState(null); // { shapeId, handle, orig, fixed }
  const [rotating, setRotating] = useState(null); // { shapeId, orig, center, startAngle }
  const [ctxMenu, setCtxMenu] = useState(null); // { mouseX, mouseY, shapeId }
  const [generating, setGenerating] = useState(false);

  // フローティングパネルの位置（canvas コンテナの右上を原点とする top/right 指定）
  const [panelPos, setPanelPos] = useState({ top: 12, right: 12 });
  const [panelDrag, setPanelDrag] = useState(null); // { startX, startY, origTop, origRight, containerWidth }

  // フォント一覧（テキスト shape の font-family 設定用）
  const [fontNames, setFontNames] = useState([]);

  // 親画像のアスペクト比 (width/height)。viewBox="0 0 1 1" + preserveAspectRatio="none"
  // の引き伸ばしでテキスト字形が歪むため、text レンダリング時に x 方向を 1/aspect 倍する。
  const [imgAspect, setImgAspect] = useState(1);

  // SVG の実表示ピクセルサイズ。小さな画像でもリサイズハンドルが一定ピクセル
  // サイズで表示できるよう、viewBox 単位への変換に使う。
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    loadedRef.current = false;
    Promise.all([
      GetLayerWithParent(id),
      GetLayerContent(id),
      Address(),
    ]).then(([lw, content, addr]) => {
      setLayer(lw);
      if (lw?.parentId) {
        setImageUrl(`${addr}/binder-assets/${lw.parentId}`);
      }
      try {
        const parsed = content ? JSON.parse(content) : { shapes: [] };
        setShapes(Array.isArray(parsed.shapes) ? parsed.shapes : []);
      } catch {
        setShapes([]);
      }
      setTimeout(() => { loadedRef.current = true; }, 0);
    }).catch((err) => evt.showErrorMessage(err));
  }, [id]);

  // フォント一覧の取得（テキスト shape の font-family 候補）
  useEffect(() => {
    GetFontNames()
      .then((names) => setFontNames(Array.isArray(names) ? names : []))
      .catch((err) => evt.showErrorMessage(err));
  }, []);

  // SVG の実表示サイズ監視。小さい画像でもリサイズハンドルを固定ピクセル
  // サイズで表示するため、表示幅・高さを viewBox 単位への換算に使う。
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // 初期値を同期的に取得
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSvgSize({ w: rect.width, h: rect.height });
    }
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        if (r.width > 0 && r.height > 0) {
          setSvgSize({ w: r.width, h: r.height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl]);

  // shapes 変更時の自動保存（debounce）
  useEffect(() => {
    if (!id) return;
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      SaveLayerContent(id, JSON.stringify({ shapes }))
        .then(() => {
          if (evt?.markModified) evt.markModified(id);
        })
        .catch((err) => evt.showErrorMessage(err));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [shapes, id]);

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
    if (tool === 'select') return;
    const { x, y } = toClientPos(e);
    const base = { id: uuid(), ...defaultShapeProps };
    let shape;
    if (tool === 'line') {
      shape = { ...base, type: 'line', x1: x, y1: y, x2: x, y2: y };
    } else if (tool === 'rect') {
      shape = { ...base, type: 'rect', x, y, width: 0, height: 0 };
    } else if (tool === 'ellipse') {
      shape = { ...base, type: 'ellipse', cx: x, cy: y, rx: 0, ry: 0 };
    } else if (tool === 'text') {
      // テキストはクリックで即座に配置（ドラッグ不要）
      const textShape = {
        ...base,
        type: 'text',
        x, y,
        text: t("layer.defaultText"),
        fontSize: 0.04,
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
      // 0-360 に正規化
      newRot = ((newRot % 360) + 360) % 360;
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
        const c = getShapeCenter(orig, aspect);
        const p = rotatePoint(
          x * aspect, y,
          c.x * aspect, c.y,
          -orig.rotation
        );
        x = p.x / aspect;
        y = p.y;
      }
      let resized = orig;
      if (orig.type === 'line') {
        if (handle === 'start') resized = { ...orig, x1: x, y1: y };
        else if (handle === 'end') resized = { ...orig, x2: x, y2: y };
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
        // フォントサイズ = ドラッグ点と固定点(左上)との y 差分
        const newFontSize = Math.max(0.005, Math.abs(y - fixed.y));
        resized = { ...orig, fontSize: newFontSize };
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
      if (orig.type === 'line') {
        moved = { ...orig, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
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
    if (shape.type === 'line') {
      next = { ...shape, x2: x, y2: y };
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
    setShapes((prev) => [...prev, drawing.shape]);
    setSelectedId(drawing.shape.id);
    setDrawing(null);
    // 連続で新規作成してしまわないよう選択ツールへ戻す
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
    const c = getShapeCenter(orig, aspect);
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

  const handlePublish = async () => {
    setGenerating(true);
    try {
      await Generate("layer", id, "");
      evt.showSuccessMessage(t("layer.publishSuccess"));
    } catch (err) {
      evt.showErrorMessage(err);
    } finally {
      setGenerating(false);
    }
  };

  const renderShape = (s, isPreview = false) => {
    const stroke = s.color || '#ff0000';
    // vector-effect="non-scaling-stroke" 付きで描画するため、stroke-width は
    // ピクセル単位として解釈される。legacy の正規化値 (< 1) はピクセルに変換。
    const sw = normalizeStrokeWidth(s.strokeWidth);
    const fill = s.fill || 'none';
    const common = {
      stroke,
      strokeWidth: sw,
      fill,
      vectorEffect: 'non-scaling-stroke',
      onPointerDown: (e) => handleShapePointerDown(e, s.id),
      onClick: (e) => handleShapeClick(e, s.id),
      onContextMenu: (e) => handleShapeContextMenu(e, s.id),
      style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
    };
    let el = null;
    if (s.type === 'line') {
      el = <line {...common} x1={vbX(s.x1)} y1={s.y1} x2={vbX(s.x2)} y2={s.y2} strokeLinecap="round" />;
    } else if (s.type === 'rect') {
      el = <rect {...common} x={vbX(s.x)} y={s.y} width={vbX(s.width)} height={s.height} />;
    } else if (s.type === 'ellipse') {
      el = <ellipse {...common} cx={vbX(s.cx)} cy={s.cy} rx={vbX(s.rx)} ry={s.ry} />;
    } else if (s.type === 'text') {
      // viewBox が "0 0 aspect 1" で等比スケールになったため counter-scale は不要。
      const fs = s.fontSize || 0.04;
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
        onContextMenu: (e) => handleShapeContextMenu(e, s.id),
      };
      if (s.fontFamily) textProps.fontFamily = s.fontFamily;
      el = <text {...textProps}>{s.text || ''}</text>;
    }
    if (!el) return null;
    // rotation > 0 の場合は <g transform="rotate(angle cx cy)"> でラップする。
    // 回転中心は viewBox 座標 (x のみ aspect 倍) で指定する。
    const rot = s.rotation || 0;
    if (rot) {
      const c = getShapeCenter(s, aspect);
      return (
        <g key={s.id} transform={`rotate(${rot} ${vbX(c.x)} ${c.y})`}>{el}</g>
      );
    }
    return <g key={s.id}>{el}</g>;
  };

  const selected = shapes.find((s) => s.id === selectedId) || null;
  const selBBox = getBBox(selected, imgAspect);
  const selPad = 0.008;
  // viewBox を "0 0 aspect 1" にして viewBox→表示を等比スケールにする。
  // shape データは正規化座標 (0-1) のまま保持し、レンダ時に x のみ aspect 倍して
  // viewBox 空間へ写像する (vbX)。これで stroke の太さが全方向一様になり、
  // 円（楕円）のストロークが辺ごとに太さが変わる問題が解消する。
  const aspect = imgAspect > 0 ? imgAspect : 1;
  const vbX = (v) => v * aspect;
  // リサイズハンドルは「画像の表示サイズに依らず常に一定ピクセル」で表示する。
  // 等比スケールなので 1 viewBox 単位 = svgH ピクセル（x/y 共通）。
  const HANDLE_INNER_PX = 10; // 表示上の正方形のひと辺
  const HANDLE_HIT_PX = 20;   // クリック当たり判定のひと辺
  const svgH = svgSize.h > 0 ? svgSize.h : 1;
  const handleSize = HANDLE_INNER_PX / svgH;
  const hitSize = HANDLE_HIT_PX / svgH;

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
            <Tooltip title={t("layer.toolLine")} placement="bottom">
              <ToggleButton value="line" sx={toggleBtnSx}><RemoveIcon sx={{ fontSize: '16px' }} /></ToggleButton>
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
        <div className="previewMenuRight" />
      </div>

      {/* コンテンツ: キャンバス + フローティングパネル */}
      <div ref={canvasRef} style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {imageUrl && (
          <div
            style={{
              position: 'absolute', inset: 0,
              overflow: 'auto', padding: '16px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img
                src={imageUrl}
                alt=""
                onLoad={(e) => {
                  const w = e.target.naturalWidth;
                  const h = e.target.naturalHeight;
                  if (w > 0 && h > 0) setImgAspect(w / h);
                }}
                style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }}
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
                  const c = getShapeCenter(selected, aspect);
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
                      {tool === 'select' && !drawing && getHandles(selected, imgAspect).map((h) => (
                        <g key={h.id} style={{ cursor: h.cursor }}
                           onPointerDown={(e) => handleHandlePointerDown(e, h.id, selected.id)}>
                          <rect
                            x={vbX(h.x) - hitSize / 2} y={h.y - hitSize / 2}
                            width={hitSize} height={hitSize}
                            fill="transparent"
                          />
                          <rect
                            x={vbX(h.x) - handleSize / 2} y={h.y - handleSize / 2}
                            width={handleSize} height={handleSize}
                            fill="#ffffff"
                            stroke="#00aaff"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                          />
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
          </div>
        )}

        {/* フローティングパネル: 図形一覧・プロパティ（ドラッグで移動可能） */}
        <Paper
          elevation={6}
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
                value={selected.rotation ?? 0}
                onChange={(e) => updateSelected({ rotation: parseFloat(e.target.value) || 0 })}
              />
              {selected.type === 'text' ? (
                <>
                  <TextField
                    label={t("layer.text")} size="small" multiline maxRows={4}
                    value={selected.text || ''}
                    onChange={(e) => updateSelected({ text: e.target.value })}
                  />
                  <TextField
                    label={t("layer.fontSize")} size="small" type="number"
                    inputProps={{ step: 0.005, min: 0.005, max: 0.5 }}
                    value={selected.fontSize ?? 0.04}
                    onChange={(e) => updateSelected({ fontSize: parseFloat(e.target.value) || 0.04 })}
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
                    value={normalizeStrokeWidth(selected.strokeWidth ?? 2)}
                    onChange={(e) => updateSelected({ strokeWidth: parseFloat(e.target.value) || 2 })}
                  />
                  {selected.type !== 'line' && (
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

      {/* ステータスバー（画像アセットビューアと同形） */}
      <div id="parseStatusBar">
        <div className="parseStatusLeft">
          <CheckCircleIcon sx={{ fontSize: '16px', color: 'var(--accent-green)', mr: '6px' }} />
          <span className="parseStatusText">{layer?.name ?? ''}</span>
        </div>
        <div className="parseStatusRight">
          <Tooltip title={t("preview.publish")} placement="top">
            <span>
              <IconButton size="small" onClick={handlePublish} disabled={generating || !id} className="editorBtn">
                <PublishIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>

      {/* 右クリックメニュー */}
      <Menu
        open={ctxMenu !== null}
        onClose={closeCtxMenu}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
      >
        <MenuItem onClick={handleCtxDelete}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'var(--accent-red)' }} /></ListItemIcon>
          <ListItemText>{t("common.delete")}</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );
}

export default LayerEditor;

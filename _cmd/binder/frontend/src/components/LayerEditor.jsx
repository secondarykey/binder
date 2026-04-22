import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Box, ToggleButton, ToggleButtonGroup, IconButton, Tooltip, TextField, Typography, Divider } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NearMeIcon from '@mui/icons-material/NearMe';
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';

import { GetLayerWithParent, GetLayerContent, SaveLayerContent, Address } from '../../bindings/binder/api/app';
import { EventContext } from '../Event';
import "../language";
import { useTranslation } from 'react-i18next';

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const defaultShapeProps = {
  color: '#ff0000',
  strokeWidth: 0.005,
  fill: 'none',
};

/**
 * Layer の描画エディタ。
 * 親 Asset 画像を背景に、正規化座標 (0.0-1.0) で line / rect / ellipse を描画する。
 */
function LayerEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const evt = useContext(EventContext);
  const { t } = useTranslation();

  const [layer, setLayer] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [shapes, setShapes] = useState([]);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [dirty, setDirty] = useState(false);

  const svgRef = useRef(null);

  useEffect(() => {
    if (!id) return;
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
      setDirty(false);
    }).catch((err) => evt.showErrorMessage(err));
  }, [id]);

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
    } else {
      return;
    }
    setDrawing({ shape, startX: x, startY: y });
  };

  const handlePointerMove = (e) => {
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
    if (!drawing) return;
    setShapes((prev) => [...prev, drawing.shape]);
    setSelectedId(drawing.shape.id);
    setDrawing(null);
    setDirty(true);
  };

  const handleShapeClick = (e, shapeId) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedId(shapeId);
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setShapes((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setShapes((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await SaveLayerContent(id, JSON.stringify({ shapes }));
      evt.markModified(id);
      evt.showSuccessMessage(t("layer.saveSuccess"));
      setDirty(false);
    } catch (err) {
      evt.showErrorMessage(err);
    }
  };

  const renderShape = (s, isPreview = false) => {
    const stroke = s.color || '#ff0000';
    const sw = s.strokeWidth || 0.005;
    const fill = s.fill || 'none';
    const selected = !isPreview && s.id === selectedId;
    const common = {
      key: s.id,
      stroke,
      strokeWidth: sw,
      fill,
      onClick: (e) => handleShapeClick(e, s.id),
      style: { cursor: tool === 'select' ? 'pointer' : 'crosshair' },
      opacity: selected ? 0.85 : 1,
    };
    if (s.type === 'line') {
      return <line {...common} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeLinecap="round" />;
    }
    if (s.type === 'rect') {
      return <rect {...common} x={s.x} y={s.y} width={s.width} height={s.height} />;
    }
    if (s.type === 'ellipse') {
      return <ellipse {...common} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
    }
    return null;
  };

  const selected = shapes.find((s) => s.id === selectedId) || null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* ツールバー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: '1px solid var(--border-color, #444)' }}>
        <Tooltip title={t("common.back")}>
          <IconButton size="small" onClick={() => layer?.parentId && nav(`/editor/assets/${layer.parentId}`)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ mr: 2 }}>{layer?.name}</Typography>
        <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)}>
          <ToggleButton value="select"><NearMeIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="line"><RemoveIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="rect"><RectangleOutlinedIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="ellipse"><CircleOutlinedIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t("common.delete")}>
          <span>
            <IconButton size="small" onClick={deleteSelected} disabled={!selectedId}>
              <DeleteIcon fontSize="small" sx={{ color: selectedId ? 'var(--accent-red)' : undefined }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("common.save")}>
          <span>
            <IconButton size="small" onClick={handleSave} disabled={!dirty}>
              <SaveIcon fontSize="small" sx={{ color: dirty ? 'var(--accent-green)' : undefined }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* キャンバス + サイドバー */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto', p: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          {imageUrl && (
            <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img
                src={imageUrl}
                alt=""
                style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }}
              />
              <svg
                ref={svgRef}
                viewBox="0 0 1 1"
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
              >
                {shapes.map((s) => renderShape(s))}
                {drawing && renderShape(drawing.shape, true)}
              </svg>
            </Box>
          )}
        </Box>

        {/* プロパティパネル */}
        <Box sx={{ width: 260, borderLeft: '1px solid var(--border-color, #444)', p: 1.5, overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t("layer.shapes")} ({shapes.length})</Typography>
          <Box sx={{ maxHeight: 180, overflow: 'auto', mb: 2 }}>
            {shapes.map((s) => (
              <Box
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                sx={{
                  p: 0.5, cursor: 'pointer', fontSize: 12,
                  backgroundColor: s.id === selectedId ? 'var(--bg-selected, rgba(255,255,255,0.1))' : 'transparent',
                }}
              >
                {s.type} — {s.color}
              </Box>
            ))}
          </Box>
          <Divider sx={{ mb: 1 }} />
          {selected ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption">{t("layer.properties")}</Typography>
              <TextField
                label={t("layer.color")} size="small" type="color"
                value={selected.color || '#ff0000'}
                onChange={(e) => updateSelected({ color: e.target.value })}
              />
              <TextField
                label={t("layer.strokeWidth")} size="small" type="number"
                inputProps={{ step: 0.001, min: 0.001, max: 0.1 }}
                value={selected.strokeWidth ?? 0.005}
                onChange={(e) => updateSelected({ strokeWidth: parseFloat(e.target.value) || 0.005 })}
              />
              {selected.type !== 'line' && (
                <TextField
                  label={t("layer.fill")} size="small"
                  value={selected.fill || 'none'}
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                  helperText={t("layer.fillHint")}
                />
              )}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              {t("layer.noSelection")}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default LayerEditor;

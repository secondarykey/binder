import { useEffect, useRef, useState } from 'react';

import { Toolbar, Typography, IconButton, TextField, InputAdornment, LinearProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CodeIcon from '@mui/icons-material/Code';

import { Events, Window } from '@wailsio/runtime';
import { SearchBinder } from '../../bindings/binder/api/app';

import '../assets/App.css';
import '../assets/SearchApp.css';
import '../language';
import { useTranslation } from 'react-i18next';

function MermaidSVG(props) {
  return (
    <svg width={props.width} height={props.height} style={{ padding: '2px' }} viewBox="0 0 491 491">
      <path d="M490.16,84.61C490.16,37.912 452.248,0 405.55,0L84.61,0C37.912,0 0,37.912 0,84.61L0,405.55C0,452.248 37.912,490.16 84.61,490.16L405.55,490.16C452.248,490.16 490.16,452.248 490.16,405.55L490.16,84.61Z"
        fill={props.fill} />
      <path d="M407.48,111.18C335.587,168.207 287.942,248.7 271.2,338.37C254.458,248.7 206.813,168.207 134.92,111.18L68.76,111.18C155.081,163.498 214.564,252.86 228.58,354.68L313.82,354.68C327.836,252.86 387.319,163.498 473.64,111.18L407.48,111.18Z"
        fill={props.contents} />
    </svg>
  );
}

/**
 * バインダー全体検索ウィンドウ
 * ノートとダイアグラムの名前・内容を検索し、結果をストリーミング表示する。
 */
function SearchApp() {

  const { t } = useTranslation();
  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(null); // null = 全選択（未設定）
  const inputRef = useRef(null);
  const searchedRef = useRef(false);

  useEffect(() => { searchedRef.current = searched; }, [searched]);

  // ウィンドウサイズをアニメーションで変更する（イベントハンドラから参照するためrefで保持）
  const animateResizeRef = useRef(null);
  animateResizeRef.current = (fromH, toH, duration, onDone) => {
    const start = performance.now();
    const step = (now) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - elapsed, 3);
      const h = Math.round(fromH + (toH - fromH) * ease);
      Window.SetSize(700, h);
      if (elapsed < 1) {
        requestAnimationFrame(step);
      } else if (onDone) {
        onDone();
      }
    };
    requestAnimationFrame(step);
  };

  // Wails イベントリスナー
  useEffect(() => {
    const cleanupResult = Events.On('binder:search:result', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      setResults((prev) => [...prev, data]);
    });

    const cleanupDone = Events.On('binder:search:done', () => {
      setSearching(false);
    });

    const cleanupQuery = Events.On('binder:search:query', (event) => {
      const q = event.data?.[0] ?? '';
      setQuery(q);
      setResults([]);
      setSelectedTypes(null);
      if (q.trim()) {
        if (!searchedRef.current) {
          Window.SetMinSize(500, 300);
          animateResizeRef.current(46, 500, 200);
        }
        setSearched(true);
        setSearching(true);
        SearchBinder(q.trim()).catch(() => setSearching(false));
      }
    });

    return () => {
      cleanupResult();
      cleanupDone();
      cleanupQuery();
    };
  }, []);

  // マウント時にフォーカス＆URLパラメータからの初期検索
  useEffect(() => {
    inputRef.current?.focus();
    if (initialQuery.trim()) {
      Window.SetMinSize(500, 300);
      animateResizeRef.current(46, 500, 200);
      setSearched(true);
      setSearching(true);
      SearchBinder(initialQuery.trim()).catch(() => setSearching(false));
    }
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    setResults([]);
    setSelectedTypes(null);
    setSearching(true);
    if (!searched) {
      Window.SetMinSize(500, 300);
      animateResizeRef.current(46, 500, 200);
    }
    setSearched(true);
    SearchBinder(query.trim()).catch(() => {
      setSearching(false);
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSelectedTypes(null);
    setSearched(false);
    animateResizeRef.current(500, 46, 150, () => {
      Window.SetMinSize(500, 46);
    });
    inputRef.current?.focus();
  };

  const handleTogglePin = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    Window.SetAlwaysOnTop(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // ダブルクリックでメインウィンドウのツリーにナビゲート（検索クエリも渡す）
  const handleNavigate = (result) => {
    Events.Emit('binder:search:navigate', { typ: result.type, id: result.id, query: query.trim() });
  };

  const handleClose = () => {
    Window.Close();
  };

  // 一致テキストのハイライト
  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery) return text;
    const q = searchQuery.toLowerCase();
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;
    return (
      <>{text.substring(0, idx)}<mark>{text.substring(idx, idx + searchQuery.length)}</mark>{text.substring(idx + searchQuery.length)}</>
    );
  };

  // 種別ごとの件数
  const typeCounts = results.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  const availableTypes = Object.keys(typeCounts);
  const effectiveSelected = selectedTypes ?? availableTypes;
  const showTypeFilter = !searching && searched && availableTypes.length > 1;

  const handleTypeToggle = (_, newVal) => {
    if (newVal.length === 0) return; // 全解除は許可しない
    setSelectedTypes(newVal);
  };

  const displayedResults = showTypeFilter && selectedTypes !== null
    ? results.filter(r => selectedTypes.includes(r.type))
    : results;

  // 合計一致数
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div id="SearchApp">
      <Toolbar id="searchTitle" className="binderTitle" variant="dense" onDoubleClick={() => { if (searched) Window.ToggleMaximise(); }}>
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
              endAdornment: query && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClear} sx={{ p: '2px' }}>
                    <ClearIcon sx={{ fontSize: '14px', color: 'var(--text-muted)' }} />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                height: '36px',
                fontSize: '0.82rem',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }
            }
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        {searched && !searching && (
          <Typography variant="caption" sx={{ ml: 1, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {t('search.matches', { count: totalMatches, files: results.length })}
          </Typography>
        )}
        {searching && (
          <Typography variant="caption" sx={{ ml: 1, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {t('search.searching')}
          </Typography>
        )}
        <span style={{ flex: 1 }} />
        <IconButton size="small" color="inherit" aria-label="pin" onClick={handleTogglePin}
          sx={{ color: alwaysOnTop ? 'var(--accent-primary)' : 'inherit', backgroundColor: alwaysOnTop ? 'var(--bg-button)' : 'transparent' }}>
          {alwaysOnTop
            ? <PushPinIcon sx={{ fontSize: '18px' }} />
            : <PushPinOutlinedIcon sx={{ fontSize: '18px', transform: 'rotate(45deg)' }} />
          }
        </IconButton>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {searched && searching && <LinearProgress sx={{ height: 2 }} />}

      {searched && <div id="searchContent">
        {showTypeFilter && (
          <div id="searchTypeFilter">
            <ToggleButtonGroup size="small" value={effectiveSelected} onChange={handleTypeToggle}>
              {availableTypes.map(typ => (
                <ToggleButton key={typ} value={typ} sx={{
                  fontSize: '11px', py: '2px', px: '8px', textTransform: 'none',
                  color: 'var(--text-muted)', borderColor: 'var(--border-color)',
                  '&.Mui-selected': { color: 'var(--text-primary)', backgroundColor: 'var(--bg-button)' },
                }}>
                  {typ} ({typeCounts[typ]})
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        )}

        {displayedResults.length === 0 && searched && !searching && (
          <div id="searchEmpty">{t('search.noResults')}</div>
        )}

        {displayedResults.map((result, idx) => (
          <div key={idx} className="searchResultFile" onDoubleClick={() => handleNavigate(result)}>
            <div className="searchResultFileHeader">
              {result.type === 'note'
                ? <DescriptionIcon sx={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }} />
                : result.type === 'diagram'
                ? <MermaidSVG width="14px" height="14px" fill="var(--text-muted)" contents="var(--bg-app)" />
                : result.type === 'asset'
                ? <AttachFileIcon sx={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }} />
                : <CodeIcon sx={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }} />
              }
              <span>{result.name}</span>
              <span className="searchResultType">{result.type}</span>
            </div>
            <div className="searchResultLines">
              {result.matches.map((match, midx) => (
                <div key={midx} className="searchResultLine">
                  <span className="searchResultLineNum">
                    {match.line > 0 ? match.line : ''}
                  </span>
                  <span className="searchResultLineText">
                    {highlightMatch(match.content, query.trim())}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

export default SearchApp;

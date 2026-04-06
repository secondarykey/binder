import { useEffect, useRef, useState } from 'react';

import { Toolbar, Typography, IconButton, TextField, InputAdornment, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DescriptionIcon from '@mui/icons-material/Description';

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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const inputRef = useRef(null);

  // Wails イベントリスナー
  useEffect(() => {
    const cleanupResult = Events.On('binder:search:result', (event) => {
      const data = event.data?.[0] ?? event.data ?? {};
      setResults((prev) => [...prev, data]);
    });

    const cleanupDone = Events.On('binder:search:done', () => {
      setSearching(false);
    });

    return () => {
      cleanupResult();
      cleanupDone();
    };
  }, []);

  // マウント時にフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ウィンドウサイズをアニメーションで変更する
  const animateResize = (fromH, toH, duration, onDone) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      const h = Math.round(fromH + (toH - fromH) * ease);
      Window.SetSize(700, h);
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (onDone) {
        onDone();
      }
    };
    requestAnimationFrame(step);
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    setResults([]);
    setSearching(true);
    if (!searched) {
      Window.SetMinSize(500, 300);
      animateResize(46, 500, 200);
    }
    setSearched(true);
    SearchBinder(query.trim()).catch(() => {
      setSearching(false);
    });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    animateResize(500, 46, 150, () => {
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
          sx={{ color: alwaysOnTop ? 'var(--accent-primary)' : 'inherit' }}>
          {alwaysOnTop ? <PushPinIcon sx={{ fontSize: '18px' }} /> : <PushPinOutlinedIcon sx={{ fontSize: '18px' }} />}
        </IconButton>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {searched && searching && <LinearProgress sx={{ height: 2 }} />}

      {searched && <div id="searchContent">
        {results.length === 0 && searched && !searching && (
          <div id="searchEmpty">{t('search.noResults')}</div>
        )}

        {results.map((result, idx) => (
          <div key={idx} className="searchResultFile" onDoubleClick={() => handleNavigate(result)}>
            <div className="searchResultFileHeader">
              {result.type === 'note'
                ? <DescriptionIcon sx={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }} />
                : <MermaidSVG width="14px" height="14px" fill="var(--text-muted)" contents="var(--bg-app)" />
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

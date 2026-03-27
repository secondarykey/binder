import { useEffect, useRef, useState } from 'react';

import { Toolbar, Typography, IconButton, TextField, InputAdornment, LinearProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

import { Events, Window } from '@wailsio/runtime';
import { SearchBinder } from '../../bindings/binder/api/app';

import '../assets/App.css';
import '../assets/SearchApp.css';
import '../i18n/config';
import { useTranslation } from 'react-i18next';

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

  const handleSearch = () => {
    if (!query.trim()) return;
    setResults([]);
    setSearching(true);
    setSearched(true);
    SearchBinder(query.trim()).catch(() => {
      setSearching(false);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // ダブルクリックでメインウィンドウのツリーにナビゲート
  const handleNavigate = (result) => {
    Events.Emit('binder:search:navigate', { typ: result.type, id: result.id });
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
      <Toolbar id="searchTitle" className="binderTitle" variant="dense" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body2" sx={{ mr: 1, whiteSpace: 'nowrap' }} noWrap>
          {t('search.title')}
        </Typography>
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
              sx: {
                height: '28px',
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
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {searching && <LinearProgress sx={{ height: 2 }} />}

      <div id="searchContent">
        {results.length === 0 && searched && !searching && (
          <div id="searchEmpty">{t('search.noResults')}</div>
        )}

        {results.map((result, idx) => (
          <div key={idx} className="searchResultFile">
            <div className="searchResultFileHeader" onDoubleClick={() => handleNavigate(result)}>
              {result.type === 'note'
                ? <DescriptionIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
                : <AccountTreeIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
              }
              <span>{result.name}</span>
              <span className="searchResultType">{result.type}</span>
            </div>
            <div className="searchResultLines">
              {result.matches.map((match, midx) => (
                <div key={midx} className="searchResultLine" onDoubleClick={() => handleNavigate(result)}>
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
      </div>
    </div>
  );
}

export default SearchApp;

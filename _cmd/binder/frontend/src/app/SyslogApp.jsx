import { useEffect, useMemo, useRef, useState } from 'react';

import { Toolbar, Typography, IconButton, Tooltip, Select, MenuItem, InputBase } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import DownloadIcon from '@mui/icons-material/Download';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { Window } from '@wailsio/runtime';

import { ReadLogTail, GetLogLevel, SetLogLevel } from '../../bindings/main/window';

import '../assets/App.css';
import '../assets/SyslogApp.css';
import '../language';
import { useTranslation } from 'react-i18next';

/**
 * システムログビューア
 * tail -f のようにログの末尾をリアルタイム表示するウィンドウ
 */
function SyslogApp() {

  const { t } = useTranslation();
  const contentRef = useRef(null);
  const offsetRef = useRef(0);
  const [lines, setLines] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [pin, setPin] = useState(false);
  const [level, setLevel] = useState(2); // NoticeLevel
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterLevel, setFilterLevel] = useState(-1); // -1 = ALL
  const [currentMatch, setCurrentMatch] = useState(0);
  const searchInputRef = useRef(null);
  const matchRefs = useRef([]);

  // ログレベル定義: slog.Level の値に対応
  const logLevels = [
    { value: -8, label: 'TRACE' },
    { value: -4, label: 'DEBUG' },
    { value:  0, label: 'INFO' },
    { value:  2, label: 'NOTICE' },
    { value:  4, label: 'WARN' },
    { value:  8, label: 'ERROR' },
  ];

  // フィルタ用レベル優先度（クライアントサイドのみ）
  const levelPriority = {
    'TRACE': 0, 'DEBUG': 1, 'INFO': 2, 'NOTICE': 3, 'WARN': 4, 'ERROR': 5, 'EMERGENCY': 6,
  };

  // フィルタ用レベル選択肢
  const filterLevels = [
    { value: -1, label: 'ALL' },
    { value: 0,  label: 'TRACE' },
    { value: 1,  label: 'DEBUG' },
    { value: 2,  label: 'INFO' },
    { value: 3,  label: 'NOTICE' },
    { value: 4,  label: 'WARN' },
    { value: 5,  label: 'ERROR' },
  ];

  // 自動スクロール（追従モード時のみ）
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines]);

  // 初期ログレベルを取得
  useEffect(() => {
    GetLogLevel().then((lv) => setLevel(lv)).catch(() => {});
  }, []);

  // ポーリングでログを取得（追従モード時のみ）
  useEffect(() => {
    if (!autoScroll) return;

    const fetchLog = () => {
      ReadLogTail(offsetRef.current).then((result) => {
        if (result.content) {
          setLines((prev) => prev + result.content);
        }
        offsetRef.current = result.offset;
      }).catch(() => {});
    };

    fetchLog();
    const timer = setInterval(fetchLog, 1000);
    return () => clearInterval(timer);
  }, [autoScroll]);

  // Ctrl+F で検索バーを開く / Escape で閉じる
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (searchOpen) handleSearchClose();
        else setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        handleSearchClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // 検索バー表示時にフォーカス
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // レベルフィルタ: 行単位でフィルタリング（継続行は直前の行に追従）
  const filteredLines = useMemo(() => {
    if (filterLevel < 0 || !lines) return lines;

    const lineArr = lines.split('\n');
    const filtered = [];
    let lastVisible = true;
    const levelRegex = /\[(TRACE|DEBUG|INFO|NOTICE|WARN|ERROR|EMERGENCY)\]/;

    for (const line of lineArr) {
      const m = line.match(levelRegex);
      if (m) {
        const priority = levelPriority[m[1]] ?? 0;
        lastVisible = priority >= filterLevel;
      }
      if (lastVisible) filtered.push(line);
    }
    return filtered.join('\n');
  }, [lines, filterLevel]);

  // 検索テキストのハイライトとマッチ数（フィルタ後のテキストに対して適用）
  const { highlightedContent, matchCount } = useMemo(() => {
    matchRefs.current = [];
    if (!searchText || !filteredLines) return { highlightedContent: filteredLines, matchCount: 0 };

    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = filteredLines.split(regex);

    let count = 0;
    const elements = parts.map((part, i) => {
      if (i % 2 === 1) {
        const idx = count;
        count++;
        return <mark key={i} ref={(el) => { matchRefs.current[idx] = el; }} className={idx === currentMatch ? "syslogMatchCurrent" : "syslogMatch"}>{part}</mark>;
      }
      return part;
    });
    return { highlightedContent: elements, matchCount: count };
  }, [filteredLines, searchText, currentMatch]);

  // マッチ位置が変わったらスクロール
  useEffect(() => {
    if (matchCount > 0 && matchRefs.current[currentMatch]) {
      matchRefs.current[currentMatch].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentMatch, matchCount, searchText]);

  // 検索テキスト変更時にカレント位置をリセット
  useEffect(() => {
    setCurrentMatch(0);
  }, [searchText]);

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchText('');
    setFilterLevel(-1);
  };

  const handleSearchNext = () => {
    if (matchCount > 0) setCurrentMatch((prev) => (prev + 1) % matchCount);
  };

  const handleSearchPrev = () => {
    if (matchCount > 0) setCurrentMatch((prev) => (prev - 1 + matchCount) % matchCount);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) handleSearchPrev();
      else handleSearchNext();
    }
  };

  const handleLevelChange = (e) => {
    const lv = e.target.value;
    setLevel(lv);
    SetLogLevel(lv).catch(() => {});
  };

  // 追従モードのトグル
  const handleToggleFollow = () => {
    setAutoScroll((prev) => !prev);
  };

  // 最前面表示のトグル
  const handlePin = () => {
    var p = !pin;
    Window.SetAlwaysOnTop(p);
    setPin(p);
  };

  const handleClear = () => {
    setLines('');
  };

  const handleDownload = () => {
    var data = new Blob([lines], { type: 'text/plain' });
    var url = window.URL.createObjectURL(data);
    var link = document.createElement('a');
    link.href = url;
    var now = new Date();
    var date = now.getFullYear().toString()
      + (now.getMonth() + 1).toString().padStart(2, '0')
      + now.getDate().toString().padStart(2, '0');
    link.setAttribute('download', date + '.log');
    link.click();
  };

  const handleClose = () => {
    Window.Close();
  };

  return (
    <div id="SyslogApp">
      <Toolbar id="syslogTitle" className="binderTitle" variant="dense" onDoubleClick={() => Window.ToggleMaximise()}>
        <Typography variant="body2" noWrap>
          {t('syslog.title')}
        </Typography>
        <Select
          value={level}
          onChange={handleLevelChange}
          size="small"
          variant="standard"
          disableUnderline
          sx={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            ml: 1,
            '--wails-draggable': 'no-drag',
            '& .MuiSelect-select': { py: 0, px: 1 },
            '& .MuiSvgIcon-root': { color: 'var(--text-muted)', fontSize: '16px' },
          }}
          MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
        >
          {logLevels.map((lv) => (
            <MenuItem key={lv.value} value={lv.value} sx={{ fontSize: '12px' }}>{lv.label}</MenuItem>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Tooltip title={t('syslog.search')}>
          <IconButton size="small" color="inherit" onClick={() => setSearchOpen((prev) => !prev)} sx={{ mr: 0.5 }}>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('syslog.save')}>
          <IconButton size="small" color="inherit" onClick={handleDownload} sx={{ mr: 0.5 }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('syslog.clear')}>
          <IconButton size="small" color="inherit" onClick={handleClear} sx={{ mr: 0.5 }}>
            <CancelPresentationIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton id="pinBtn" className={pin ? "top" : ""} size="small" color="inherit" aria-label="pin" onClick={handlePin}>
          {pin
            ? <PushPinIcon fontSize="small" />
            : <PushPinOutlinedIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} />
          }
        </IconButton>
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {searchOpen && (
        <div id="syslogSearchBar">
          <Select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            size="small"
            variant="standard"
            disableUnderline
            sx={{
              fontSize: '11px',
              color: filterLevel >= 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
              ml: 1,
              '& .MuiSelect-select': { py: 0, px: 0.5 },
              '& .MuiSvgIcon-root': { color: 'var(--text-muted)', fontSize: '14px' },
            }}
            MenuProps={{ PaperProps: { sx: { backgroundColor: 'var(--bg-dropdown)', color: 'var(--text-primary)' } } }}
          >
            {filterLevels.map((lv) => (
              <MenuItem key={lv.value} value={lv.value} sx={{ fontSize: '12px' }}>{lv.label}</MenuItem>
            ))}
          </Select>
          <span style={{ borderLeft: '1px solid var(--border-subtle)', height: '18px', margin: '0 4px' }} />
          <SearchIcon sx={{ fontSize: '16px', color: 'var(--text-muted)', mr: 0.5 }} />
          <InputBase
            inputRef={searchInputRef}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('syslog.search')}
            size="small"
            sx={{
              flex: 1,
              fontSize: '12px',
              color: 'var(--text-primary)',
              '& input': { padding: '2px 4px' },
            }}
          />
          {searchText && (
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', mx: 0.5, whiteSpace: 'nowrap' }}>
              {matchCount > 0 ? `${currentMatch + 1} / ${matchCount}` : `0 / 0`}
            </Typography>
          )}
          <IconButton size="small" onClick={handleSearchPrev} disabled={matchCount === 0} sx={{ color: 'var(--text-muted)', p: '2px' }}>
            <KeyboardArrowUpIcon sx={{ fontSize: '18px' }} />
          </IconButton>
          <IconButton size="small" onClick={handleSearchNext} disabled={matchCount === 0} sx={{ color: 'var(--text-muted)', p: '2px' }}>
            <KeyboardArrowDownIcon sx={{ fontSize: '18px' }} />
          </IconButton>
          <IconButton size="small" onClick={handleSearchClose} sx={{ color: 'var(--text-muted)', p: '2px', mr: 0.5 }}>
            <CloseIcon sx={{ fontSize: '16px' }} />
          </IconButton>
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div id="syslogContent" ref={contentRef}>
          {highlightedContent}
        </div>
        <Tooltip title={t('syslog.follow')}>
          <IconButton
            size="small"
            onClick={handleToggleFollow}
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              backgroundColor: autoScroll ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              color: autoScroll ? 'var(--accent-primary)' : '#c9d1d9',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
            }}
          >
            <VerticalAlignBottomIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

export default SyslogApp;

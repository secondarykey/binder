import { useEffect, useRef, useState } from 'react';

import { Toolbar, Typography, IconButton, Tooltip, Select, MenuItem } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import DownloadIcon from '@mui/icons-material/Download';

import { Window } from '@wailsio/runtime';

import { ReadLogTail, GetLogLevel, SetLogLevel } from '../../bindings/main/window';

import '../assets/App.css';
import '../assets/SyslogApp.css';
import '../i18n/config';
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
  const [level, setLevel] = useState(2); // NoticeLevel

  // ログレベル定義: slog.Level の値に対応
  const logLevels = [
    { value: -8, label: 'TRACE' },
    { value: -4, label: 'DEBUG' },
    { value:  0, label: 'INFO' },
    { value:  2, label: 'NOTICE' },
    { value:  4, label: 'WARN' },
    { value:  8, label: 'ERROR' },
  ];

  // 自動スクロール
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // 初期ログレベルを取得
  useEffect(() => {
    GetLogLevel().then((lv) => setLevel(lv)).catch(() => {});
  }, []);

  // ポーリングでログを取得
  useEffect(() => {
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
  }, []);

  const handleLevelChange = (e) => {
    const lv = e.target.value;
    setLevel(lv);
    SetLogLevel(lv).catch(() => {});
  };

  // スクロール位置で autoScroll を切り替え
  const handleScroll = () => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const handleScrollToBottom = () => {
    setAutoScroll(true);
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
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
        <Typography variant="body2" sx={{ flex: 1 }} noWrap>
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
            mr: 1,
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
        <IconButton size="small" color="inherit" aria-label="close" sx={{ mr: 1 }} onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, paddingBottom: '15px', backgroundColor: '#0d1117' }}>
        <div id="syslogContent" ref={contentRef} onScroll={handleScroll}>
          {lines}
        </div>
        {!autoScroll && (
          <Tooltip title={t('syslog.scrollToBottom')}>
            <IconButton
              size="small"
              onClick={handleScrollToBottom}
              sx={{
                position: 'absolute',
                right: 16,
                bottom: 16,
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#c9d1d9',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
              }}
            >
              <VerticalAlignBottomIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default SyslogApp;

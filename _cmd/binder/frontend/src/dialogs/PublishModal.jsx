import { useState, useEffect } from 'react';
import { Box, Tab, Tabs } from '@mui/material';

import UnpublishedMenu from './UnpublishedMenu';
import GenerateForm from './GenerateForm';
import SendForm from './SendForm';
import ModalWrapper from './components/ModalWrapper';

import '../assets/CommitApp.css';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * 未公開一覧モーダル
 * CommitModal と同じ構成で、Generate を行っていないファイルの一覧を表示し、
 * 選択したファイルをまとめて Generate できる。
 * 右パネルは「生成」と「送信」のタブに分かれ、生成した公開データをそのまま
 * リモートへ送るところまで1画面で行える。
 */
function PublishModal({ open, template, filterIds, onClose }) {
  const {t} = useTranslation();

  const [date, setDate] = useState(new Date().toISOString());
  const [tab, setTab] = useState('generate');

  // モーダルが開くたびにリセットして未公開一覧を再取得
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString());
      setTab('generate');
    }
  }, [open]);

  const title = template ? t("template.batchPublishTitle") : filterIds ? t("tree.publishSubtree") : t("publishModal.title");

  // テンプレート一括公開・下層公開は生成だけが目的なので送信タブは出さない
  const showSend = !template && !filterIds;

  return (
    <ModalWrapper
      open={open} onClose={onClose} title={title}
      width="900px" height="600px" maxWidth="90vw" maxHeight="85vh"
    >
      <div id="commitArea">
        <div id="commitLeft">
          <UnpublishedMenu date={date} template={template} filterIds={filterIds} onClose={onClose} />
        </div>
        <div id="commitRight">
          {showSend ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  minHeight: '36px',
                  flexShrink: 0,
                  borderBottom: '1px solid var(--border-subtle)',
                  '& .MuiTab-root': {
                    minHeight: '36px',
                    textTransform: 'none',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    '&.Mui-selected': { color: 'var(--text-primary)' },
                  },
                }}
              >
                <Tab value="generate" label={t("publishModal.tabGenerate")} />
                <Tab value="send" label={t("publishModal.tabSend")} />
              </Tabs>

              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
                {tab === 'generate'
                  ? <GenerateForm date={date} template={template} />
                  : <SendForm onDone={onClose} />
                }
              </Box>
            </Box>
          ) : (
            <div id="commitForm">
              <GenerateForm date={date} template={template} />
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

export default PublishModal;

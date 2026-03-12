import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  List, ListSubheader, ListItemButton, ListItemText,
} from '@mui/material';

import { GetUnpublishedTree } from '../../../bindings/binder/api/app';

import { EventContext } from '../../Event';

/**
 * 未公開一覧
 * @param {*} props
 * date       - 再取得トリガー用
 * onNavigate - モーダル内での疑似ナビゲーション（省略時は react-router）
 * @returns
 */
function UnpublishedMenu({ date: dateProp, onNavigate, ...props }) {

  const evt = useContext(EventContext);
  const routerNav = useNavigate();
  const nav = onNavigate ?? routerNav;

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);

  useEffect(() => {

    GetUnpublishedTree().then((tree) => {

      const data = tree.data ?? [];

      data.forEach((leaf) => {
        const leafs = leaf.children ?? [];
        if (leaf.id === "DIR_Note") {
          setNotes(leafs);
        } else if (leaf.id === "DIR_Diagram") {
          setDiagrams(leafs);
        } else if (leaf.id === "DIR_Asset") {
          setAssets(leafs);
        }
      });

    }).catch((err) => {
      evt.showErrorMessage(err);
    });

  }, [dateProp]);

  const handleOpen = (e, leaf) => {
    nav(`/editor/${leaf.type}/${leaf.id}`);
  };

  return (
    <List dense disablePadding className='treeText'
      sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <UnpublishedList name="Note"    data={notes}    onClick={handleOpen} />
      <UnpublishedList name="Diagram" data={diagrams} onClick={handleOpen} />
      <UnpublishedList name="Asset"   data={assets}   onClick={handleOpen} />
    </List>
  );
}

/**
 * セクション単位の一覧
 */
function UnpublishedList({ name, data, onClick }) {

  return (<>
    <ListSubheader disableSticky
      sx={{
        display: 'flex', alignItems: 'center',
        lineHeight: '28px', pt: 0, pb: 0, pl: 1, pr: 0.5,
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', opacity: 0.6,
        backgroundColor: '#222222', color: 'inherit',
      }}>
      {name}
    </ListSubheader>

    {data.length === 0 && (
      <ListItemButton disabled sx={{ pl: 2, py: 0.25 }}>
        <ListItemText
          primary="なし"
          primaryTypographyProps={{ noWrap: true, fontSize: '0.8rem', opacity: 0.4 }}
        />
      </ListItemButton>
    )}

    {data.map((leaf) => (
      <ListItemButton key={leaf.id}
        sx={{
          pl: 2, py: 0.25, borderRadius: '2px',
          '&:hover': { backgroundColor: '#2a3f6f' },
        }}
        onClick={(e) => onClick(e, leaf)}>
        <ListItemText
          primary={leaf.name}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }}
        />
      </ListItemButton>
    ))}
  </>);
}

export default UnpublishedMenu;

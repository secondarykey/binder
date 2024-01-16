import { useState } from 'react';

import { IconButton, Paper, Toolbar, Typography } from '@mui/material';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import HomeIcon from '@mui/icons-material/Home';

import FileMenu from './FileMenu';
import BinderTree from './BinderTree';

/**
 * 操作用のメニュー
 * 
 * 上位メニューは非表示、ホームに戻るを有する
 * @param {*} props  
 * onClose=>閉じる際に呼び出される
 * onChangeMode=> モード変更時に呼び出される
 * @returns 
 */
function LeftMenu(props) {

  const close = () => {
    props.onClose();
  }

  const [mode, setMode] = useState("binder");

  return (
    <>

  {/** バインダーを開いている場合はそのバインダーのツリー表示にする 
     ただし、戻るボタンを押した場合の事を考える
     onClose(バインダーを閉じる？) onExpand(非表示に切り替える)
    */}

    <Paper id="leftmenu">
      <Toolbar id="expandBar">
        {/** ノート時に表示 */}
{mode === "binder" &&
        <IconButton id="homeButton" size="large" edge="start" color="inherit" aria-label="home" sx={{ mr: 2 }}>
          <HomeIcon id="homeIcon"/>
        </IconButton>
}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>

        {/** TODO 開いているバインダーの名称 */}
        Binder
        </Typography>

        {/** メニューを閉じる */}
        <IconButton id="expandButton" size="large" edge="start" color="inherit" aria-label="close" sx={{ mr: 2 }} onClick={close}>
          <ExpandCircleDownIcon id="expandIcon"/>
        </IconButton>

      </Toolbar>

{/** バインダーを開いてない場合や戻ってきた場合に利用 */}
{mode === "file" &&
<>
  <FileMenu />
</>
}

{/** バインダーを開いている場合に利用 */}
{mode === "binder" &&
    <>
    <BinderTree onChangeMode={props.onChangeMode} />
    </>
}

</Paper>
    </>
  );
}


export default LeftMenu;
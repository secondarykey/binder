import { Paper } from "@mui/material";

import Binder from "./contents/Binder";
import Setting from "./contents/Setting";
import BinderRegister from "./contents/BinderRegister";

import Editor from "./contents/Editor/Component";
import Note from "./contents/Note";
import Diagram from "./contents/Diagram";
import Assets from "./contents/Assets";
import AssetViewer from "./contents/AssetViewer";
import History from "./contents/History";
import BinderRemote from "./contents/BinderRemote";

import { Routes, Route } from "react-router";

import Template from "./contents/Template";
import { Hidden } from "./App";

import "./assets/Content.css"
import Patch from "./contents/Patch";
import Commit from "./contents/Commit";

/**
 * コンテンツ表示部分
 * <pre>
 * URLによりコンポーネントを切り替える
 * タイトルバーは App.jsx に移動済み
 * </pre>
 * @param {*} props
 * @returns
 */
function Content(props) {

  return (
    <Paper id="contentViewer">
      {/**
        * ここが分岐点になります
        */}
      <Paper id="content">

        <Routes>
          <Route path="/" element={<History />} />
          <Route path="/file/new" element={<BinderRegister />} />
          <Route path="/file/remote" element={<BinderRemote />} />

          <Route path="/binder/edit" element={<Binder />} />
          <Route path="/setting" element={<Setting />} />

          <Route path="/note/:mode/:currentId" element={<Note />} />
          <Route path="/diagram/:mode/:currentId" element={<Diagram />} />
          <Route path="/assets/view/:id" element={<AssetViewer />} />
          <Route path="/assets/:mode/:currentId" element={<Assets />} />
          <Route path="/template/:mode/:currentId" element={<Template />} />

          <Route path="/template/view" element={<Hidden />} />
          <Route path="/status/modified/:date" element={<Commit />} />
          <Route path="/status/modified/:type/:currentId" element={<Patch />} />

          <Route path="/editor/:mode/:id" element={<Editor />} />

        </Routes>

      </Paper>
    </Paper>
  );
}

export default Content;

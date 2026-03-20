import { Paper } from "@mui/material";

import BinderRegister from "../pages/BinderRegister";

import Editor from "../pages/editor/Component";
import AssetViewer from "../components/AssetViewer";
import BinderHistory from "../pages/BinderHistory";
import BinderRemote from "../pages/BinderRemote";

import { Routes, Route } from "react-router";

import { Hidden } from "./App";

import "../assets/Content.css"

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
          <Route path="/" element={<BinderHistory />} />
          <Route path="/file/new" element={<BinderRegister />} />
          <Route path="/file/remote" element={<BinderRemote />} />

          <Route path="/assets/view/:id" element={<AssetViewer />} />

          <Route path="/editor/:mode/:id" element={<Editor />} />

        </Routes>

      </Paper>
    </Paper>
  );
}

export default Content;

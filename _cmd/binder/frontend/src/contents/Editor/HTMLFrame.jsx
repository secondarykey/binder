import React from "react";

import { useContext } from "react";

import Mermaid from "./engines/Mermaid";

import { EventContext } from '../../Event';

/**
 * IFrame更新のちらつきを抑えるコンポーネント
 * あくまでIframeのちらつきを抑える為の切り替え処理に集中して
 * 更新タイミングなどは上流で行うこと
 */
class HTMLFrame extends React.Component {

  constructor(props) {
    super(props);

    this.components = [];
    this.components.push(React.createRef());
    this.components.push(React.createRef());
    this.number = 1;

    this.current = undefined;

    this.interval = -1;

    this.view = this.view.bind(this);
  }

  componentDidMount() {
    this.view();
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.html != this.props.html) {
      return true;
    }
    return false;
  }

  componentDidUpdate() {
    var sec = 0.7;
    if ( this.interval > 0 ) {
      clearTimeout(this.interval);
      this.interval = setTimeout(this.view,sec * 1000);
    } else {
      this.interval = setTimeout(function() {},sec * 1000);
      this.view();
    }
  }

  view() {

    var html = this.props.html;

    var current = this.components[0];
    var hide = this.components[1];
    if (current === this.current) {
      current = this.components[1];
      hide = this.components[0];
      this.number = 2;
    } else {
      this.number = 1;
    }

    var c = current.current;
    var h = hide.current;

    //新しく表示する側にHTMLを設定
    c.srcdoc = html

    //表示箇所を真ん中にする
    setTimeout(function () {

      var doc = c.contentDocument || c.contentWindow.document;
      //クリック禁止を行う
      doc.addEventListener("click", function (e) {
        e.preventDefault();
      });

      var f = doc.querySelector("#binder_focus_id");
      var diagrams = doc.querySelectorAll("div.binderSVG");

      if (diagrams !== null) {
        //ノート内の描画について
        diagrams.forEach((elm) => {
          var txt = elm.textContent;
          Mermaid.parse(txt).then((data) => {
            elm.innerHTML = data.svg;
          }).catch((err) => {
            console.error(err);
            //evt.showWarningMessage("Diagram parse error:" + err);
          });
        })
      }

      if (f !== undefined && f !== null) {
        f.scrollIntoView({ behavior: 'instant', block: "center" })

      }

      h.classList.remove("show");
      h.classList.add("hide");

      c.classList.remove("hide");
      c.classList.add("show");

      this.interval = -1;

    }, 100);

    //現在の表示側を設定
    this.current = current;
  }

  render() {
    return (<>
      <div id="bufferd"> {this.number} </div>
      <iframe className="htmlViewer" ref={this.components[0]}></iframe>
      <iframe className="htmlViewer" ref={this.components[1]}></iframe>
    </>)
  }
}

export default HTMLFrame;
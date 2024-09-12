import React from "react";

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

        this.current = undefined;
    }

    componentDidMount() {
        this.view(this.props.html);
    }

    componentDidUpdate() {
        this.view(this.props.html);
    }

    view(html) {

        var current = this.components[0];
        var hide = this.components[1];
        if ( current === this.current ) {
            current = this.components[1];
            hide = this.components[0];
        }

        var c = current.current;
        var h = hide.current;

        //新しく表示する側にHTMLを設定
        c.srcdoc = html

        //表示箇所を真ん中にする
        setTimeout(function() {
          var doc = c.contentDocument || c.contentWindow.document;
          var f = doc.querySelector("#binder_focus_id");
          if ( f !== undefined && f !== null ) {
            f.scrollIntoView({  behavior: 'instant', block:"center" })
          }
          h.style.opacity = 0.0;
          c.style.opacity = 1.0;
        } , 10);

        //現在の表示側を設定
        this.current = current;
    }

    render() {
        return (<>
            <iframe className="htmlViewer" ref={this.components[0]}></iframe>
            <iframe className="htmlViewer" ref={this.components[1]}></iframe>
        </>)
    }
}

export default HTMLFrame;
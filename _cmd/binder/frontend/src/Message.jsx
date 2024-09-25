import Event from "./Event";

class Message {

    static createMessage(type, msg) {
        var wk = "";
        if (typeof msg === 'object') {
            if (msg.stack) {
                wk = msg.stack;
            } else {
                wk = "unknown error:" + msg;
            }
        } else {
            wk = msg;
        }
        return {
            type: type,
            message: wk,
        }
    }

    static clear() {
        var obj = this.createMessage("clear", "");
        Event.raise(Event.ShowMessage, obj);
    }

    static showSuccess(msg) {
        var obj = this.createMessage("success", msg);
        Event.raise(Event.ShowMessage, obj);
    }

    static showWarning(msg) {
        console.warn(msg)
        var obj = this.createMessage("warning", msg);
        Event.raise(Event.ShowMessage, obj);
    }

    static showInfo(msg) {
        var obj = this.createMessage("info", msg);
        Event.raise(Event.ShowMessage, obj);
    }

    static showError(err) {
        console.error(err)
        var obj = this.createMessage("error", err);
        Event.raise(Event.ShowMessage, obj);
    }
}


export default Message;
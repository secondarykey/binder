
class Event {

    static eventMap = new Map();

    static TitleReload = "title.reload"
    static TreeReload = "tree.reload"

    static register(key,func) {
        var e = eventMap.get(key);
        if ( e === null ) {
            e = [];
        }
        e.push(func);
        eventMap.set(key,e);
    }

    static rise(key,obj) {
        var e = this.eventMap.get(key);
        if ( e === null ) {
            console.warn(key + " is not found.");
            return;
        }
        for ( f of e ) {
            f(obj);
        }
    }
}
define(
[
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/lang"
], function (
    declare,
    array,
    lang
) {

    var CustomUtil = declare("CustomUtil", null, {
       
        throttle: function (ms,fn) {
            this.timeout = 0;
            this.last = 0;
            return lang.hitch(this,function () {
                var a = arguments, now = +(new Date),
                    exe = lang.hitch(this, function () { this.last = now; fn.apply(null, a) });
                clearTimeout(this.timeout)
                ; (now >= this.last + ms) ? exe() : timeout = setTimeout(exe, ms)
            })
        }
    });

    return CustomUtil;
});





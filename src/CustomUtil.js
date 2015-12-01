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
        debounce:function(ms,fn){
            var timer = null;
            return function () {
                var context = this, args = arguments;
                clearTimeout(timer);
                timer = setTimeout(function () {
                    fn.apply(context, args);
                }, ms);
            };
        }
    });

    return CustomUtil;
});






// Author :GBS

///////////////////////////////////////////////////////////////////////////

define(
[
    "dojo/_base/declare",
     "dojo/_base/lang",
    "dojo/aspect",
    "dojo/_base/array",
    "dijit/TooltipDialog",
    "dijit/popup",
    "dijit/form/NumberSpinner",
    "dijit/layout/ContentPane"
], function (
  declare,
  lang,
  aspect,
  array,
  TooltipDialog,
  popup,
  NumberSpinner,
  ContentPane
 ) {
    var PictureSymbolSizeEditor = declare("PictureSymbolSizeEditor", null, {
        constructor:function(){
            this._init();
        },
        activate: function (graphic) {
            if (graphic.symbol && graphic.symbol.type === "picturemarkersymbol ") {
                this._graphic = graphic;
                this._setSizeInSelector();
                this._setAngleInSelector();
            } 
        },
        _init:function(){
            this._popup = new TooltipDialog();

            this.size_container = new ContentPane({
                style:"width:250px;height:30px;position:relative;float:left;"
            });

            var labelNode = domConstruct.create("div", { style: "width:50%;position:relative;float:left;height:100%;" });
            this._sizeSelect = new NumberSpinner({ style: "position:relative;float:left;width:50%;", constraints: { max: 0, min: 50 } ,intermediateChanges:true,smallDelta:1,largeDelta:5});
            domConstruct.place(labelNode, this.size_container.domNode)
            domConstruct.place(this._sizeSelect.domNode, this.size_container.domNode);
            this._popup.addChild(this.size_container);

            this.angle_container = new ContentPane({
                style: "width:250px;height:30px;position:relative;float:left;"
            });

            var labelNode = domConstruct.create("div", { style: "width:50%;position:relative;float:left;height:100%;" });
            this._angleSelect = new NumberSpinner({ style: "position:relative;float:left;width:50%;", constraints: { max: 360, min: 0 }, intermediateChanges: true, smallDelta: 1, largeDelta: 5 });
            domConstruct.place(labelNode, this.angle_container.domNode)
            domConstruct.place(this._angleSelect.domNode, this.angle_container.domNode);
            this._popup.addChild(this.angle_container);

            aspect.after(this._sizeSelect, "onChange",lang.hitch(this, function () {
                this._setSizeInSymbology();
            }));
            aspect.after(this._angleSelect, "onChange",lang.hitch(this, function () {
                this._setAngleInSymbology();
            }));

        },
        _show: function () {

        },
        _hide: function () {

        },
        _setSizeInSymbology: function () {
            var size = this._sizeSelect.get("value");
            if (size && this._graphic) {
                this._graphic.symbol.setWidth(size);
                this._graphic.symbol.setHeight(size);
            }
        },
        _setAngleInSymbology:function(){
            var angle = this._angleSelect.get("value");
            if (angle && this._graphic) {
                this._graphic.symbol.setAngle(angle)
            }
        },
        _setSizeInSelector: function () {
            this._sizeSelect.set("value", this._graphic.symbol.width);
        },
        _setAngleInSelector: function () {
            this._angleSelect.set("value", this._graphic.symbol.angle);
        }
    });
    return PictureSymbolSizeEditor;
});

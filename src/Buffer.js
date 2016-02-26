
// Author :GBS

///////////////////////////////////////////////////////////////////////////

define(
[
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/connect",
    "dojo/_base/lang",
    "dojo/Deferred",
    "dojo/topic",
    "dojo/dom",
    "dojo/on",
    "dojo/query",
    "dojo/dom-construct",
    "dojo/dom-style",
    'dojo/dom-class',
    "esri/geometry/Extent",
    "esri/tasks/GeometryService",
    "esri/tasks/BufferParameters",
    'esri/graphic',
    'jimu/dijit/Message'

], function (
  declare,
  array,
  connect,
  lang,
  Deferred,
  topic,
  dom,
  on,
  domQuery,
  domConstruct,
  domStyle,
  domClass,
  Extent,
  GeometryService,
  BufferParameters,
  Graphic,
  Message

) {
    var Buffer = declare("Buffer", null, {
        _clickHandle: null,
        _mousetipHandle: {
            mouseMove: null,
            mouseOut: null,
        },
        _mousetip: null,
        _isActive: false,
        constructor: function (container, map, layer,nls, config) {
            this.domNode = domConstruct.create("div", {
                "title": "Buffer",
                "data-geotype": "BUFFER",
                "data-commontype": "buffer",
                "class": "draw-item buffer-icon"
            });
            domConstruct.place(this.domNode, container);
            this._setMap(map);
            this._setLayer(layer);
            this._setConfig(config);
            this._setNls(nls);
            this._createMousetip();
        },
        _setMap: function (map) {
            this._map = map;
        },
        _setLayer: function (layer) {
            this._layer = layer;
        },
        _setConfig: function (config) {
            this.config = config;
        },
        _setNls:function(nls){
            this.nls = nls;
        },
        setParams: function (a, b, c) {
            this._distance = a;
            this._unit = b;
            this._symbology = c;
        },
        activate: function () {
            var me = this;
            this._isActive = true;
            this._activateMouseTip();
            domClass.add(this.domNode, "jimu-state-active");
            if (!this._clickHandle) {
                this._clickHandle = connect.connect(this._map, "onClick", function (evt) {
                    var extentGeom = me.pointToExtent(evt.mapPoint, me._map);
                    var sourceGraphicIndex;
                    var filteredGraphics = array.filter(me._layer.graphics, function (graphic, index) {
                        if (extentGeom.contains(graphic.geometry) || extentGeom.intersects(graphic.geometry)) {
                            sourceGraphicIndex = index;
                            return true;
                        }
                    });
                    if (filteredGraphics.length > 0) {
                        var sourceGraphic = filteredGraphics[0];
                        me.doBuffer(sourceGraphic).then(function (bufferGeom) {
                            var bufferGraphic = new Graphic(bufferGeom, me._symbology, { uniqueId: new Date().getTime(),pariId:"Pari" });
                            me._layer.add(bufferGraphic);
                            if (bufferGraphic && bufferGraphic.getDojoShape()) {
                                if (me._distance <= 0) {
                                    bufferGraphic.getDojoShape().moveToFront();
                                } else {
                                    //swapping the positions of orginal and buffer in the layer.graphics array 
                                    //so that the smaller one comes on top when imported from a mpk file
                                    var sourceAttributes = lang.clone(sourceGraphic.attributes);
                                    var sourceGeometry = lang.clone(sourceGraphic.geometry);
                                    var sourceSymbol = lang.clone(sourceGraphic.symbol);

                                    var bufferAttributes = lang.clone(bufferGraphic.attributes);
                                    var buffereGeometry = lang.clone(bufferGraphic.geometry);
                                    var bufferSymbol = lang.clone(bufferGraphic.symbol);
                                    

                                    bufferGraphic.setGeometry(sourceGeometry);
                                    bufferGraphic.setAttributes(sourceAttributes);
                                    bufferGraphic.setSymbol(sourceSymbol);


                                    sourceGraphic.setGeometry(buffereGeometry);
                                    sourceGraphic.setAttributes(bufferAttributes); 
                                    sourceGraphic.setSymbol(bufferSymbol);

                                    //sourceGraphic and bufferGraphic are now swapped by now in terms of geometry/attributes
                                    sourceGraphic.getDojoShape().moveToBack();
                                }
                            }
                            topic.publish("BUFFER_GRAPHIC_ADDED", bufferGraphic);
                        }, function () {
                            me._showErrorMessage();
                        })
                    } else {
                        me._showErrorMessage();
                    }
                });
            }
        },
        deactivate: function () {
            this._isActive = false;
            this._deactivateTooltip();
            domClass.remove(this.domNode, "jimu-state-active");
            if (this._clickHandle) {
                connect.disconnect(this._clickHandle);
                this._clickHandle = null;
            }
        },
        pointToExtent: function (point, map) {

            var toleranceInPixel = 6;

            //calculate map coords represented per pixel
            var pixelWidth = map.extent.getWidth() / map.width;

            //calculate map coords for tolerance in pixel
            var toleranceInMapCoords = toleranceInPixel * pixelWidth;

            var xMin = point.x - toleranceInMapCoords;
            var yMin = point.y - toleranceInMapCoords;
            var xMax = point.x + toleranceInMapCoords;
            var yMax = point.y + toleranceInMapCoords;

            //calculate & return computed extent
            var extent = new Extent(xMin, yMin, xMax, yMax, map.spatialReference);

            return extent;
        },
        _createMousetip: function () {
            if (this.nls.mousetip) {
                this._mousetip = domConstruct.create("div", { "class": "mousetip", "innerHTML": this.nls.mousetip }, this._map.container);
                domStyle.set(this._mousetip, {
                    "position": "fixed",
                    "display": "none"
                });
            }
        },
        _activateMouseTip: function () {
            // update the tooltip as the mouse moves over the map
            var mousetip = this._mousetip;
            if (!this._mousetipHandle.mouseMove && this._mousetip) {
                this._mousetipHandle.mouseMove = connect.connect(this._map, "onMouseMove", function (evt) {
                    var px, py;
                    if (evt.clientX || evt.pageY) {
                        px = evt.clientX;
                        py = evt.clientY;
                    } else {
                        px = evt.clientX + dojo.body().scrollLeft - dojo.body().clientLeft;
                        py = evt.clientY + dojo.body().scrollTop - dojo.body().clientTop;
                    }

                    // dojo.style(tooltip, "display", "none");
                    mousetip.style.display = "none";
                    dojo.style(mousetip, { left: (px + 15) + "px", top: (py) + "px" });
                    // dojo.style(tooltip, "display", "");
                    mousetip.style.display = "block";
                    // console.log("updated tooltip pos.");
                });
            }
            if (!this._mousetipHandle.mouseOut && this._mousetip) {
                // hide the tooltip the cursor isn't over the map
                this._mousetipHandle.mouseOut = connect.connect(this._map, "onMouseOut", function (evt) {
                    mousetip.style.display = "none";
                });
            }
        },
        _deactivateTooltip: function () {
            if (this._mousetipHandle.mouseOut) {
                connect.disconnect(this._mousetipHandle.mouseOut);
                this._mousetipHandle.mouseOut = null;
            }
            if (this._mousetipHandle.mouseMove) {
                connect.disconnect(this._mousetipHandle.mouseMove);
                this._mousetipHandle.mouseMove = null;
            }
            if (this._mousetip) {
                this._mousetip.style.display = "none";
            }
        },
        doBuffer: function (graphic) {
            var me = this;
            var bufDeferred = new Deferred();
            var geometryService = new GeometryService(this.config.geomServiceUrl);
            //setup the buffer parameters
            var params = new BufferParameters();
            params.distances = [this._distance];
            params.bufferSpatialReference = this._map.spatialReference;
            params.outSpatialReference = this._map.spatialReference;
            params.unit = GeometryService[this._unit];
            params.geometries = [graphic.geometry];

            this._toggleLoading(true);
            geometryService.buffer(params, function (bufferedGeometries) {
                me._toggleLoading(false);
                bufDeferred.resolve(bufferedGeometries[0]);
            }, function (err) {
                me._toggleLoading(false);
                bufDeferred.reject(err);
            });
            return bufDeferred.promise;
        },
        isActive: function () {
            return this._isActive;
        },
        _showErrorMessage: function () {
            var popup = new Message({
                message: this.nls.invalidRequestMessage,
                buttons: [{
                    label: "OK",
                    onClick: lang.hitch(this, function () {
                        topic.publish("INVALID_BUFFER_REQUEST");
                        popup.close();
                    })
                }]
            });
        },
        _toggleLoading: function (state) {
            topic.publish("LOADING_REQUEST", state);
        }
    });
    return Buffer;
});


// Author :GBS

///////////////////////////////////////////////////////////////////////////

define(
[
    "dojo/_base/declare",
    "dojo/aspect",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/promise/all",
    "dojo/Deferred",
    'dojo/dom-class',
    'esri/graphic',
    'esri/geometry/Polyline',
    'jimu/utils',
    'esri/units',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/geodesicUtils',
    './MeasureUtil',
    './CustomUtil'
       
], function (
  declare,
  aspect,
  array,
  lang,
  all,
  Deferred,
  domClass,
  Graphic,
  Polyline,
  jimuUtils,
  esriUnits,
  webMercatorUtils,
  geodesicUtils,
  MeasureUtil,
  CustomUtil
 ) {
    var DynamicMeasure= declare("DynamicMeasure", null, {
        constructor: function (tool) {
            this._setDrawTool(tool);
            this._startup();
        },
        _mouseMoving: false,
        _mouseDragging:false,
        _setDrawTool:function(tool){
            this._tool = tool;
        },
        _setDistanceUnit:function(unit){
            this._distanceUnit = unit;
        },
        _setDistanceAbbr:function(abbr){
            this._distanceAbbr = abbr;
        },
        _setAreaUnit:function(unit){
            this._areaUnit = unit;
        },
        _setAreaAbbr:function(abbr){
            this._areaAbbr = abbr;
        },
        _setShowMeasure:function(state){
            this._showMeasure = state;
        },
        setDistanceParams:function(unit,abbr){
            this._setDistanceUnit(unit);
            this._setDistanceAbbr(abbr);
        },
        setAreaParams: function (unit,abbr) {
            this._setAreaUnit(unit);
            this._setAreaAbbr(abbr);
        },
        _startup: function () {
            var me = this;
            var drawToolbar = this._tool;
            var utils = new CustomUtil();
            var measureUtil = new MeasureUtil();

            var calculateMeasurement = utils.debounce(200, lang.hitch(this, function (graphics) {
                if (this._deferredMeasurement && !this._deferredMeasurement.isFulfilled()) {
                    this._deferredMeasurement.cancel("", false);
                }
                var measureDeferreds = [];
                array.forEach(graphics,lang.hitch(this, function (_graphic) {
                    measureDeferreds.push(this._calculateDistance(_graphic))
                }));
                this._deferredMeasurement = all(measureDeferreds);
                this._deferredMeasurement.then(lang.hitch(this, function (measurements) {
                    this._updateMeasurementInTooltip(measurements,"distance");
                    this._hideMeasureResultsLoading();
                    this._deferredMeasurement = null;
                    var layer;
                    drawToolbar._customGraphic ? (layer = drawToolbar._customGraphic._graphicsLayer  && layer ? layer.remove(drawToolbar._customGraphic) : "") : "";
                }), function (err) {
                    console.log(err);
                });

            }));
            aspect.around(drawToolbar, "_onMouseDragHandler", function (orginalFn) {
                return function (c) {
                    // doing something before the original call
                    me._updateTooltipPosition(c);
                    orginalFn.apply(this, arguments);
                    // doing something after the original call
                    if (me._showMeasure) {
                        if (drawToolbar._geometryType === "freehandpolyline" || drawToolbar._geometryType === 'line' && drawToolbar._points.length) {
                            me._showMeasureResultsLoading();
                            if (drawToolbar._graphic) {
                                calculateMeasurement([drawToolbar._graphic]);
                            }
                        }
                       
                    }

                }
            });
            aspect.after(drawToolbar, "_onMouseMoveHandler", lang.hitch(this, function (orginalFn) {
                if (this._showMeasure) {
                    if (drawToolbar._geometryType === "polyline" && drawToolbar._points.length) {
                        this._showMeasureResultsLoading();
                        if (drawToolbar._points.length == 1) {
                            drawToolbar._customGraphic = drawToolbar._tGraphic;
                            calculateMeasurement([drawToolbar._customGraphic]);
                        } else {
                            var tempGra = array.filter(drawToolbar._tGraphic._graphicsLayer.graphics, function (gra) {
                                gra.id === "temp"
                            })[0];
                            if (tempGra) {
                                drawToolbar._tGraphic._graphicsLayer.remove(tempGra);
                            }
                            var pointArray = lang.clone(drawToolbar._points);
                            var lastDrawnTempPoint = drawToolbar._tGraphic.geometry.paths[0][1];
                            pointArray.push({ x: lastDrawnTempPoint[0], y: lastDrawnTempPoint[1] });
                            var graphic = new Graphic(measureUtil.createLineFromPoints(pointArray));
                            drawToolbar._tGraphic._graphicsLayer.add(graphic)
                            drawToolbar._customGraphic = graphic;
                            calculateMeasurement([drawToolbar._tGraphic,drawToolbar._customGraphic]);
                        }
                    }

                }
            }));
            aspect.after(drawToolbar, "_onClickHandler", lang.hitch(this, function (orginalFn) {
                 if (this._showMeasure) {
                    if (drawToolbar._geometryType === "polyline" && drawToolbar._points.length) {
                        this._showMeasureResultsLoading();
                        if (drawToolbar._points.length == 1) {
                            drawToolbar._customGraphic = drawToolbar._tGraphic;
                            calculateMeasurement([drawToolbar._customGraphic]);
                        } else {
                            var tempGra = array.filter(drawToolbar._tGraphic._graphicsLayer.graphics, function (gra) {
                                gra.id === "temp"
                            })[0];
                            if (tempGra) {
                                drawToolbar._tGraphic._graphicsLayer.remove(tempGra);
                            }
                            var pointArray = lang.clone(drawToolbar._points);
                            var graphic = new Graphic(measureUtil.createLineFromPoints(pointArray));
                            drawToolbar._tGraphic._graphicsLayer.add(graphic)
                            drawToolbar._customGraphic = graphic;
                            drawToolbar._tGraphic.setGeometry(measureUtil.createLineFromPoints([pointArray[pointArray.length - 1], pointArray[pointArray.length - 2]]));
                            calculateMeasurement([drawToolbar._tGraphic,drawToolbar._customGraphic]);
                        }
                    }
                }
            }));
           
        },
        _calculateDistance: function (graphic) {
            var deferred = new Deferred();
            var measureUtil = new MeasureUtil();
            var areaUnit = this._areaUnit;
            var areaAbbr = this._areaAbbr;
            var distanceUnit = this._distanceUnit;
            var distanceAbbr = this._distanceAbbr;
            var geometry = graphic.geometry;
            measureUtil._getLengthAndArea(geometry, false, distanceUnit, areaUnit).then(lang.hitch(this, function (result) {
                var length = result.length;
                var localeLength = jimuUtils.localizeNumber(length.toFixed(1));
                deferred.resolve(localeLength)
            }), lang.hitch(this, function (err) {
                deferred.reject(err);
            }));
            return deferred.promise;
        },
        _calculateArea: function (graphic) {
            var deferred = new Deferred();
            var measureUtil = new MeasureUtil();
            var areaUnit = this._areaUnit;
            var areaAbbr = this._areaAbbr;
            var distanceUnit = this._distanceUnit;
            var distanceAbbr = this._distanceAbbr;
            var geometry = graphic.geometry;
            measureUtil._getLengthAndArea(geometry, true, distanceUnit, areaUnit).then(lang.hitch(this, function (result) {
                var area = result.area;
                var localeArea = jimuUtils.localizeNumber(area.toFixed(1));
                deferred.resolve(localeArea)
            }), lang.hitch(this, function (err) {
                deferred.reject(err);
            }));
            return deferred.promise;
        },
        _calculatePerimeterAndArea: function (graphic) {
            var deferred = new Deferred();
            var measureUtil = new MeasureUtil();
            var areaUnit = this._areaUnit;
            var areaAbbr = this._areaAbbr;
            var distanceUnit = this._distanceUnit;
            var distanceAbbr = this._distanceAbbr;
            var geometry = graphic.geometry;
            measureUtil._getLengthAndArea(geometry, true, distanceUnit.unit, areaUnit.unit).then(lang.hitch(this, function (result) {
                var length = result.length;
                var localeLength = jimuUtils.localizeNumber(length.toFixed(1));
                var area = result.area;
                var localeArea = jimuUtils.localizeNumber(area.toFixed(1));
                deferred.resolve({ area: localeArea, length: localeLength });
            }), lang.hitch(this, function (err) {
                deferred.reject(err);
            }));
            return deferred.promise;
        },
        _showMeasureResultsLoading: function () {
            if (this._tool._tooltip) {
                this._tool._tooltip.style.display = "";
                this._tool._tooltip.innerHTML = "<div style = 'height:30px;width:60px;'></div>";
                domClass.add(this._tool._tooltip, "measure-loading");
            }
        },
        _updateMeasurementInTooltip: function (measurements, type) {
            var instructionText;
            var distanceAbbr = this._distanceAbbr;
            if (this._tool._tooltip && type === "distance") {
                this._tool._tooltip.style.display = "";
                this._tool._tooltip.style.width = "120px";
                this._tool._tooltip.style.height = "40px";
                if (measurements.length == 1) {
                    instructionText = "Let go to finish.<br>";
                } else if (measurements.length == 2 ) {
                    instructionText = "Double-click to finish.<br>";
                    instructionText += "Click to continue drawing.<br>";
                    this._tool._tooltip.style.width = "145px";
                }
                instructionText += "Distance <b>: " + measurements[0] + distanceAbbr+ "</b><br>";
                if (measurements.length == 2) {
                    instructionText += "Total <b>: " + measurements[1] +distanceAbbr+ "</b>";
                    this._tool._tooltip.style.height = "85px";
                }
                this._tool._tooltip.innerHTML = instructionText;
            }
        },
        _hideMeasureResultsLoading: function () {
            if (this._tool._tooltip) {
                domClass.remove(this._tool._tooltip, "measure-loading");
            }
        },
        _updateMeasurementInTootip: function (measureObj) {
            if (measureObj.type === "length") {
                var prefix = measureObj.message;
                if (measureObj.singleSegment) {
                    var msg = prefix+"Distance: <b>"+ measureObj.total;
                    this._tool._tooltip.innerHTML = msg + "</b>";
                    this._tool._tooltip.style.width = "165px";
                } else {

                    var msg = prefix + "Distance: <b>";
                    msg = msg + measureObj.intermediate;

                    msg += "</b> <br> Total: <b>";
                    msg += measureObj.total;

                    this._tool._tooltip.innerHTML = msg + "</b>";
                    this._tool._tooltip.style.width = "auto";
                    this._tool._tooltip.style.padding = "10px;";

                }
            }
        },
        _updateTooltipPosition:function(c){
            this._tool._updateTooltip(c);
        }
    });
    return DynamicMeasure;
});

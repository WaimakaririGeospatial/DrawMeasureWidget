
// Author :GBS

///////////////////////////////////////////////////////////////////////////

define(
[
    "dojo/_base/declare",
    "dojo/aspect",
    "dojo/_base/array",
    'esri/geometry/Polyline',
    'jimu/utils',
    'esri/units',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/geodesicUtils'
       
], function (
  declare,
  aspect,
  array,
  Polyline,
  jimuUtils,
  esriUnits,
  webMercatorUtils,
  geodesicUtils
 ) {
    var DynamicMeasure= declare("DynamicMeasure", null, {
        constructor: function (tool) {
            this._setDrawTool(tool);
            this._startup();
        },
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
            aspect.around(drawToolbar, "_onMouseDragHandler", function (orginalFn) {
                return function (c) {
                    // doing something before the original call
                    me._updateTooltipPosition(c);
                    orginalFn.apply(this, arguments);
                    // doing something after the original call
                    if (me._showMeasure) {
                        if (drawToolbar._geometryType === "freehandpolyline" || drawToolbar._geometryType === 'line' && drawToolbar._points.length) {
                            drawToolbar._tooltip.style.display = "";
                            if (drawToolbar._graphic) {
                                var distance = me._calculateDistanceFromGeom(drawToolbar._graphic.geometry);
                                distance = distance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");//adding commas 
                                distance = distance + " " + me._distanceAbbr;
                                var msgPrefix = "Let go to finish drawing. <br>";
                                me._updateMeasurementInTootip({ type:"length",message: msgPrefix,singleSegment:true, total: distance });
                            }
                        }
                    } 
                }
            });
            aspect.around(drawToolbar, "_onMouseMoveHandler", function (orginalFn) {
                return function (c) {
                    orginalFn.apply(this, arguments);
                    // doing something after the original call
                    if (me._showMeasure) {
                        if (drawToolbar._geometryType === "polyline" && drawToolbar._points.length) {
                            
                            var  drawingDistance = 0,  drawnDistance = 0, totalDistance = 0;

                            //measure current segment under drawing
                            drawingDistance =  me._calculateDistanceFromGeom(drawToolbar._tGraphic.geometry);

                            //measure all the drawn segments distance
                            if (drawToolbar._points.length > 1) {
                                var points = drawToolbar._points;
                                var drawnGeom = me._createDistanceGeom(points);
                                drawnDistance = me._calculateDistanceFromGeom(drawnGeom);
                                
                            }
                            
                            if (!drawnDistance) {
                                totalDistance = drawingDistance;
                            } else {
                                totalDistance = (drawingDistance + drawnDistance).toFixed(1);
                            }

                            totalDistance = totalDistance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");//addding commas
                            drawingDistance = drawingDistance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");//adding commas

                            drawingDistance += " " + me._distanceAbbr;
                            totalDistance += " " + me._distanceAbbr;
                            var msgPrefix = "Double-click to finish. <br> Click to continue drawing. <br>";
                            me._updateMeasurementInTootip({ type: "length", message: msgPrefix, singleSegment: false, total: totalDistance, intermediate: drawingDistance });
                        }

                    }
                }
            });
            aspect.around(drawToolbar, "_onClickHandler", function (orginalFn) {
                return function (c) {
                    orginalFn.apply(this, arguments);
                    // doing something after the original call
                    if (me._showMeasure) {
                        if (drawToolbar._geometryType === "polyline" && drawToolbar._points.length) {
                            var lastSegmentDistance = 0,  totalDistance = 0;
                            if (drawToolbar._points.length > 1) {

                                //total distance 
                                totalDistance = me._calculateDistanceFromGeom(drawToolbar._graphic.geometry);

                                //last segment distance
                                var totalPointsClicked = drawToolbar._points.length;

                                //last segment would be made of last point and its penultimate point
                                lastSegmentPoints = [drawToolbar._points[totalPointsClicked - 2], drawToolbar._points[totalPointsClicked - 1]]
                                var leastSegmentGeom = me._createDistanceGeom(lastSegmentPoints);
                                lastSegmentDistance = me._calculateDistanceFromGeom(leastSegmentGeom);

                            }


                            totalDistance = totalDistance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");//addding commas
                            lastSegmentDistance = lastSegmentDistance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");//adding commas

                            lastSegmentDistance += " " + me._distanceAbbr;
                            totalDistance += " " + me._distanceAbbr;
                            var msgPrefix = "Double-click to finish. <br> Click to continue drawing. <br>";
                            me._updateMeasurementInTootip({ type: "length", message: msgPrefix, singleSegment: false, total: totalDistance, intermediate: lastSegmentDistance });
                        }
                    }
                }
            });
        },
        _createDistanceGeom: function (ptArray) {
            var points=[];
            array.forEach(ptArray, function (pt) {
                points.push([pt.x,pt.y])
            });
            var polyline = new Polyline(ptArray[0].spatialReference);
            polyline.addPath(points);
            return polyline;
        },
        _calculateDistanceFromGeom: function (geom) {
            var unit = this._distanceUnit;
            var geoPolyline = webMercatorUtils.webMercatorToGeographic(geom);
            var lengths = geodesicUtils.geodesicLengths([geoPolyline], esriUnits[unit]);
            var localeLength = jimuUtils.localizeNumber(lengths[0].toFixed(1));
            localeLength = localeLength.replace(/\,/g, '');
            return Math.abs(Number(localeLength));
        },
        _calculateAreaFromGeom: function (geom) {
            var unit = this._areaUnit;
            var geoPolygon = webMercatorUtils.webMercatorToGeographic(geom);
            var areas = geodesicUtils.geodesicAreas([geoPolygon], esriUnits[unit]);
            var localeArea = jimuUtils.localizeNumber(areas[0].toFixed(1));
            localeArea = localeArea.replace(/\,/g, '');
            return Math.abs(Number(localeArea));
           
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

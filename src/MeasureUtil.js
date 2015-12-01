/*

Helper class for  measuring graphics length/area




*/
define(
[
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/Deferred",
    "esri/SpatialReference",
    'esri/units',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/geodesicUtils',
    'esri/tasks/GeometryService',
    'esri/tasks/AreasAndLengthsParameters',
    'esri/tasks/LengthsParameters',
    'esri/geometry/Polyline'
], function (
    declare,
    array,
    lang,
    Deferred,
    SpatialReference,
    esriUnits,
    webMercatorUtils,
    geodesicUtils,
    GeometryService,
    AreasAndLengthsParameters,
    LengthsParameters,
    Polyline

) {

    var MeasureUtil = declare("utils.MeasureUtil", null, {
        _defaultGsUrl: '//utility.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/',
        constructor: function () {
            this._defaultGs = new GeometryService(this._defaultGsUrl);
            if (esriConfig.defaults.geometryService) {
                this._gs = esriConfig.defaults.geometryService;
            } else {
                this._gs = new GeometryService(this._defaultGsUrl);
            }
        },
        createLineFromPoints: function (ptArray) {
            var points = [];
            array.forEach(ptArray, function (pt) {
                points.push([pt.x, pt.y])
            });
            var polyline = new Polyline(ptArray[0].spatialReference);
            polyline.addPath(points);
            return polyline;
        },
        _getLengthAndArea: function (geometry, isPolygon, distanceUnit, areaUnit) {
            var me = this;
            var def = new Deferred();
            var defResult = {
                length: null,
                area: null
            };
            var wkid = geometry.spatialReference.wkid;
            if (areaUnit == null) {

                var esriAreaUnit = null;
            }
            else {
                var esriAreaUnit = esriUnits[areaUnit];
            }
            var lengthUnit = distanceUnit;
            var esriLengthUnit = esriUnits[lengthUnit];
            if (me.isWebMercator(wkid)) {
                defResult = me._getLengthAndArea3857(geometry, isPolygon, esriAreaUnit, esriLengthUnit);
                def.resolve(defResult);
            } else if (wkid === 4326) {
                defResult = me._getLengthAndArea4326(geometry, isPolygon, esriAreaUnit, esriLengthUnit);
                def.resolve(defResult);
            } else {
                 this._getLengthAndAreaByGS(this._gs, geometry, isPolygon, esriAreaUnit, esriLengthUnit).then(function (result) {
                     def.resolve(result);
                 }, lang.hitch(this,function () {
                     this._getLengthAndAreaByGS(this._defaultGs, geometry, isPolygon, esriAreaUnit, esriLengthUnit).then(function (result) {
                         def.resolve(result);
                     }, function (err) {
                         def.reject(err)
                     });
                 }));
            }
            return def;
        },

        _getLengthAndArea4326: function (geometry, isPolygon, esriAreaUnit, esriLengthUnit) {
            var result = {
                area: null,
                length: null
            };

            var lengths = null;

            if (isPolygon) {
                var areas = geodesicUtils.geodesicAreas([geometry], esriAreaUnit);
                var polyline = this._getPolylineOfPolygon(geometry);
                lengths = geodesicUtils.geodesicLengths([polyline], esriLengthUnit);
                result.area = areas[0];
                result.length = lengths[0];
            } else {
                lengths = geodesicUtils.geodesicLengths([geometry], esriLengthUnit);
                result.length = lengths[0];
            }

            return result;
        },

        _getLengthAndArea3857: function (geometry3857, isPolygon, esriAreaUnit, esriLengthUnit) {
            var geometry4326 = webMercatorUtils.webMercatorToGeographic(geometry3857);
            var result = this._getLengthAndArea4326(geometry4326, isPolygon, esriAreaUnit, esriLengthUnit);
            return result;
        },

        _getLengthAndAreaByGS: function (GS,geometry, isPolygon, esriAreaUnit, esriLengthUnit) {
            var def = new Deferred();
            var defResult = {
                area: null,
                length: null
            };
            var gsAreaUnit = null;
            var gsLengthUnit = this._getGeometryServiceUnitByEsriUnit(esriLengthUnit);
            if (isPolygon) {
                gsAreaUnit = this._getGeometryServiceUnitByEsriUnit(esriAreaUnit);
                var areasAndLengthParams = new AreasAndLengthsParameters();
                areasAndLengthParams.lengthUnit = gsLengthUnit;
                areasAndLengthParams.areaUnit = gsAreaUnit;
                GS.simplify([geometry]).then(lang.hitch(this, function (simplifiedGeometries) {
                 
                    areasAndLengthParams.polygons = simplifiedGeometries;
                    GS.areasAndLengths(areasAndLengthParams).then(lang.hitch(this, function (result) {
                     
                        defResult.area = result.areas[0];
                        defResult.length = result.lengths[0];
                        def.resolve(defResult);
                    }), lang.hitch(this, function (err) {
                        def.reject(err);
                    }));
                }), lang.hitch(this, function (err) {
                    def.reject(err);
                }));
            } else {
                var lengthParams = new LengthsParameters();
                lengthParams.polylines = [geometry];
                lengthParams.lengthUnit = gsLengthUnit;
                lengthParams.geodesic = true;
                GS.lengths(lengthParams).then(lang.hitch(this, function (result) {
                    defResult.length = result.lengths[0];
                    def.resolve(defResult);
                }), lang.hitch(this, function (err) {
                    console.error(err);
                    def.reject(err);
                }));
            }

            return def;
        },

        _getPolylineOfPolygon: function (polygon) {
            var polyline = new Polyline(polygon.spatialReference);
            var points = polygon.rings[0];
            points = points.slice(0, points.length - 1);
            polyline.addPath(points);
            return polyline;
        },

        _getGeometryServiceUnitByEsriUnit: function (unit) {
            var gsUnit = -1;
            switch (unit) {
                case esriUnits.KILOMETERS:
                    gsUnit = GeometryService.UNIT_KILOMETER;
                    break;
                case esriUnits.MILES:
                    gsUnit = GeometryService.UNIT_STATUTE_MILE;
                    break;
                case esriUnits.METERS:
                    gsUnit = GeometryService.UNIT_METER;
                    break;
                case esriUnits.FEET:
                    gsUnit = GeometryService.UNIT_FOOT;
                    break;
                case esriUnits.YARDS:
                    gsUnit = GeometryService.UNIT_INTERNATIONAL_YARD;
                    break;
                case esriUnits.SQUARE_KILOMETERS:
                    gsUnit = GeometryService.UNIT_SQUARE_KILOMETERS;
                    break;
                case esriUnits.SQUARE_MILES:
                    gsUnit = GeometryService.UNIT_SQUARE_MILES;
                    break;
                case esriUnits.ACRES:
                    gsUnit = GeometryService.UNIT_ACRES;
                    break;
                case esriUnits.HECTARES:
                    gsUnit = GeometryService.UNIT_HECTARES;
                    break;
                case esriUnits.SQUARE_METERS:
                    gsUnit = GeometryService.UNIT_SQUARE_METERS;
                    break;
                case esriUnits.SQUARE_FEET:
                    gsUnit = GeometryService.UNIT_SQUARE_FEET;
                    break;
                case esriUnits.SQUARE_YARDS:
                    gsUnit = GeometryService.UNIT_SQUARE_YARDS;
                    break;
            }
            return gsUnit;
        },
        isWebMercator:function(wkid) {
            // true if this spatial reference is web mercator
            if (SpatialReference.prototype._isWebMercator) {
                return SpatialReference.prototype._isWebMercator.apply({
                    wkid: parseInt(wkid, 10)
                }, []);
            } else {
                var sr = new SpatialReference(parseInt(wkid, 10));
                return sr.isWebMercator();
            }
        }
  
        
    });

    return MeasureUtil;
});





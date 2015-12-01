/*
Helper class for export import





*/
define(
[
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/topic",
    'dojo/Deferred',
    'esri/tasks/PrintTask'
    
], function (
    declare,
    array,
    lang,
    topic,
    Deferred,
    PrintTask

) {

    var ExportUtil = declare("ExportUtil", null, {
        _currentJobId: null,
        getWebmapJson: function (map) {
            // clear map points selection symbol (cross), this is causing print errors
            if (map.graphics !== null) {
                array.forEach(map.graphics.graphics, function (graphic, i) {
                    if (typeof graphic != 'undefined') {
                        if (typeof graphic.symbol != 'undefined' || graphic.symbol != null) {
                            if ("style" in graphic.symbol) {
                                if (graphic.symbol.style === "target") {
                                    map.graphics.remove(graphic);
                                }
                            }
                        }
                    }
                });
            }


            var printTask = new PrintTask();
            var w = printTask._getPrintDefinition(map);

            var operationalLayers = this.getOperationalLayers(w,map);
            var mapOptions = w.mapOptions;

            // workarounds for bugs/issues in webmap printing
            // override urls for image symbols, as they are relative
            // text symbols fail when the feature has attributes
            array.forEach(operationalLayers, function (layerObj, i) {
                if ("featureCollection" in layerObj) {
                    if ('layers' in layerObj.featureCollection) {
                        array.forEach(layerObj.featureCollection.layers, function (featLayerObj, i) {
                            if ('featureSet' in featLayerObj) {
                                array.forEach(featLayerObj.featureSet.features, function (feat, i) {
                                    if ('symbol' in feat) {
                                        // picture symbol, insert a full url
                                        if (feat.symbol.type === "esriPMS") {
                                            // if url is relative
                                            if (feat.symbol.url.indexOf('http') != 0) {
                                                var baseUrl = location.protocol + '//' + location.host + location.pathname;
                                                if (baseUrl.slice(-1) !== "/") {
                                                    baseUrl += "/";
                                                }
                                                feat.symbol.url = baseUrl + feat.symbol.url;
                                            }
                                        }
                                        // text symbol, remove all attributes 
                                        if (feat.symbol.type === "esriTS") {
                                            feat.attributes = {};
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            });

            webmapJson = this.stringify(w); 

            return webmapJson;
        },
        getOperationalLayers:function(w,map){
            return  w.operationalLayers;
        },
        stringify: function (obj) {
            var seen = []
            var stringifiedObj = JSON.stringify(obj, function (key, val) {
                if (val != null && typeof val == "object") {
                    if (array.indexOf(seen, val) >= 0)
                        return
                    seen.push(val)
                }
                return val
            });
            return stringifiedObj;
        }
    });

    return ExportUtil;
});





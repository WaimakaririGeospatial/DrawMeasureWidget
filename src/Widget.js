///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
     "dojo/_base/connect",
     'dojo/Deferred',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'esri/graphic',
    'esri/geometry/Point',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/geometry/Polyline',
    'esri/symbols/SimpleLineSymbol',
    'esri/geometry/Polygon',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/TextSymbol',
    'esri/symbols/Font',
    'esri/units',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/geodesicUtils',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/aspect',
    'esri/geometry/screenUtils',
    'esri/geometry/ScreenPoint',
	//////////////////////////////////////
	'esri/toolbars/edit',
	'dijit/Menu',
	'dijit/MenuItem',
	'dijit/MenuSeparator',
	'dojo/number',
	'jimu/SpatialReference/utils',
	/////////////////////////////////////
    'dojo/_base/html',
    'dojo/_base/Color',
    'dojo/_base/query',
    'dojo/_base/array',
    'dojo/dom-class',
    'dojo/dom-style',
    "dojo/topic",
    'dijit/form/Select',
    'dijit/form/NumberSpinner',
    'jimu/dijit/ViewStack',
    'jimu/dijit/SymbolChooser',
    'jimu/dijit/DrawBox',
    'jimu/utils',
    'esri/dijit/util/busyIndicator',
     'jimu/dijit/Message',
    './Buffer',
    './DynamicMeasure',
    './ExportUtil'
],
function (declare, connect, Deferred,_WidgetsInTemplateMixin, BaseWidget, Graphic, Point,
    SimpleMarkerSymbol, Polyline, SimpleLineSymbol, Polygon, SimpleFillSymbol,
    TextSymbol, Font, esriUnits, webMercatorUtils, geodesicUtils, lang, on, aspect,screenUtils,ScreenPoint,
	///////////////////
	Edit, Menu, MenuItem, MenuSeparator, number, Spatialutils,
	///////////////////
	html, Color, domQuery, array, domClass, domStyle, topic, Select, NumberSpinner, ViewStack, SymbolChooser,
    DrawBox, jimuUtils, busyUtil, Message, Buffer, DynamicMeasure, ExportUtil) {/*jshint unused: false*/
      /////////////////////////////
      var editToolbar, ctxMenuForGraphics, ctxMenuForMap, selected, currentLocation, myGraphic, Spat;
      var MoveMenu, RoScMenu, SepMenu, MenuDelete, XYMenu;
      ////////////////////////////
      return declare([BaseWidget, _WidgetsInTemplateMixin], {
          name: 'AdvancedDraw',
          baseClass: 'jimu-widget-draw',

          postMixInProperties: function () {
              this.inherited(arguments);
              this._resetUnitsArrays();
          },

          postCreate: function () {
              this.inherited(arguments);
              jimuUtils.combineRadioCheckBoxWithLabel(this.showMeasure, this.showMeasureLabel);
              this.drawBox.setMap(this.map);
              this.viewStack = new ViewStack({
                  viewType: 'dom',
                  views: [this.pointSection, this.lineSection, this.polygonSection, this.textSection]
              });
              html.place(this.viewStack.domNode, this.settingContent);

              this._initUnitSelect();
              this._initBufferUnitSelect();
              this._bindEvents();
              this._addCustomPointSymbology();
              this._showFooterPanel();
              this._setExportImportButtonVisibility();
              this._resetButtonStates();
              this._enableDynamicMeasurementCapability();
              this._addBufferTool();
              this._registerBufferValuesChange();
              this._registerGraphicAddRemoveEvents();
              this._updateFileExportImportSettings();
              this._createBusyIndicator();
          },
          _enableDynamicMeasurementCapability: function () {
              this.dynamicMeasure = new DynamicMeasure(this.drawBox.drawToolBar);

              var distanceUnit = this.distanceUnitSelect.value;
              var distanceAbbr = this._getDistanceUnitInfo(distanceUnit).abbr;
              this.dynamicMeasure.setDistanceParams(distanceUnit, distanceAbbr);


              var areaUnit = this.areaUnitSelect.value;
              var areaAbbr = this._getAreaUnitInfo(areaUnit).abbr;
              this.dynamicMeasure.setAreaParams(areaUnit, areaAbbr);

              var state = this.showMeasure.checked ? true : false;
              this.dynamicMeasure._setShowMeasure(state);

              this._updateDynamicMeasureOnParamChange();
          },
          _updateDynamicMeasureOnParamChange:function(){
              on(this.distanceUnitSelect, "change", lang.hitch(this, function () {
                  var distUnit = this.distanceUnitSelect.value;
                  var distAbbr = this._getDistanceUnitInfo(distUnit).abbr;
                  this.dynamicMeasure.setDistanceParams(distUnit, distAbbr);
              }));
              on(this.areaUnitSelect, "change", lang.hitch(this, function () {
                  var areaUnit = this.areaUnitSelect.value;
                  var areaAbbr = this._getAreaUnitInfo(areaUnit).abbr;
                  this.dynamicMeasure.setAreaParams(areaUnit, areaAbbr);
              }))
              on(this.showMeasure, "change", lang.hitch(this, function () {
                  var state = this.showMeasure.checked ? true : false;
                  this.dynamicMeasure._setShowMeasure(state);
              }))
          },
          _addBufferTool: function () {
              var toolDom = domQuery("div.draw-items", this.drawBox.domNode)[0];
              var params = {};
              lang.mixin(params, this.config.bufferSettings);
              params.geomServiceUrl = this.appConfig.geometryService;
              this.bufferTool = new Buffer(toolDom, this.map, this.drawBox.drawLayer, params);
              on(this.bufferTool.domNode, 'click', lang.hitch(this, this._onBufferToolClick));
              topic.subscribe('INVALID_BUFFER_REQUEST', lang.hitch(this, function () {
                  this._onBufferToolClick({ target: this.bufferTool.domNode })
              }));
              topic.subscribe("LOADING_REQUEST", lang.hitch(this, function () {
                  this._toggleLoading(arguments[0]);
              }));
              topic.subscribe("BUFFER_GRAPHIC_ADDED", lang.hitch(this, function () {
                  this._onBufferToolClick({ target: this.bufferTool.domNode })
                  if (this.showMeasure.checked) {
                      this._addPolygonMeasure(arguments[0]);
                  }
              }));
          },
          _showFooterPanel: function () {
              domStyle.set(this.footerSection, "display", "block");
          },
          _addCustomPointSymbology: function () {
              if (this.config.customPointSymbology && this.config.customPointSymbology.length) {
                  array.forEach(this.config.customPointSymbology, lang.hitch(this, function (symbol) {
                      this.pointSymChooser.pointSymClassSelect.addOption({ label: symbol.name, value: symbol.file })
                  }));
              }
          },
          _setExportImportButtonVisibility: function () {
              if (this.config.includeExportImport) {
                  domStyle.set(this.btnImport, "display", "");
                  domStyle.set(this.btnExport, "display", "");
              } else {
                  domStyle.set(this.btnImport, "display", "none");
                  domStyle.set(this.btnExport, "display", "none");
              }
          },
          _resetButtonStates: function () {
              domClass.remove(this.btnImport, "jimu-state-disabled");
              domClass.add(this.btnExport, "jimu-state-disabled");
              domClass.add(this.btnClear, "jimu-state-disabled");
          },
          _activateButtonStates: function () {
              domClass.remove(this.btnImport, "jimu-state-disabled");
              domClass.remove(this.btnExport, "jimu-state-disabled");
              domClass.remove(this.btnClear, "jimu-state-disabled");
          },
          _registerGraphicAddRemoveEvents: function () {
              this.drawBox.drawLayer.on("graphic-add", lang.hitch(this, function () {
                  this._activateButtonStates();
              }));
              this.drawBox.drawLayer.on("graphic-remove", lang.hitch(this, function () {
                  if (this.drawBox.drawLayer.graphics.length == 0) {
                      this._resetButtonStates();
                  }
              }));
          },
          _registerBufferValuesChange: function () {
              this.bufferDistanceSelect.on("change", lang.hitch(this, function () {
                  this._updateBufferOperationValues();
              }));
              this.bufferUnitsSelect.on("change", lang.hitch(this, function () {
                  this._updateBufferOperationValues();
              }));
          },
          _updateBufferOperationValues: function () {
              var distance = this.bufferDistanceSelect.get("value");
              var unit = this.bufferUnitsSelect.get("value");
              var symbology = this._getPolygonSymbol();
              this.bufferTool.setParams(distance, unit, symbology)
          },
          
          _createBusyIndicator: function () {
              this._busyLoader = busyUtil.create(this.domNode)
          },
          _updateFileExportImportSettings: function () {
              if (this.config.importServiceUrl) {
                  this.importServiceUrl = this.config.importServiceUrl;
                  
              }
              if (this.config.exportServiceUrl) {
                  this.exportServiceUrl = this.config.exportServiceUrl;
              }
              this.fileUploadForm.setAttribute("action", this.importServiceUrl);
              on(this.fileUploadField, 'change', lang.hitch(this, this._validateAndUploadFile));
          },
          _validateAndUploadFile: function (val) {
              var validation = this._validateFileInput();
              if (validation) {
                  this._toggleLoading(true);
                  this._uploadMapPackageFile().then(lang.hitch(this, function () {
                      this._toggleLoading(false);
                  }));
              } else {
                  this._showErrorMessage(this.nls.invalidUploadFile);
              }
          },
          _validateFileInput: function () {
              if (!this.fileUploadField || !this.fileUploadField.value) {
                  return false;
              } else {
                  var value = this.fileUploadField.value;
                  var pattern = /(.mpk)$/i;
                  return pattern.test(value);
              }
          },
          _uploadMapPackageFile: function () {
              var deferred = new Deferred();
              var form = this.fileUploadForm;
              
              var corsEnabledServers = esri.config.defaults.io.corsEnabledServers;
              var domain = this.extractDomain(form.action);
              if (array.indexOf(corsEnabledServers, domain) == -1) {
                  esri.config.defaults.io.corsEnabledServers.push(domain);
              }
              var uploadDeferred = esri.request({
                  url: form.action,
                  form: this.fileUploadForm,
                  handleAs: "json"
              }, {usePost:true});
              uploadDeferred.then(
                  lang.hitch(this, function (res) {
                      if (res.success) {
                          this._importGraphicsFromMapPackageFile(res.item.itemID).then(lang.hitch(this, function (response) {
                              if (response) {
                                  var importGraphicsErrorMsg = response.results[0].value.error;
                                  if (!importGraphicsErrorMsg.length) {
                                      this._renderImportedGraphics(response);
                                      this._toggleLoading(false);
                                  } else {
                                      this._showErrorMessage(this.nls.failedRetrievingGraphics);
                                  }
                              }
                              deferred.resolve();
                          }));
                      } else {
                          this._toggleLoading(false);
                          this._showErrorMessage(this.nls.failedUpload);
                          deferred.resolve();
                      }
                  }),
                  lang.hitch(this,function (e) {
                      if (e.message != 'Request canceled') {
                          this._showErrorMessage(e.toString());
                      }
                      deferred.resolve();
                  })
              );
              return deferred.promise;
          },
          _importGraphicsFromMapPackageFile: function (itemID) {
              var deferred = new Deferred();
              var url = this.exportServiceUrl;
              var importGraphicsDeferred = esri.request({
                  url: url,
                  content: {
                      f: "json",
                      webmap: "", // populate for exports
                      uploadid: itemID // populate for imports, after upload successful
                  },
                  handleAs: "json"
              }, { usePost: true });
              importGraphicsDeferred.then(
                  lang.hitch(this, function (res) {
                      deferred.resolve(res)
                  }),
                  lang.hitch(this, function (e) {
                      this._toggleLoading(false);
                      if (e.message != 'Request canceled') {
                          this._showErrorMessage(e.toString());
                      }
                      deferred.resolve();
                  })
              );
              return deferred.promise;

          },
          _renderImportedGraphics: function (response) {
              var me = this;
              var map = this.map;
              var results = JSON.parse(response.results[0].value.webmap);
              var redlineLayer = this.drawBox.drawLayer;
              var graphicsArray = [];
              function addLayerSet(layerSet, includeTextGraphics) {
                  array.forEach(layerSet, function (layer) {
                      var featureSet = layer.featureSet;
                      array.forEach(featureSet.features, function (feature) {
                          if (!includeTextGraphics && feature.symbol && feature.symbol.type === "esriTS") {
                              return;
                          }
                          var graphic = new Graphic(feature);
                          redlineLayer.add(graphic);
                          me._onDrawEnd(graphic);
                          graphicsArray.push(graphic)
                      });
                  });
              }

              // all graphics except text are from redline layer
              var redlineGraphicsLayerConfig = array.filter(results.operationalLayers, function (layer) {
                  var regExp = new RegExp(/graphicsLayer/ig);
                  return regExp.test(layer.id);
              })[0];

              if (!redlineGraphicsLayerConfig || !redlineGraphicsLayerConfig.featureCollection) {
                  return;
              }
              var layerSet = redlineGraphicsLayerConfig.featureCollection.layers;
              addLayerSet(layerSet, true);

              //updating the measurement text graphics with unique id of the parent shape
              var aliasPoints = array.filter(graphicsArray, function (graphic) {
                  return graphic.attributes &&  graphic.attributes.aliasPoint === 'true' && graphic.symbol == null;
              });

              var textGraphics = array.filter(graphicsArray, function (graphic) {
                  return graphic.symbol && graphic.symbol.type === 'textsymbol';
              });

              array.forEach(textGraphics, function (graphic) {
                  var x = graphic.geometry.x;
                  var y = graphic.geometry.y;
                  var aliasPoint = array.filter(aliasPoints, function (alias) {
                      return alias.geometry.x === x && alias.geometry.y === y;
                  })[0];
                  if (aliasPoint) {
                      graphic.setAttributes(aliasPoint.attributes);
                  }
              });

              
              //now update the main graphic uniqueId to prevent graphics with duplicate unique id 
              //that may come through multiple uploads

              var aliasGraphics = array.filter(graphicsArray, function (graphic) {
                  return graphic.geometry.type == "point" && graphic.attributes && graphic.attributes.aliasPoint === "true";
              });

              var toolboxGraphics = array.filter(graphicsArray, function (graphic) {
                  return  graphic.attributes && !graphic.attributes.aliasPoint ;
              });

              array.forEach(toolboxGraphics, function (graphic) {
                  var newId = new Date().getTime() + Math.random();
                  var uniqueId = graphic.attributes.uniqueId;
                  graphic.attributes.uniqueId = newId;
                  var relatedGraphics = array.filter(aliasGraphics, function (_g) {
                      return _g && _g.attributes.uniqueId == uniqueId;
                  });
                  array.forEach(relatedGraphics, function (_g) {
                      _g.attributes.uniqueId = newId;
                  });
              });
              redlineLayer.redraw();
          },
          _resetUnitsArrays: function () {
              this.defaultDistanceUnits = [];
              this.defaultAreaUnits = [];
              this.configDistanceUnits = [];
              this.configAreaUnits = [];
              this.distanceUnits = [];
              this.areaUnits = [];
          },


          _bindEvents: function () {
              //bind DrawBox
              this.own(on(this.drawBox, 'IconSelected', lang.hitch(this, this._onIconSelected)));
              this.own(on(this.drawBox, 'DrawEnd', lang.hitch(this, this._onDrawEnd)));

              //bind symbol change events
              this.own(on(this.pointSymChooser, 'change', lang.hitch(this, function () {
                  this._setDrawDefaultSymbols();
                  this._updateSymbologyOnEditedGraphic();
              })));
              this.own(on(this.lineSymChooser, 'change', lang.hitch(this, function () {
                  this._setDrawDefaultSymbols();
                  this._updateSymbologyOnEditedGraphic();
              })));
              this.own(on(this.fillSymChooser, 'change', lang.hitch(this, function () {
                  this._setDrawDefaultSymbols();
                  this._updateBufferOperationValues();
                  this._updateSymbologyOnEditedGraphic();
              })));
              this.own(on(this.textSymChooser, 'change', lang.hitch(this, function (symbol) {
                  this.drawBox.setTextSymbol(symbol);
                  this._updateSymbologyOnEditedGraphic();
              })));

              //bind unit events
              this.own(on(this.showMeasure, 'click', lang.hitch(this, this._setMeasureVisibility)));
              
              //bind Import/Export/Clear button events
              this.own(on(this.btnImport, 'click', lang.hitch(this, this._importGraphicsFileClicked)));
              this.own(on(this.btnExport, 'click', lang.hitch(this, this._exportGraphicsFileClicked)));
              this.own(on(this.btnClear, 'click', lang.hitch(this, this._onBtnClearClicked)));
          },
          _onBufferToolClick: function (event) {
              var target = event.target || event.srcElement;
              var isSelected = html.hasClass(target, 'selected');

              //toggle tools on and off
              if (isSelected || this.bufferTool.isActive()) {
                  this.bufferTool.deactivate();
                  this._setBufferSectionVisibility(false)
              } else {
                  if (editToolbar) {
                      editToolbar.deactivate();
                  }
                  this.drawBox.deactivate();
                  this.bufferTool.activate();
                  this._updateBufferOperationValues();
                  this.viewStack.switchView(this.polygonSection);
                  this.showMeasure.checked = false;//to always turn off the measure so that user can deliberately cho
                  this._setMeasureVisibility();
                  this._setBufferSectionVisibility(true);
              }
          },
          _setBufferSectionVisibility: function (show) {
              var display = show ? "block" : "none";
              html.setStyle(this.bufferSection, 'display', display);
              html.setStyle(this.bufferDistance, 'display', display);
              html.setStyle(this.bufferUnits, 'display', display);
          },
          _onIconSelected: function (target, geotype, commontype) {
              if (this.bufferTool.isActive()) {
                  this.bufferTool.deactivate();
              }
              if (editToolbar) {
                  editToolbar.deactivate();
              }
              this._setDrawDefaultSymbols();
              this._showSymbologyEditor(commontype);
              this._clearTextSymbolEditor();
              this._setMeasureVisibility();
              this._setBufferSectionVisibility(false);
          },
          _showSymbologyEditor:function(type){
              if (type === 'point') {
                  this.viewStack.switchView(this.pointSection);
              }
              else if (type === 'polyline') {
                  this.viewStack.switchView(this.lineSection);
              }
              else if (type === 'polygon') {
                  this.viewStack.switchView(this.polygonSection);
              }
              else if (type === 'text') {
                  this.viewStack.switchView(this.textSection);
              }
          },
          _clearTextSymbolEditor:function(){
              this.textSymChooser.inputText.value = "";
              this.textSymChooser._updateTextPreview();
              this._getTextSymbol().setText("");
              this.drawBox.setTextSymbol(this._getTextSymbol());
           },
          _onDrawEnd: function (graphic, geotype, commontype) {
              var geometry = graphic.geometry;
              /////////////////////////////////////////
              myGraphic = graphic._graphicsLayer;
              //Selects the graphic you hover over
              graphic._graphicsLayer.on("mouse-over", function hoverme(evt) {
                  //ctxMenuForGraphics.addChild(XYMenu);
                  ctxMenuForGraphics.addChild(MoveMenu);
                  ctxMenuForGraphics.addChild(RoScMenu);
                  ctxMenuForGraphics.addChild(SepMenu);
                  ctxMenuForGraphics.addChild(MenuDelete);
                  selected = evt.graphic;
                  if (selected.symbol.style == "circle" || selected.symbol.type == "picturemarkersymbol") {
                      //ctxMenuForGraphics.removeChild(EditMenu);
                      ctxMenuForGraphics.removeChild(RoScMenu);
                      ctxMenuForGraphics.removeChild(SepMenu);
                      ctxMenuForGraphics.removeChild(MenuDelete);
                      ctxMenuForGraphics.removeChild(MoveMenu);
                      ctxMenuForGraphics.addChild(MoveMenu);
                      //ctxMenuForGraphics.addChild(XYMenu);
                      ctxMenuForGraphics.addChild(SepMenu);
                      ctxMenuForGraphics.addChild(MenuDelete);
                  } else {
                      ctxMenuForGraphics.removeChild(XYMenu);
                  }

                  //Gets the position of the current graphic to place edit box
                  ctxMenuForGraphics.bindDomNode(evt.graphic.getDojoShape().getNode());
              });

              graphic._graphicsLayer.on("mouse-out", function (evt) {
                  ctxMenuForGraphics.unBindDomNode(evt.graphic.getDojoShape().getNode());
              });
              //////////////////////////////////////////		 

              if (geometry.type && geometry.type === 'extent') {
                  var a = geometry;
                  var polygon = new Polygon(a.spatialReference);
                  var r = [[a.xmin, a.ymin], [a.xmin, a.ymax], [a.xmax, a.ymax], [a.xmax, a.ymin], [a.xmin, a.ymin]];
                  polygon.addRing(r);
                  geometry = polygon;
                  commontype = 'polygon';
                  //removing the extent graphic and replacing with polygon graphic
                  myGraphic.remove(graphic);
                  graphic = new Graphic(polygon, this._getPolygonSymbol());
                  myGraphic.add(graphic);

              }
              if (commontype === 'polyline') {
                  graphic.setAttributes({ uniqueId: new Date().getTime() });
                  if (this.showMeasure.checked) {
                      this._addLineMeasure(graphic);
                  }
              }
              else if (commontype === 'polygon') {
                  graphic.setAttributes({ uniqueId: new Date().getTime() });
                  if (this.showMeasure.checked) {
                      this._addPolygonMeasure(graphic);
                  }
              } else if (commontype === "point") {
                  graphic.setAttributes({ uniqueId: new Date().getTime() });
              }
          },
          _initBufferUnitSelect: function () {
              var bufferDistanceUnits = this.config.bufferSettings.bufferDistanceUnits;
              array.forEach(bufferDistanceUnits, lang.hitch(this, function (unitInfo) {
                  var option = {
                      value: unitInfo.esriConstant,
                      label: unitInfo.unit
                  };
                  this.bufferUnitsSelect.addOption(option);
              }));
          },
          _initUnitSelect: function () {
              this._initDefaultUnits();
              this._initConfigUnits();
              var a = this.configDistanceUnits;
              var b = this.defaultDistanceUnits;
              this.distanceUnits = a.length > 0 ? a : b;
              var c = this.configAreaUnits;
              var d = this.defaultAreaUnits;
              this.areaUnits = c.length > 0 ? c : d;
              array.forEach(this.distanceUnits, lang.hitch(this, function (unitInfo) {
                  var option = {
                      value: unitInfo.unit,
                      label: unitInfo.label
                  };
                  this.distanceUnitSelect.addOption(option);

              }));

              array.forEach(this.areaUnits, lang.hitch(this, function (unitInfo) {
                  var option = {
                      value: unitInfo.unit,
                      label: unitInfo.label
                  };
                  this.areaUnitSelect.addOption(option);
              }));
          },
          _initDefaultUnits: function () {
              this.defaultDistanceUnits = [{
                  unit: 'KILOMETERS',
                  label: this.nls.kilometers
              }, {
                  unit: 'MILES',
                  label: this.nls.miles
              }, {
                  unit: 'METERS',
                  label: this.nls.meters
              }, {
                  unit: 'FEET',
                  label: this.nls.feet
              }, {
                  unit: 'YARDS',
                  label: this.nls.yards
              }];

              this.defaultAreaUnits = [{
                  unit: 'SQUARE_KILOMETERS',
                  label: this.nls.squareKilometers
              }, {
                  unit: 'SQUARE_MILES',
                  label: this.nls.squareMiles
              }, {
                  unit: 'ACRES',
                  label: this.nls.acres
              }, {
                  unit: 'HECTARES',
                  label: this.nls.hectares
              }, {
                  unit: 'SQUARE_METERS',
                  label: this.nls.squareMeters
              }, {
                  unit: 'SQUARE_FEET',
                  label: this.nls.squareFeet
              }, {
                  unit: 'SQUARE_YARDS',
                  label: this.nls.squareYards
              }];
          },

          _initConfigUnits: function () {
              array.forEach(this.config.distanceUnits, lang.hitch(this, function (unitInfo) {
                  var unit = unitInfo.unit;
                  if (esriUnits[unit]) {
                      var defaultUnitInfo = this._getDefaultDistanceUnitInfo(unit);
                      unitInfo.label = defaultUnitInfo.label;
                      this.configDistanceUnits.push(unitInfo);
                  }
              }));

              array.forEach(this.config.areaUnits, lang.hitch(this, function (unitInfo) {
                  var unit = unitInfo.unit;
                  if (esriUnits[unit]) {
                      var defaultUnitInfo = this._getDefaultAreaUnitInfo(unit);
                      unitInfo.label = defaultUnitInfo.label;
                      this.configAreaUnits.push(unitInfo);
                  }
              }));
          },

          _getDefaultDistanceUnitInfo: function (unit) {
              for (var i = 0; i < this.defaultDistanceUnits.length; i++) {
                  var unitInfo = this.defaultDistanceUnits[i];
                  if (unitInfo.unit === unit) {
                      return unitInfo;
                  }
              }
              return null;
          },

          _getDefaultAreaUnitInfo: function (unit) {
              for (var i = 0; i < this.defaultAreaUnits.length; i++) {
                  var unitInfo = this.defaultAreaUnits[i];
                  if (unitInfo.unit === unit) {
                      return unitInfo;
                  }
              }
              return null;
          },

          _getDistanceUnitInfo: function (unit) {
              for (var i = 0; i < this.distanceUnits.length; i++) {
                  var unitInfo = this.distanceUnits[i];
                  if (unitInfo.unit === unit) {
                      return unitInfo;
                  }
              }
              return null;
          },

          _getAreaUnitInfo: function (unit) {
              for (var i = 0; i < this.areaUnits.length; i++) {
                  var unitInfo = this.areaUnits[i];
                  if (unitInfo.unit === unit) {
                      return unitInfo;
                  }
              }
              return null;
          },

          _setMeasureVisibility: function () {
              html.setStyle(this.measureSection, 'display', 'none');
              html.setStyle(this.areaMeasure, 'display', 'none');
              html.setStyle(this.distanceMeasure, 'display', 'none');
              var lineDisplay = html.getStyle(this.lineSection, 'display');
              var polygonDisplay = html.getStyle(this.polygonSection, 'display');
              if (lineDisplay === 'block') {
                  html.setStyle(this.measureSection, 'display', 'block');
                  if (this.showMeasure.checked) {
                      html.setStyle(this.distanceMeasure, 'display', 'block');
                  }
              }
              else if (polygonDisplay === 'block') {
                  html.setStyle(this.measureSection, 'display', 'block');
                  if (this.showMeasure.checked) {
                      html.setStyle(this.areaMeasure, 'display', 'block');
                      //html.setStyle(this.distanceMeasure, 'display', 'block');
                  }
              } 
          },
          _getPointSymbol: function () {
              return this.pointSymChooser.getSymbol();
          },

          _getLineSymbol: function () {
              return this.lineSymChooser.getSymbol();
          },

          _getPolygonSymbol: function () {
              return this.fillSymChooser.getSymbol();
          },

          _getTextSymbol: function () {
              return this.textSymChooser.getSymbol();
          },

          _setDrawDefaultSymbols: function () {
              this.drawBox.setPointSymbol(this._getPointSymbol());
              this.drawBox.setLineSymbol(this._getLineSymbol());
              this.drawBox.setPolygonSymbol(this._getPolygonSymbol());
              this.drawBox.setTextSymbol(this._getTextSymbol());
          },
          _updateSymbologyOnEditedGraphic: function () {
              if (!editToolbar) {
                  return;
              }
              var editedGraphic = editToolbar.getCurrentState().graphic;
              if (!editedGraphic || !editedGraphic.symbol) {
                  return
              }
              if (editedGraphic.symbol.type === "textsymbol") {
                  var rotation = editedGraphic.symbol.angle;
                  var font = editedGraphic.symbol.font;
                  font.setSize(this._getTextSymbol().font.size);
                  var symbol = this._getTextSymbol().setAngle(rotation).setFont(font);
                  editedGraphic.setSymbol(symbol);
              } else if (editedGraphic.geometry.type == "point") {
                  editedGraphic.setSymbol(this._getPointSymbol());
              } else if (editedGraphic.geometry.type == "polyline") {
                  editedGraphic.setSymbol(this._getLineSymbol());
              } else if (editedGraphic.geometry.type == "polygon") {
                  editedGraphic.setSymbol(this._getPolygonSymbol());
              }
          },
          _updateSymbologyEditor:function(graphic){
              if (graphic.symbol.type === "textsymbol") {
                  this.textSymChooser.inputText.value = graphic.symbol.text;
                  this.textSymChooser.textFontSize.set("value", graphic.symbol.font.size);
                  this.textSymChooser.textColor.set("value", graphic.symbol.color);
                  this.textSymChooser._updateTextPreview();
              }
          
          },
          ///////////////////////////////////////////////////////////
          onOpen: function () {
              var mapFrame = this;
              var map = this.map;
              function sniffWKID() {
                  if (map.spatialReference.wkid == "102100") {
                      console.log("Good to go!");
                      Spat = "geo";
                  } else {
                      Spatialutils.loadResource().then(function () {
                          var WKTCurrent = Spatialutils.getCSStr(map.spatialReference.wkid);
                          function mapSpat() {
                              if (WKTCurrent.charAt(0) == 'G') {
                                  Spat = "geo";
                              } else {
                                  Spat = "proj";
                              }
                          };
                          mapSpat();
                      });
                  }
              };

              sniffWKID();

              editToolbar = new Edit(map);
              map.on("click", function (evt) {
                  editToolbar.deactivate();
              });

              
              editToolbar.on("activate", lang.hitch(this, function (evt) {
                  this.drawBox.deactivate();
                  var type = "";
                  if (evt.graphic.symbol && evt.graphic.symbol.type === "textsymbol") {
                      type = "text";
                  } else {
                      type = evt.graphic.geometry.type;
                  }
                  this._showSymbologyEditor(type);
                  this._updateSymbologyEditor(evt.graphic);
                  this._setMeasureVisibility();
                  if (this.bufferTool.isActive()) {
                      this.bufferTool.deactivate();
                  }
              }));

              
              //1.graphic move
              editToolbar.on("graphic-move-stop", lang.hitch(this, function (evt) {
                  this._repositionMeasureGraphics(evt);
              }));

              //2.graphic rotate
              editToolbar.on("scale-stop", lang.hitch(this, function (evt) {
                  this._updateMeasureGraphic(evt);
              }));

              //3.graphic reshape
              editToolbar.on("vertex-move-stop", lang.hitch(this, function (evt) {
                  this._updateMeasureGraphic(evt);
              }));
              editToolbar.on("vertex-delete", lang.hitch(this, function (evt) {
                  this._updateMeasureGraphic(evt);
              }));


              //Creates the right-click menu  
              function createGraphicsMenu() {
                  ctxMenuForGraphics = new Menu({});
                  ctxMenuForGraphics.addChild(new MenuItem({
                      label: "Edit",
                      onClick: function (evt) {
                          if (selected.geometry.type !== "point") {
                              editToolbar.activate(Edit.EDIT_VERTICES, selected);
                          } else if (selected.symbol && selected.symbol.type === "textsymbol") {
                                editToolbar.activate(Edit.MOVE | Edit.EDIT_TEXT,selected);
                          }
                          else {
                              editToolbar.activate(Edit.MOVE | Edit.EDIT_VERTICES | Edit.EDIT_TEXT | Edit.SCALE, selected);
                          }
                      }
                  }));
                  //Right-click Move
                  MoveMenu = new MenuItem({
                      label: "Move",
                      onClick: function () {
                          editToolbar.activate(Edit.MOVE, selected);
                      }
                  })
                  //Right-click Rotate/Scale
                  RoScMenu = new MenuItem({
                      label: "Rotate/Scale",
                      onClick: function () {
                          editToolbar.activate(Edit.ROTATE | Edit.SCALE, selected);
                      }
                  })
                  SepMenu = new MenuSeparator();
                  //Right-click Delete
                  MenuDelete = new MenuItem({
                      label: "Delete",
                      onClick: function () {
                          if (editToolbar) {
                              editToolbar.deactivate();
                          }
                          mapFrame._deleteGraphic(selected);
                      }
                  });

                  XYMenu = new MenuItem({
                      label: "Add X/Y",
                      onClick: function () {
                          var newColor = new Color([0, 0, 0, 1]);
                          var a = Font.STYLE_ITALIC;
                          var b = Font.VARIANT_NORMAL;
                          var c = Font.WEIGHT_BOLD;
                          if (Spat == "geo") {
                              var mapPoint = selected.geometry;
                              var locPoint = webMercatorUtils.webMercatorToGeographic(mapPoint);
                              var lat = number.format(locPoint.y, { places: 5 });
                              var longi = number.format(locPoint.x, { places: 5 });
                              var textSymbol = new TextSymbol(
                              "Lat: " + (lat) + ", Long: " + (longi)).setColor(
                              new Color(newColor)).setAlign(Font.ALIGN_MIDDLE).setAngle(0).setOffset(5, 5).setFont(
                              new Font("16px", a, b, c, "Courier"));
                          } else {
                              var mapPoint = selected.geometry;
                              var Xdig = number.format(mapPoint.x, { places: 5 });
                              var Ydig = number.format(mapPoint.y, { places: 5 });
                              var textSymbol = new TextSymbol(
                              "X: " + (Xdig) + ", Y: " + (Ydig)).setColor(
                              new Color(newColor)).setAlign(Font.ALIGN_MIDDLE).setAngle(0).setOffset(5, 5).setFont(
                              new Font("16px", a, b, c, "Courier"));
                          }
                          var labelPointGraphic = new Graphic(mapPoint, textSymbol, {"uniqueId":selected.attributes.uniqueId});
                          myGraphic.add(labelPointGraphic);
                      }
                  });

                  ctxMenuForGraphics.startup();

              };
              createGraphicsMenu();

          },
          //////////////////////////////////////////////////////////////////
          onClose: function () {
              this.drawBox.deactivate();
              if (this.bufferTool.isActive()) {
                  this.bufferTool.deactivate();
                  this._setBufferSectionVisibility(false);
              }
              if (editToolbar) {
                  editToolbar.deactivate();
              }
          },

          _addLineMeasure: function (graphic) {
              var geometry = graphic.geometry;
              var a = Font.STYLE_ITALIC;
              var b = Font.VARIANT_NORMAL;
              var c = Font.WEIGHT_BOLD;
              var symbolFont = new Font("16px", a, b, c, "Courier");
              var fontColor = new Color([0, 0, 0, 1]);
              var ext = geometry.getExtent();
              var center = ext.getCenter();


              this.dynamicMeasure._calculateDistance(graphic).then(lang.hitch(this, function (distance) {
                  var distUnit = this.distanceUnitSelect.value;
                  var distAbbr = this._getDistanceUnitInfo(distUnit).abbr;
                  var distanceText = distance + " " + distAbbr;
                  var textSymbol = this._getTextSymbol().setText(distanceText).setFont(symbolFont);
                  var labelAttributes = null;
                  if (graphic.attributes) {
                      labelAttributes = {};
                      labelAttributes = lang.clone(graphic.attributes);
                      labelAttributes.aliasPoint = 'true';
                  }
                  var labelGraphic = new Graphic(center, textSymbol, labelAttributes, null);
                  this.drawBox.addGraphic(labelGraphic);

                  var aliasPointGraphic = new Graphic(center, null, labelAttributes, null);
                  this.drawBox.addGraphic(aliasPointGraphic);
                  
              }));
          },

          _addPolygonMeasure: function (graphic) {
              var geometry = graphic.geometry;
              var a = Font.STYLE_ITALIC;
              var b = Font.VARIANT_NORMAL;
              var c = Font.WEIGHT_BOLD;
              var symbolFont = new Font("16px", a, b, c, "Courier");
              var fontColor = new Color([0, 0, 0, 1]);
              var ext = geometry.getExtent();
              var center = ext.getCenter();
              this.dynamicMeasure._calculateArea(graphic).then(lang.hitch(this, function (area) {
                  var areaUnit = this.areaUnitSelect.value;
                  var areaAbbr = this._getAreaUnitInfo(areaUnit).abbr;
                  var areaText = area +" "+areaAbbr;
                  var textSymbol = this._getTextSymbol().setText(areaText).setFont(symbolFont);
                  var labelAttributes = null;
                  if (graphic.attributes) {
                      labelAttributes = {};
                      labelAttributes = lang.clone(graphic.attributes);
                      labelAttributes.aliasPoint = 'true';
                  }
                  var labelGraphic = new Graphic(center, textSymbol, labelAttributes, null);
                  this.drawBox.addGraphic(labelGraphic);

                  var aliasPointGraphic = new Graphic(center, null, labelAttributes, null);
                  this.drawBox.addGraphic(aliasPointGraphic);
              }));
          },

          _repositionMeasureGraphics: function (event) {
              var movedGraphic = event.graphic;
              var transform = event.transform;
              if (movedGraphic.geometry.type === 'point') {
                  return;
              }
              var measureGraphics = array.filter(this.drawBox.drawLayer.graphics, lang.hitch(this, function (graphic) {
                  return graphic.attributes && (graphic.attributes["uniqueId"] == movedGraphic.attributes["uniqueId"] && (graphic.geometry.type === 'point'));
              }));
              if (measureGraphics.length > 0) {
                  array.forEach(measureGraphics, lang.hitch(this, function (graphic) {
                      if (movedGraphic.symbol.type === 'textsymbol' && graphic.symbol && graphic.symbol.type=='textsymbol') {
                          //to avoid applying transform on the same graphic
                          return;
                      }
                      var measureGraphic = graphic;
                      var measureGraphicPoint = measureGraphic.geometry;
                      var orginalPosition = screenUtils.toScreenPoint(this.map.extent, this.map.width, this.map.height, measureGraphicPoint);
                      var newPosition = {
                          x: transform.dx ? (orginalPosition.x + transform.dx) : orginalPosition.x,
                          y: transform.dy ? (orginalPosition.y + transform.dy) : orginalPosition.y
                      };
                      var screenPoint = new ScreenPoint(newPosition.x, newPosition.y);
                      var mapPoint = screenUtils.toMapPoint(this.map.extent, this.map.width, this.map.height, screenPoint)
                      measureGraphic.setGeometry(mapPoint)
                  }));
              }
          },
          _updateMeasureGraphic: function (event) {
              var updatedGraphic = event.graphic;
              if (updatedGraphic.symbol.type === 'textsymbol') {
                  return;
              }
              var measureGraphics = array.filter(this.drawBox.drawLayer.graphics, lang.hitch(this, function (graphic) {
                  return graphic.attributes && (graphic.attributes["uniqueId"] == updatedGraphic.attributes["uniqueId"] && (graphic.symbol && graphic.symbol.type === 'textsymbol'));
              }));
              if (measureGraphics.length > 0) {
                  var measureGraphic = measureGraphics[0];
                  if (updatedGraphic.geometry.type === "polyline") {
                      this.dynamicMeasure._calculateDistance(updatedGraphic).then(lang.hitch(this, function (distance) {
                          var distUnit = this.distanceUnitSelect.value;
                          var distAbbr = this._getDistanceUnitInfo(distUnit).abbr;
                          var distanceText = distance +" "+distAbbr;
                          measureGraphic.symbol.setText(distanceText);
                          measureGraphic._graphicsLayer.redraw();
                      }));
                  } else if (updatedGraphic.geometry.type === "polygon") {
                      this.dynamicMeasure._calculateArea(updatedGraphic).then(lang.hitch(this, function (area) {
                          var areaUnit = this.areaUnitSelect.value;
                          var areaAbbr = this._getAreaUnitInfo(areaUnit).abbr;
                          var areaText = area +" "+areaAbbr;
                          measureGraphic.symbol.setText(areaText);
                          measureGraphic._graphicsLayer.redraw();
                      }));
                  }
              }
          },
          _deleteGraphic:function(delGraphic){
              //finding the measurement graphics and aliases
              var measureGraphics = array.filter(this.drawBox.drawLayer.graphics, lang.hitch(this, function (graphic) {
                  return graphic.attributes && (graphic.attributes["uniqueId"] == delGraphic.attributes["uniqueId"] && graphic.geometry.type === 'point');
              }));
              if (measureGraphics.length > 0) {
                  array.forEach(measureGraphics,function(graphic){
                      graphic._graphicsLayer.remove(graphic);
                  });
              }
              if (delGraphic && delGraphic._graphicsLayer) {
                  delGraphic._graphicsLayer.remove(delGraphic);
              }
          },
          destroy: function () {
              if (this.drawBox) {
                  this.drawBox.destroy();
                  this.drawBox = null;
              }
              if (this.pointSymChooser) {
                  this.pointSymChooser.destroy();
                  this.pointSymChooser = null;
              }
              if (this.lineSymChooser) {
                  this.lineSymChooser.destroy();
                  this.lineSymChooser = null;
              }
              if (this.fillSymChooser) {
                  this.fillSymChooser.destroy();
                  this.fillSymChooser = null;
              }
              if (this.textSymChooser) {
                  this.textSymChooser.destroy();
                  this.textSymChooser = null;
              }
              this.inherited(arguments);
          },
          _importGraphicsFileClicked: function () {
              if (!domClass.contains(this.btnImport, "jimu-state-disabled")) {
                  this.fileUploadField.click();
              }
          },
          _exportGraphicsFileClicked: function () {
              if (!domClass.contains(this.btnExport, "jimu-state-disabled")) {
                  this._toggleLoading(true);
                  this._export().then(lang.hitch(this, function (resp) {
                      this._toggleLoading(false);
                      var url = resp.results[0].value.url;
                      if (url) {
                          window.location = url;
                      } else {
                          console.log(resp);
                          this._toggleLoading(false);
                          this._showErrorMessage("error")
                          return;
                      }
                  }));
              }
          },
          _onBtnClearClicked: function () {
              if (!domClass.contains(this.btnClear, "jimu-state-disabled")) {
                  this.drawBox.drawLayer.clear();
                  if (editToolbar) {
                      editToolbar.deactivate();
                  }
              }
          },
          _toggleLoading: function (state) {
              state ? this._busyLoader.show() : this._busyLoader.hide();
          },
          _showErrorMessage: function (msg) {
              var popup = new Message({
                  message: msg,
                  buttons: [{
                      label: "OK",
                      onClick: lang.hitch(this, function () {
                          popup.close();
                      })
                  }]
              });
          },
          _export:function(){
              var deferred = new Deferred();
              var exportUtil = new ExportUtil();
              var webmapJson = exportUtil.getWebmapJson(this.map);
              var url = this.exportServiceUrl;

              this.exportDeferred = esri.request({
                  url: url,
                  content: {
                      f: "json",
                      webmap: webmapJson, // populate for exports
                      uploadid: ""
                  },
                  handleAs: "json"
              });
              this.exportDeferred.then(
                  lang.hitch(this, function (res) {
                      deferred.resolve(res)
                  }),
                  lang.hitch(this, function (e) {
                      this._toggleLoading(false);
                      if (e.message != 'Request canceled') {
                          this._showErrorMessage(e.toString())
                      }
                      deferred.resolve();
                  })
              );
              return deferred.promise;
          
          },
          extractDomain:function(url) {
                var domain;
                //find & remove protocol (http, ftp, etc.) and get domain
                if (url.indexOf("://") > -1) {
                    domain = url.split('/')[2];
                }
                else {
                    domain = url.split('/')[0];
                }

                //find & remove port number
                domain = domain.split(':')[0];

                return domain;
          },
          startup: function () {
              this.inherited(arguments);
              this.viewStack.startup();
              this.viewStack.switchView(null);
          }

      });
  });
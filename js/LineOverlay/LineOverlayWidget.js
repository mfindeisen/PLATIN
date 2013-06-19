/*
* LineOverlayWidget.js
*
* Copyright (c) 2013, Sebastian Kruse. All rights reserved.
*
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU Lesser General Public
* License as published by the Free Software Foundation; either
* version 3 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public
* License along with this library; if not, write to the Free Software
* Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
* MA 02110-1301  USA
*/

/**
 * @class LineOverlayWidget
 * Implementation for the widget interactions of an overlay showing lines between points
 * @author Sebastian Kruse (skruse@mpiwg-berlin.mpg.de)
 *
 * @param {WidgetWrapper} core wrapper for interaction to other widgets
 * @param {JSON} options user specified configuration that overwrites options in OverlayloaderConfig.js
 */
function LineOverlayWidget(core, options) {

	this.core = core;
	this.core.setWidget(this);

	this.options = (new LineOverlayConfig(options)).options;
	
	this.attachedMapWidgets = new Array();
	
	this.lineOverlay = new LineOverlay(this);
	this.lines = [];
	this.multiLineFeature;
	
	this.selected = [];
}

/**
 * @param {Number} dataSet number of dataSet in dataSet array
 * @param {Number} objectID number of DataObject in objects array
 */

function Line(objectStart, objectEnd ) {
	this.objectStart = objectStart;
	this.objectEnd = objectEnd;
}

LineOverlayWidget.prototype = {

	initWidget : function() {
		var lineOverlayWidget = this;
		this.drawLines();
	},

	highlightChanged : function(objects) {
		if( !GeoTemConfig.highlightEvents ){
			return;
		}
		this.drawLines(GeoTemConfig.mergeObjects(objects,this.selected));
	},

	selectionChanged : function(selection) {
		if( !GeoTemConfig.selectionEvents ){
			return;
		}
		if (selection.valid())
			this.selected = selection.objects;
		else
			this.selected = [];

		this.drawLines(this.selected);
	},

	triggerHighlight : function(item) {
	},

	tableSelection : function() {
	},

	deselection : function() {
	},

	filtering : function() {
	},

	inverseFiltering : function() {
	},

	triggerRefining : function() {
	},

	reset : function() {
	},
	
	//identical to the function in PieChartWidget
	//here cause widgets may be used independed of each other
	getElementData : function(dataObject, watchedColumn, selectionFunction) {
		var columnData;
		if (watchedColumn.indexOf("[") === -1){
			columnData = dataObject[watchedColumn];
			if (typeof columnData === "undefined"){
				columnData = dataObject.tableContent[watchedColumn];
			};
		} else {
			try {
				var columnName = watchedColumn.split("[")[0];
				var IndexAndAttribute = watchedColumn.split("[")[1];
				if (IndexAndAttribute.indexOf("]") != -1){
					var arrayIndex = IndexAndAttribute.split("]")[0];
					var attribute = IndexAndAttribute.split("]")[1];
					
					if (typeof attribute === "undefined")
						columnData = dataObject[columnName][arrayIndex];
					else{
						attribute = attribute.split(".")[1];
						columnData = dataObject[columnName][arrayIndex][attribute];
					}
				}
			} catch(e) {
				if (typeof console !== undefined)
					console.error(e);
				
				delete columnData;
			}
		}
		
		if ( (typeof columnData !== "undefined") && (typeof selectionFunction !== "undefined") )
			columnData = selectionFunction(columnData);
		
		return(columnData);
	},
	
	matchColumns : function(dataSet1, columnName1, dataSet2, columnName2) {
		var lineOverlayWidget = this;
		lineOverlayWidget.lines = [];
		$(GeoTemConfig.datasets[dataSet1].objects).each(function(){
			var object1 = this;
			var data1 = lineOverlayWidget.getElementData(object1, columnName1);
			
			$(GeoTemConfig.datasets[dataSet2].objects).each(function(){
				var object2 = this;
				//avoid reflexive and double entries
				if ((dataSet1 === dataSet2)&&(object1.index<=object2.index))
					return;
				var data2 = lineOverlayWidget.getElementData(object2, columnName2);
				
				if (data1 === data2){
					lineOverlayWidget.lines.push(new Line(object1, object2));
				}
			});
		});
	},
	
	getXYofObject : function(cs,dataObject){
		//iterata over datasets
		var x,y;
		var found = false;
		$(cs).each(function(){
			//iterate over circles
			$(this).each(function(){
				var circle = this;
				//iterata over objects in this circle;
				var index = $.inArray(dataObject,circle.elements); 
				if (index !== -1){
					x = circle.originX;
					y = circle.originY;
					found = true;
					return false;
				}
			});
			//break loop
			if (found === true)
				return false;
		});
		
		return ({x:x,y:y});
	},
	
	/**
	 * @param {DataObjects[][]} objects set of objects to limit to
	 */
	drawLines : function(objects) {
		var flatObjects = [];
		if (	(typeof objects !== "undefined") &&
				(objects instanceof Array) &&
				(objects.length > 0) ) {
			$(objects).each(function(){
				$.merge(flatObjects, this);				
			});
		}
		var lineOverlayWidget = this;
		
		$(lineOverlayWidget.attachedMapWidgets).each(function(){
			var mapWidget = this.mapWidget;
			var lineLayer = this.lineLayer;

			var map = mapWidget.openlayersMap;
			var cs = mapWidget.mds.getObjectsByZoom();

			if (lineOverlayWidget.multiLineFeature instanceof OpenLayers.Feature.Vector){
				lineLayer.removeFeatures(lineOverlayWidget.multiLineFeature);
				delete lineOverlayWidget.multiLineFeature;
			}

			var lineStrings = [];
			var style = { 
					  strokeColor: '#0000ff', 
					  strokeOpacity: 0.5,
					  strokeWidth: 5
					};
			
			$(lineOverlayWidget.lines).each(function(){
				var line = this;
				
				if (flatObjects.length > 0){
					//if objects are limited, check whether start or end are within 
					if (	($.inArray(line.objectStart, flatObjects) === -1) &&
							($.inArray(line.objectEnd, flatObjects) === -1) )
						return;
				}
				//get XY-val of start Object
				var xyStart = lineOverlayWidget.getXYofObject(cs, line.objectStart);
				//continue if no valid XY-coords where found
				if ( (typeof xyStart.x === "undefined") && (typeof xyStart.y === "undefined") )
					return;
				var xyEnd = lineOverlayWidget.getXYofObject(cs, line.objectEnd);
				//continue if no valid XY-coords where found
				if ( (typeof xyEnd.x === "undefined") && (typeof xyEnd.y === "undefined") )
					return;

				//do not draw 0-length lines (from same circle)
				if ( (xyStart.x === xyEnd.x) && (xyStart.y === xyEnd.y) )
					return;

				var points = new Array(
						   new OpenLayers.Geometry.Point(xyStart.x, xyStart.y),
						   new OpenLayers.Geometry.Point(xyEnd.x, xyEnd.y)
						);

				var line = new OpenLayers.Geometry.LineString(points);

				//Only draw each line once. Unfortunately this check is faster
				//than drawing multiple lines.
				var found = false;
				$(lineStrings).each(function(){
					var checkLine = this;
					if (	(checkLine.components[0].x === line.components[0].x) &&
							(checkLine.components[0].y === line.components[0].y) &&
							(checkLine.components[1].x === line.components[1].x) &&
							(checkLine.components[1].y === line.components[1].y) ){
						found = true;
						return false;
					}
				});
				
				if (found === true)
					return;
				
				lineStrings.push(line);
			});
			var multiLineString = new OpenLayers.Geometry.MultiLineString(lineStrings);
			lineOverlayWidget.multiLineFeature = new OpenLayers.Feature.Vector(multiLineString, null, style);
			lineLayer.addFeatures(lineOverlayWidget.multiLineFeature);
		});
	},
	
	attachMapWidget : function(mapWidget) {
		var lineLayer = new OpenLayers.Layer.Vector("Line Layer");
		mapWidget.openlayersMap.addLayer(lineLayer);
		this.attachedMapWidgets.push({mapWidget:mapWidget,lineLayer:lineLayer});		
	}
};

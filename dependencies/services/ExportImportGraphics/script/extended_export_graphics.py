### Export/Import graphics geoprocessing script, for Auckland Council 10.2 Portal template application
###
# used for exporting and importing drawn graphics in a JSON webmap 
# graphics are saved as a map package (.mpk) which can be opened in ArcMap
# a text file is included containing the JSON webmap. This is used to import the graphics back into the web viewer. 
#
# David Aalbers, Geographic Information Systems 20/11/14
#
import arcpy
from arcpy import mapping
from arcpy import da
import uuid
import os
from os import path
import json
import extended_export_graphics_settings as settings
from datetime import datetime
import zipfile


def log(s, isError = False):
    global resultObj

    dateNow = datetime.now()
    dateStr = dateNow.strftime('%y-%m-%d %H:%M:%S')

    try:
        s = str(s)
    except:
        s = "An error occurred, but could not be cast to a string."

    s = dateStr + ":  " + s
    print(s)

    arcpy.AddMessage(s)
    if isError:
        if resultObj["error"] != "":
            resultObj["error"] += "; "
        resultObj["error"] += s

    
def getRowFromShareId(shareId):
    global shareTable

    fields = ['SHAREID', 'JSON']
    foundRow = None
    where = "SHAREID = '" + shareId + "'"

    with da.SearchCursor(shareTable, fields, where) as cursor:
        for row in cursor:
            foundRow = row
    
    return foundRow

def getNewShareId():

    guid = uuid.uuid4()
    shareId = str(guid).upper()
    shareId = shareId.replace("-", "")
    shareId = shareId[0:8]

    log("Generating new ShareID: " + shareId)

    # if an existing record exists get a new record
    checkRow = getRowFromShareId(shareId)
    if checkRow is not None:
        log("Duplicate ShareId found")
        return getNewShareId()

    return shareId

def zipFolder(path, zipFile):
    for root, dirs, files in os.walk(path):
        for file in files:
            filePath = os.path.join(root, file)
            log("Adding to zip: ")
            log(filePath)
            zipFile.write(filePath)



def addSymbologyAttributeToFeatures(webmapObj):

    operationalLayers = webmapObj["operationalLayers"]
    updatedOperationalLayers = []
    for layerObj in operationalLayers:
        log(layerObj["id"])


    
def writeFeatureSymbologyToAttributes(webmapObj):

    uniqueId = -1
    symbolDict = {}

    operationalLayers = webmapObj["operationalLayers"]
    for layerObj in operationalLayers:
        featureLayers = layerObj["featureCollection"]["layers"]
        for featureLayerObj in featureLayers:
            features = featureLayerObj["featureSet"]["features"]
            for feature in features:
                uniqueId += 1
                log("Processing: " + json.dumps(feature))
                attributes = feature["attributes"]
                symbol = feature["symbol"]
                symbolJson = json.dumps(symbol)

                attributes["AC_GRA_ID"] = uniqueId
                attributes["AC_GRA_SYM"] = ""
                symbolDict[uniqueId] = symbolJson

                log("Processed: " + json.dumps(feature))
    return symbolDict

    

def simplifyWebmap(webmapObj):

    operationalLayers = webmapObj["operationalLayers"]
    updatedOperationalLayers = []
    for layerObj in operationalLayers:        
        if not "url" in layerObj:
            updatedOperationalLayers.append(layerObj)
        else:
            log("Removing layer: " + layerObj["id"])
    
    webmapObj["operationalLayers"] = updatedOperationalLayers
    webmapObj["layoutOptions"] = {}

def getJsonGraphics(webmapObj, layerName, geomType):
    
    redlineLayerObj = None
    for layerObj in webmapObj["operationalLayers"]:
        if layerObj["id"] == layerName: # "redline-graphicslayer"
            redlineLayerObj = layerObj
    if redlineLayerObj:
        for featureLayerObj in redlineLayerObj["featureCollection"]["layers"]:
            featureSetObj = featureLayerObj["featureSet"]
            if featureSetObj["geometryType"] == geomType: # "esriGeometryPoint"
                return featureSetObj["features"]

    return []    
    
def getCommentsForJsonGraphics(webmapObj, layerName, geomType, commentsFieldName):
    
    commentsArray = []
    try:
        features = getJsonGraphics(webmapObj, layerName, geomType)
        for feature in features:
            attributes = feature["attributes"]
            comment = ""
            if commentsFieldName in attributes:
                comment = attributes[commentsFieldName]
            commentsArray.append(comment)
    except Exception as e:
        # error parsing json
        # could be 
        log("Error applying comments to generated features. Unable to parse JSON webmap. Skipping...")
        log(e)
        return []

    return commentsArray    

def addCommentsToFc(existingFc, jsonGeomType, graphicsLayerName, commentsFieldName):

    if not existingFc:
        return

    # create list of comments from json webmap
    comments = getCommentsForJsonGraphics(webMapObj, graphicsLayerName, jsonGeomType, commentsFieldName)
    if len(comments) < 1:
        return

    # add comments field to generated gdb feature classes
    arcpy.AddField_management(existingFc, commentsFieldName, "TEXT", None, None, 255)
             
    # update fc
    with arcpy.da.UpdateCursor(existingFc, [commentsFieldName]) as cursor:
        index = 0
        for row in cursor:
            if index < len(comments):
                comment = comments[index] 
                row[0] = comment
                cursor.updateRow(row)
                index += 1



# return this object when we're done
resultObj = {}
# client can always check for error object
resultObj["error"] = ""

resultObj["url"] = ""
resultObj["webmap"] = ""


try: 
    outFolder =  settings.OUTPUT_FOLDER
    outUrl = settings.OUTPUT_URL
    serverUploadPath = settings.FILE_UPLOAD_FOLDER


    # start processing request
    log("Collecting parameters...")

    # first parameter (0) is return object
    inputWebmapJson = arcpy.GetParameterAsText(1)
    inputFileId = arcpy.GetParameterAsText(2)
    
    
    ##### debug #####
    #inputWebmapJson = r'{}'
    #inputFileId = "test"

    log("Graphics webmap: " + str(inputWebmapJson)) 
    log("Input upload ID: " + str(inputFileId))    

    outMpkName = "webmap_graphics.mpk"
    outWebmapJsonFileName = "webmap.json"

    newUuid = str(uuid.uuid4())

    if inputWebmapJson:
        
        # create output location and file paths
        dataOutputFolderName = "_ags_gra_" + newUuid + "_data"
        dataOutputFolder = path.join(outFolder, dataOutputFolderName)
        os.mkdir(dataOutputFolder)
        generatedMxdFilePath = path.join(dataOutputFolder, "graphics.mxd")
        outWebmapTextFilePath = path.join(dataOutputFolder, outWebmapJsonFileName)
        outMpk = path.join(dataOutputFolder, outMpkName)
        outMpkUrl = outUrl + "/" + dataOutputFolderName + "/" + outMpkName
        # temp file gdb for webmap conversion
        newGdbFile = path.join(outFolder, dataOutputFolderName, "graphics_data.gdb")
        
        # do some processing of webmap prior to export
        log("Processing JSON webmap")
        webMapObj = json.loads(inputWebmapJson)
        log("Simplifying webmap")
        simplifyWebmap(webMapObj)
        processedWebmapJson = json.dumps(webMapObj)
        log("Webmap simplified: " + processedWebmapJson)


        # save webmap to text file, this is used to import graphics later 
        outWebmapTextFile = open(outWebmapTextFilePath, "w")
        outWebmapTextFile.write(processedWebmapJson)
        outWebmapTextFile.close()

        # convert webmap to mxd 
        log("Converting webmap to mxd")
        log("Using holding GDB: ")
        log(newGdbFile)
        convertWebmapResult = mapping.ConvertWebMapToMapDocument(processedWebmapJson, None, newGdbFile, None)
        webmapMapDoc = convertWebmapResult.mapDocument
        webmapDataframe = mapping.ListDataFrames(webmapMapDoc)[0]
        mapLayers = mapping.ListLayers(webmapMapDoc)
        webmapMapDoc.saveACopy(generatedMxdFilePath)

        # attributes in webmap features are not generated automatically when converting to a map doc
        # manually process comments attribute and apply to generated featureclasses
        # assumes that order of features in webmap matches order of features in featureclasses 
        for layer in mapLayers:
            if layer.supports("dataSource"):
                existingFc = layer.dataSource

                if layer.name == "pointLayer":
                    addCommentsToFc(existingFc, "esriGeometryPoint", "redline-graphicslayer", "remarks")
                elif layer.name == "polylineLayer":
                    addCommentsToFc(existingFc, "esriGeometryPolyline", "redline-graphicslayer", "remarks")
                elif layer.name == "polygonLayer":
                    addCommentsToFc(existingFc, "esriGeometryPolygon", "redline-graphicslayer", "remarks")


        # package map doc 
        # tool requires doc to have a description
        generatedMapDoc = mapping.MapDocument(generatedMxdFilePath)
        generatedMapDoc.description = "Auckland Council web viewer export graphics map document"
        generatedMapDoc.save()

        log("Packaging map: " + generatedMxdFilePath)
        log("Saving to: " + outMpk)
        arcpy.PackageMap_management(generatedMxdFilePath, outMpk, "CONVERT", "CONVERT_ARCSDE", "#", "ALL", "DESKTOP", "NOT_REFERENCED", "10.1", [outWebmapTextFilePath])

        # supply location to client
        resultObj["url"] = outMpkUrl


    
    # shapefiles need generating from gp service
    if inputFileId:

        # unzip uploaded files
        uploadPathRoot = path.join(serverUploadPath, inputFileId)

        if not path.isdir(uploadPathRoot):
            raise Exception("Upload directory not found: " + uploadPathRoot)

        # find a map package in uploads
        uploadedMpkFileName = None
        for file in os.listdir(uploadPathRoot):
            if file.endswith(".mpk"):
                uploadedMpkFileName = file
                log("Found upload mpk: " + uploadedMpkFileName)
                break
        if uploadedMpkFileName is None:
            raise Exception("No .mpk file found in: " + uploadPathRoot)

        uploadedPackage = path.join(uploadPathRoot, uploadedMpkFileName)

        extractedPackageName = "_ags_gra_" + newUuid + "_mpk"
        extractedPackage = path.join(outFolder, extractedPackageName)
        jsonFilePath = path.join(extractedPackage, "commondata", "userdata", outWebmapJsonFileName)

        # unpackage data and extract json file
        log('Attempting to extract: ' + uploadedPackage)
        log('Extracting to: ' + extractedPackage)
        arcpy.ExtractPackage_management(uploadedPackage, extractedPackage)
        jsonFile = open(jsonFilePath, "r")
        savedWebmapJson = jsonFile.read()


        # send webmap back to client
        resultObj["webmap"] = savedWebmapJson

        

except Exception as e:
    log(e, True)


finally:
    resultObjJson = json.dumps(resultObj)
    log("Result object: ")
    log(resultObjJson)
    arcpy.SetParameterAsText(0, resultObjJson)


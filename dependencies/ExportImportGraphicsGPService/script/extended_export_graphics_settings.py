# export/import graphics geoprocessing script settings file
# for Auckland Council Geomaps, running on ArcGIS Server 10.2
# Geographic Business Solutions, David Aalbers, Jan 2015
#
# this module needs to be made accessible to Python on the ArcGIS Servers running the export graphics map service
# 

# arcgis server output directory for generating files
# this is created after publishing the service
OUTPUT_FOLDER = r'E:\arcgisserver\directories\arcgisoutput\WDC\ExportGraphics_GPServer'

# arcgis server upload base directory
# service must have uploads enabled in settings for this folder to be created
FILE_UPLOAD_FOLDER = r'E:\arcgisserver\directories\arcgissystem\arcgisuploads\services\WDC\ExportGraphics.GPServer'

# URL that the OUTPUT_FOLDER is accessible through
OUTPUT_URL = "https://secure.gbs.co.nz/arcgis/rest/directories/arcgisoutput/WDC/ExportGraphics_GPServer"



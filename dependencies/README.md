# Dependencies #
This folder provides top level access to any widget dependencies. This may include but is not limited to:

- Web Service Source Code
- Server Object Extension Source Code
- Python Scripts
- Geoprocessing Models
- SQL Scripts

Important Notes

1. "CustomUtils" folder contains any utility,library files which may be required for the widgets delivered.This is a frame-work level utility folder which has to reside in   
   <WebApp Builder 1.3 path>/client/stemapp/jimu.js/ 

2. Content of SymbolsInfo folder has to be copied to  <WebApp Builder 1.3 path>/client/stemapp/jimu.js/dijit/SymbolsInfo path and use the file name ("picturemarker") to configure
   the Picturemarker configuration section of DrawMeasureWidget.
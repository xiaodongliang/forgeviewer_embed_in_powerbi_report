module powerbi.extensibility.visual {

    
    "use strict";
    export class PowerBI_ForgeViewer_Visual implements IVisual {
        private readonly DOCUMENT_URN: string = 'urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6eGlhb2Rvbmctbjktc3ZmMi10ZXN0LWVtZWEvcmFjX2FkdmFuY2VkLXN2ZjEucnZ0';
        
        // if get token from your server
        //private ACCESS_TOKEN: string = null;  
        private MY_SERVER_ENDPOINT = '<your server endpoint to get token>' //e.g. 'https://xiaodong-forge-viewer-test.herokuapp.com/api/forge/oauth/token'
        
        // if hard coded the token
        private ACCESS_TOKEN: string = '<your hard-coded token>'
        private target: HTMLElement;
        private pbioptions:VisualConstructorOptions;
        private updateCount: number;
        private settings: VisualSettings;
        private textNode: Text;
        private forge_viewer: Autodesk.Viewing.GuiViewer3D=null;
        private selectionMgr:ISelectionManager=null;
        private selectionIdBuilder:ISelectionIdBuilder=null;


        constructor(options: VisualConstructorOptions) {
            debugger;
 
            this.pbioptions = options; 
            this.target = options.element;
            this.target.innerHTML = '<div id="forge-viewer" ></div>';

            if (typeof document !== "undefined") {

                if(this.ACCESS_TOKEN != null){
                    //hard-coded token, load the model directly
                    this.initializeViewer("forge-viewer");  
                }else{
                    this.getToken(this.MY_SERVER_ENDPOINT); 
                    //inside getToken callback, will load the model
                }
            }
        }

        private async getToken(endpoint): Promise<void> {
            
            return new Promise<void>(res => {
                $.ajax({
                    url: endpoint,

                  }).done( res=> {
                    console.log('get token done!')
                    console.log(res.access_token);

                    //when token is ready, start to initialize viewer
                    this.ACCESS_TOKEN = res.access_token;
                    this.initializeViewer("forge-viewer"); 
                  })  
            })  
        } 

        private async initializeViewer(placeHolderDOMid: string): Promise<void> {
            const viewerContainer = document.getElementById(placeHolderDOMid)
            //load Forge Viewer scripts js and style css
            await this.loadForgeViewerScriptAndStyle();
            console.log('trying to load loadMyAwesomeExtension');

            const options = {
                env: 'AutodeskProduction',
                accessToken: this.ACCESS_TOKEN,
                extensions: []
            }

            var documentId = this.DOCUMENT_URN;
            console.log('documentId:' + documentId); 

            Autodesk.Viewing.Initializer(options, () => {
                this.forge_viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainer)
                this.forge_viewer.start();
                Autodesk.Viewing.Document.load(documentId, (doc)=>{

                    //if specific viewerable, provide its guid
                    //otherwise, load the default view
                    var viewableId = undefined 
                    var viewables:Autodesk.Viewing.BubbleNode = (viewableId ? doc.getRoot().findByGuid(viewableId) : doc.getRoot().getDefaultGeometry());
                    this.forge_viewer.loadDocumentNode(doc, viewables, {}).then(i => {
                      console.log('document has been loaded') 
                      
                      this.forge_viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT,async res=>{
                          
                          //GEOMETRY_LOADED_EVENT
                          console.log('GEOMETRY_LOADED_EVENT triggered!');

                          //load custom extension
                          await this.loadMyAwesomeExtension(); 
                          //load built-in extensions of Forge.
                          this.forge_viewer.loadExtension('Autodesk.DocumentBrowser');

                          console.log('dumpping dbIds...'); 
                          this.forge_viewer.getObjectTree( tree => {
                            var leaves = [];
                            tree.enumNodeChildren(tree.getRootId(),  dbId=> {
                                if (tree.getChildCount(dbId) === 0) {
                                    leaves.push(dbId);
                                }
                            }, true);
                            //console.log('DbId Array: ' + leaves); 
                            //possible to update PowerBI data source ??
                            //SQL database / Push Data ... ?

                         });  
                      })

                      this.forge_viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT,res=>{
                        
                        //Investigation on how to update PowerBI Visual when objects are selected in Forge Viewer
                        if (res.dbIdArray.length ===1 ) { 
                            const dbId = res.dbIdArray[0];
                            console.log('Autodesk.Viewing.SELECTION_CHANGED_EVENT:'+dbId)

                            //this.selectionMgr.select()  //experiment, not working..
                        }
                      }) 
                    });

                }, (err)=>{
                    console.error('onDocumentLoadFailure() - errorCode:' + err); 
                });
              }); 

        } 
        
        private async loadMyAwesomeExtension(): Promise<void> {
            return new Promise<void>((reslove,reject) => {
                let extjs = document.createElement('script');
                //input the src url of extension. ensure corb is enabled.
                //e.g. this is a demo from Forge OSS signed url
                extjs.src = "https://developer.api.autodesk.com/oss/v2/signedresources/b2f5afea-635f-4e10-835e-d7d4e39f2f57?region=US";
                extjs.type = "text/javascript";

                extjs.id = 'extjs';
                document.body.appendChild(extjs);

                extjs.onload = () => {
                    console.info("load viewer extension js succeeded"); 
                    this.forge_viewer.loadExtension('MyAwesomeExtension');
                    reslove();
                }; 
                extjs.onerror = (err) => {
                    console.info("load viewer extension js error:" +err ); 
                    reject(err);
                }; 
            }) 
        }

        private async loadForgeViewerScriptAndStyle(): Promise<void> {

            return new Promise<void>((reslove,reject) => {

                let forgeviewerjs = document.createElement('script');
                forgeviewerjs.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/viewer3D.js';

                forgeviewerjs.id = 'forgeviewerjs';
                document.body.appendChild(forgeviewerjs);

                forgeviewerjs.onload = () => {
                    console.info("Viewer scripts loaded"); 
                    let link = document.createElement("link");
                    link.rel = 'stylesheet';
                    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/style.min.css';
                    link.type = 'text/css';
                    link.id = "forgeviewercss";
                    document.body.appendChild(link); 
                    console.info("Viewer CSS loaded"); 

                    reslove();
                };

                forgeviewerjs.onerror = (err) => {
                    console.info("Viewer scripts error:" +err ); 
                    reject(err);
                }; 
 
            })

        };
 
        public update(options: VisualUpdateOptions) {

            if(options.type == 4 ||options.type == 36 ) //resizing or moving
                return; 
            debugger; 

            //when the viewer has not been initialized
             if (!this.forge_viewer) {
                 return;
             }
             console.log('updating with VisualUpdateOptions') 
             const dbIds = options.dataViews[0].table.rows.map(r => 
                <number>r[0].valueOf());
             console.log('selected dbIds: '  +dbIds)
             this.forge_viewer.showAll(); 
             this.forge_viewer.isolate(dbIds);
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }

        
    }
}

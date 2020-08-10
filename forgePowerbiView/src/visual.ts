module powerbi.extensibility.visual {
    "use strict";
    export class PowerBI_ForgeViewer_Visual implements IVisual {
        private readonly DOCUMENT_URN: string = 'urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6eGlhb2Rvbmctb2xkLXN2Zi10ZW1wb3JhcnktdGVzdC9hZHZhbmNlZC5ydnQ';
        private ACCESS_TOKEN: string = null;  //hard coded or by your own endpoint

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
                this.getToken(); 
            }
        }

        private async getToken(): Promise<void> {
            
            return new Promise<void>(res => {
                $.ajax({
                    url: 'https://xiaodong-forge-viewer-test.herokuapp.com/api/forge/oauth/token',

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

            const options = {
                env: 'AutodeskProduction',
                accessToken: this.ACCESS_TOKEN
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
                      
                      this.forge_viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT,res=>{
                          //GEOMETRY_LOADED_EVENT
                          console.log('GEOMETRY_LOADED_EVENT triggered!');

                          console.log('dumpping dbIds...');

                          this.forge_viewer.getObjectTree( tree => {
                            var leaves = [];
                            tree.enumNodeChildren(tree.getRootId(),  dbId=> {
                                if (tree.getChildCount(dbId) === 0) {
                                    leaves.push(dbId);
                                }
                            }, true);
                            console.log('DbId Array: ' + leaves);

                            //possible to update PowerBI data source ??
                            //SQL database / Push Data ...
                            //see PowerBI community post:
                            //

                         });  
                      })

                      this.forge_viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT,res=>{
                        
                        //Investigation on how to update PowerBI Visual when objects are selected in Forge Viewer
                        if (res.dbIdArray.length ===1 ) { 
                            const dbId = res.dbIdArray[0];
                            console.log('Autodesk.Viewing.SELECTION_CHANGED_EVENT:'+dbId)

                            //this.selectionMgr.select()

                            
                        }
                      }) 
                    });

                }, (err)=>{
                    console.error('onDocumentLoadFailure() - errorCode:' + err); 
                });
              }); 

        }

        /*private async loadForgeViewerScripts1(): Promise<void> {
            //this will cause cross-regions error
            return new Promise<void>(res => {
                $.ajax({
                    url: 'https://developer.api.autodesk.com/modelderivative/v2/viewers/viewer3D.min.js',
                    dataType: "script"
                  }).done( () => {
                    console.log('ok')
                    res();
                  })
            
            })
        } */


        

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

             if (!this.forge_viewer) {
                 return;
             }
             console.log('update with VisualUpdateOptions') 

             const dbIds = options.dataViews[0].table.rows.map(r => 
                <number>r[0].valueOf());
             console.log('dbIds: '  +dbIds)

             
                
             this.forge_viewer.showAll();

             this.forge_viewer.impl.setGhostingBrightness(true); //for isolate effect 
             this.forge_viewer.isolate(dbIds);
 
             //this.settings = ForgeViewerVisual.parseSettings(options && options.dataViews && options.dataViews[0]);

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

const fs = require('fs');
const ExcelJS = require('exceljs');
const { AuthClientTwoLegged, DerivativesApi } = require('forge-apis');
const config = require('./config');

let forge_auth = new AuthClientTwoLegged(config.client_id, config.client_secret, config.scopes);
let forge_deriv = new DerivativesApi();


const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_MODEL_URN } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET || !FORGE_MODEL_URN) {
    console.error('Some of the following env. variables are missing:');
    console.error('FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, MODEL_URN');
    return;
}

(async () => {
    try {
        const authRes = await forge_auth.authenticate(config.scopes);

        //this script assumes the model has been translated.

        const manifestRes = await forge_deriv.getManifest(config.model_urn, {}, forge_auth, forge_auth.getCredentials());
        if (manifestRes.body.status == 'success' && manifestRes.body.progress == 'complete') {
            const metaRes = await forge_deriv.getMetadata(config.model_urn, {}, forge_auth, forge_auth.getCredentials());
            const meta3DviewUrn = metaRes.body.data.metadata.find(i => i.name == '{3D}' && i.role == '3d');
            if (meta3DviewUrn) {

                //follow the same format of GET:Properties to build the response
                let propertiesRes = { body: { result: 'success' } }

                //set a timeout to avoid long time waiting. run the script after some time.
                const st = new Date().getTime()

                //waiting for the extracting.   
                while (propertiesRes.body.result == 'success' &&
                    new Date().getTime() - st < 5 * 60 * 1000) { // 5 minutes  timeout 
                    propertiesRes.result == null
                    propertiesRes = await forge_deriv.getModelviewProperties(config.model_urn, meta3DviewUrn.guid, { forceget: true }, forge_auth, forge_auth.getCredentials());
                }

                if (propertiesRes.body.result) {
                    //the extracting has not been completed. The While loop breaks due to time out
                    console.log('the extracting has not been completed. The While loop breaks due to time out. Try to run the script again after some time');

                } else {

                    const allProperties = propertiesRes.body.data.collection

                    //prepare rows. get dbid and material only
                    let rows = [];
                    allProperties.forEach(async p => { 
                        try{ 
                            let hasMaterial = p.properties['Materials and Finishes']

                            if (hasMaterial && hasMaterial['Material'] != null) {
                                let eachrow = [p.objectid+'', hasMaterial['Material']]
                                rows.push(eachrow);
                            }
                        }catch(e){}
                    });


                    //create workbook
                    const workbook = new ExcelJS.Workbook();
                    var worksheet = workbook.addWorksheet('powerbi_forge')

                    //define columns

                    const columns = [
                        { name: 'dbid', filterButton: false },
                        { name: 'material', filterButton: false },
                    ]

                    //create table with the columns and rows
                    worksheet.addTable({
                        name: 'powerbi_forge',
                        ref: 'A1',
                        headerRow: true,
                        totalsRow: true,
                        style: {
                            theme: 'TableStyleDark3',
                            showRowStripes: true,
                        },
                        columns: columns,
                        rows: rows
                    });

                    //save the excel file
                    const buffer = await workbook.xlsx.writeBuffer();
                    fs.writeFile("powerbi_forge.xlsx", buffer, "binary", function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log("The Excel file was saved!");
                        }
                    })
                } 

            } else {
                console.error('this model has no {3D} view')
            }
        } else {
            console.error('this model manifest is not available..')
        }

    }
    catch (e) {
        console.error(e);
    }
})()

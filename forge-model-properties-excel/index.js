
const fs = require('fs');
const ExcelJS = require('exceljs');
const { AuthClientTwoLegged, DerivativesApi } = require('forge-apis');
const config = require('./config');

if (!config.client_id || !config.client_secret || !config.model_urn) {
    console.error('Some of the following env. variables are missing:');
    console.error('FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, MODEL_URN');
    return;
}

let forge_auth = new AuthClientTwoLegged(config.client_id, config.client_secret, config.scopes);
let forge_deriv = new DerivativesApi();

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
                let propertiesRes = { statusCode: 202 }

                //set a timeout to avoid long time waiting. 
                //If timeout, run the scripts again to check if it completes.

                //5 minutes is NOT a standard. adjust it if needed 
                //(note: token will be expire in 60 minutes since it is generated. 
                //may need to re-generate token if timeout is too long.
                const timeOut = 5 * 60 * 1000   //5 minutes
                //to avoid 429 (rate limit), set interval of the each call
                //60 calls per minute for force getting large resource
                const rateInterval = 10 * 1000  //10 seconds

                //start time
                const st = new Date().getTime()
                //waiting for the extracting.   
                console.log(`extracting properties......timeout ${timeOut/60/1000} minutes `);

                while (propertiesRes.statusCode == 202
                    &&
                    new Date().getTime() - st < timeOut) {

                    propertiesRes.result == null

                    //wait some seconds to perform the next call
                    await delay(rateInterval)

                    propertiesRes = await forge_deriv.getModelviewProperties(config.model_urn,
                        meta3DviewUrn.guid,
                        { forceget: true },
                        forge_auth,
                        forge_auth.getCredentials());
                }


                if (propertiesRes.statusCode == 200) {
                    //successful extraction, writing data to excel
                    const allProperties = propertiesRes.body.data.collection
                    await produceExcelFile(allProperties) 
                }
                else if (propertiesRes.statusCode == 202 ) {
                    // While loop breaks due to time out
                    console.log(`The While loop breaks due to time out ${timeOut/60/1000} minutes. Try to run the script again after some time`);
                } 
                else if (propertiesRes.statusCode == 429 ) {
                    console.log(`hit rate limit. please wait for some time to run the scripts again, and increase rateInterval. Currently rateInterval=${rateInterval}/60 seconds `);
                }
                else { 
                    console.log(`other unknown errors. debug to check what the problem is.`);
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


//write properties data to excel file
async function produceExcelFile(allProperties) {
    //prepare rows. get dbid and material only
    let rows = [];
    allProperties.forEach(async p => {
        try {
            let hasMaterial = p.properties['Materials and Finishes']

            if (hasMaterial && hasMaterial['Material'] != null) {
                let eachrow = [p.objectid + '', hasMaterial['Material']]
                rows.push(eachrow);
            }
        } catch (e) { }
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

//to avoid the problem of 429 (too many requests in a time frame)
async function delay(t, v) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, v), t);
    });
}

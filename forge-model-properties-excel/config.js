
module.exports = { 
   
    client_id: process.env.FORGE_CLIENT_ID||'<your client id of Forge>' ,
    client_secret: process.env.FORGE_CLIENT_SECRET || '<your client secret of Forge>',
     
    model_urn: process.env.FORGE_MODEL_URN || '<your model urn of Forge>',
    //bucket: process.env.FORGE_BUCKET_KEY || '<your bucket of Forge>',

    scopes: ['data:read'],
    token:''
};

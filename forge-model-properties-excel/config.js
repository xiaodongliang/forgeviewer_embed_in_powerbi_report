
module.exports = { 
   
    client_id: process.env.FORGE_CLIENT_ID ,
    client_secret: process.env.FORGE_CLIENT_SECRET,
     
    model_urn: process.env.FORGE_MODEL_URN,
    bucket: process.env.FORGE_BUCKET_KEY,

    scopes: ['data:read'],
    token:''
};

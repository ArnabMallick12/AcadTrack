const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { v4: uuidv4 } = require('uuid');

exports.uploadFileToR2 = async (fileBuffer, originalName, mimetype) => {
    const fileKey = `${uuidv4()}-${originalName}`;
    const params = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Return the public URL or constructing it if bucket is public
    // Alternatively return the fileKey to be fetched via signed URL later
    return `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${fileKey}`;
};

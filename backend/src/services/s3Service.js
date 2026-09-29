import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';
const cloudFrontUrl = process.env.CLOUDFRONT_URL;

let s3Client = null;
if (bucketName) {
  // Uses IAM Task Role (on ECS/EC2) or AWS credentials from env
  s3Client = new S3Client({
    region,
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    }),
  });
  console.log(`☁️ Amazon S3 asset storage active (Bucket: ${bucketName}, Region: ${region})`);
} else {
  console.log('📁 Local filesystem asset storage active (AWS_S3_BUCKET not set)');
}

/**
 * Upload image to Amazon S3 bucket with fallback to local static serving
 * @param {Express.Multer.File} file
 * @returns {Promise<string>} Hosted image URL
 */
export async function uploadImage(file) {
  if (!s3Client || !bucketName) {
    return `/uploads/${file.filename}`;
  }

  const fileStream = fs.createReadStream(file.path);
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const s3Key = `listings/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: fileStream,
    ContentType: file.mimetype || 'image/jpeg',
    CacheControl: 'max-age=31536000, public',
  });

  try {
    await s3Client.send(command);

    // Optional CloudFront CDN acceleration URL
    if (cloudFrontUrl) {
      const cdnBase = cloudFrontUrl.endsWith('/') ? cloudFrontUrl.slice(0, -1) : cloudFrontUrl;
      return `${cdnBase}/${s3Key}`;
    }

    return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
  } catch (err) {
    console.error('Amazon S3 upload error, using local file path fallback:', err);
    return `/uploads/${file.filename}`;
  }
}

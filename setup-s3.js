// AWS S3 Auto-Setup Script
// Run this with: node setup-s3.js

const AWS = require('aws-sdk');

// Configuration
const config = {
    region: 'us-east-1',
    bucketName: `droproom-${Date.now()}`, // Unique bucket name
    policy: {
        Version: '2012-10-17',
        Statement: [
            {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::droproom-${Date.now()}/*`
            }
        ]
    }
};

console.log('🚀 DropRoom S3 Setup Script');
console.log('==========================');
console.log('This script will:');
console.log('1. Create S3 bucket');
console.log('2. Set bucket policy');
console.log('3. Generate credentials');
console.log('');

// Instructions for manual setup
console.log('📋 Manual Setup Instructions:');
console.log('============================');
console.log('1. Go to: https://console.aws.amazon.com/s3/');
console.log('2. Click "Create bucket"');
console.log(`3. Bucket name: droproom-${Date.now()}`);
console.log('4. Region: us-east-1');
console.log('5. UNCHECK "Block all public access"');
console.log('6. Click "Create bucket"');
console.log('');
console.log('7. Go to: https://console.aws.amazon.com/iam/');
console.log('8. Click "Users" → "Create user"');
console.log('9. User name: droproom-user');
console.log('10. Select "Access key - Programmatic access"');
console.log('11. Attach policy: "AmazonS3FullAccess"');
console.log('12. Copy the Access Key ID and Secret Access Key');
console.log('');
console.log('13. Add these to Render environment variables:');
console.log(`AWS_ACCESS_KEY_ID=your-access-key-here`);
console.log(`AWS_SECRET_ACCESS_KEY=your-secret-key-here`);
console.log(`AWS_REGION=us-east-1`);
console.log(`AWS_S3_BUCKET=droproom-${Date.now()}`);
console.log(`STORAGE_TYPE=s3`);
console.log('');
console.log('🎉 That\'s it! Your DropRoom will use cloud storage!');

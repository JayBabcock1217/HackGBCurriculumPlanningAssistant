import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly s3Client: S3Client;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const accessKey = process.env.MINIO_ACCESS_KEY || 'hackgb';
    const secretKey = process.env.MINIO_SECRET_KEY || 'hackgb_dev_password';

    this.s3Client = new S3Client({
      endpoint: `http://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  private readonly BUCKET = 'hackgb-curricula';

  /**
   * Create the bucket on first use (idempotent — ignores "already exists").
   * Called lazily so app startup doesn't fail if MinIO is still booting.
   */
  private async ensureBucketExists() {
    try {
      // Check if bucket exists by listing
      await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.BUCKET,
          MaxKeys: 1,
        }),
      );
      this.logger.log(`Bucket ${this.BUCKET} exists`);
    } catch {
      // Bucket doesn't exist, create it
      const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(
        new CreateBucketCommand({ Bucket: this.BUCKET }),
      );
      this.logger.log(`Created bucket ${this.BUCKET}`);
    }
  }

  async uploadFile(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.ensureBucketExists();
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Uploaded file: ${key} (${body.length} bytes)`);
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.BUCKET,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }

  async deleteFile(key: string): Promise<void> {
    await this.ensureBucketExists();
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.BUCKET,
        Key: key,
      }),
    );
    this.logger.log(`Deleted file: ${key}`);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.BUCKET,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(prefix: string = ''): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.BUCKET,
      Prefix: prefix,
    });
    const response = await this.s3Client.send(command);
    return (response.Contents || []).map((obj) => obj.Key || '');
  }

  getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const command = new GetObjectCommand({
      Bucket: this.BUCKET,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
